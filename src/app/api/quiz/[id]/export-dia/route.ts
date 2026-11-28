import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { buildDiaCsv, slugCsvFilename, unaHojaPorEstudiante, type ExportPaper, type ExportOpenAnswer } from "@/lib/dia_export";
import { parseOpenQuestions, parseMultiSelectQuestions, parseOpenQuestionRubrics } from "@/lib/quiz_constraints";
import { isMissingColumnError, isMissingTableError } from "@/lib/supabase_errors";

/** Descarga el CSV Formato Pruebas DIA de un ensayo. Server-side (no requiere
 * cargar `answers` de todos los alumnos en el cliente) para poder ofrecer el
 * mismo link tanto desde la lista de ensayos como desde el detalle -- ver
 * dia-bot/docs/FINDINGS.md seccion 8.1 para el formato exacto. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  // Columnas que llegaron en migraciones posteriores: se piden de mas completo
  // a mas basico segun lo que tenga la BD.
  const COLUMNAS = [
    "id,subject,grade,num_questions,open_questions,multi_select_questions,open_question_rubrics",
    "id,subject,grade,num_questions,open_questions,open_question_rubrics",
    "id,subject,grade,num_questions,open_questions",
    "id,subject,grade,num_questions",
  ];
  type QuizExport = {
    id: string; subject: string | null; grade: string | null; num_questions: number | null;
    open_questions?: string | null; multi_select_questions?: string | null; open_question_rubrics?: string | null;
  };
  let quiz: QuizExport | null = null;
  for (const columnas of COLUMNAS) {
    const result = await supabase.from("quizzes").select(columnas).eq("id", id).eq("school_id", school.id).single();
    if (!result.error) { quiz = result.data as unknown as QuizExport; break; }
    const faltaColumna = ["multi_select_questions", "open_question_rubrics", "open_questions"]
      .some((columna) => isMissingColumnError(result.error, columna));
    if (!faltaColumna) break;
  }
  if (!quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

  // Sin hojas descartadas, y de la mas reciente a la mas antigua para que
  // unaHojaPorEstudiante() se quede con la misma que se califico.
  const { data: allPapers, error: papersError } = await supabase
    .from("papers")
    .select("id,student_name,student_id,student_rut_norm,answers")
    .eq("quiz_id", id)
    .eq("school_id", school.id)
    .neq("status", "void")
    .order("scanned_at", { ascending: false });
  if (papersError) return NextResponse.json({ error: "No se pudieron leer los resultados" }, { status: 500 });
  const papers = unaHojaPorEstudiante(allPapers ?? []);

  const openQuestions = parseOpenQuestions(quiz.open_questions ?? "", Number(quiz.num_questions) || 0);

  // Solo se consulta open_answers si el ensayo realmente tiene preguntas
  // abiertas -- evita un query/join de mas en el caso comun (ensayo solo de
  // alternativas). Por tandas, para no chocar con el tope de filas de una sola
  // consulta.
  const openAnswers: ExportOpenAnswer[] = [];
  if (openQuestions.length > 0) {
    const paperIds = papers.map((p) => p.id).filter((paperId): paperId is string => !!paperId);
    for (let i = 0; i < paperIds.length; i += 100) {
      const { data, error } = await supabase
        .from("open_answers")
        .select("paper_id,question,transcripcion,legible,confirmed_points,max_points")
        .in("paper_id", paperIds.slice(i, i + 100));
      if (error) {
        // Sin la tabla, todo queda "sin_revisar". Cualquier otro error corta la
        // exportacion: seguir mandaria ceros como si fueran puntajes.
        if (isMissingTableError(error, "open_answers")) break;
        return NextResponse.json({ error: "No se pudieron leer los puntajes de desarrollo" }, { status: 500 });
      }
      openAnswers.push(...((data ?? []) as ExportOpenAnswer[]));
    }
  }

  const csv = buildDiaCsv({
    papers: papers as ExportPaper[],
    numQuestions: Number(quiz.num_questions) || 0,
    subject: quiz.subject,
    grade: quiz.grade,
    openQuestions,
    multiSelectQuestions: parseMultiSelectQuestions(quiz.multi_select_questions ?? "", Number(quiz.num_questions) || 0),
    openAnswers,
    openQuestionRubrics: parseOpenQuestionRubrics(quiz.open_question_rubrics),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugCsvFilename(quiz.subject, quiz.grade)}"`,
    },
  });
}
