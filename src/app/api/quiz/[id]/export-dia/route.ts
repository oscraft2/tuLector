import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { buildDiaCsv, slugCsvFilename, type ExportPaper } from "@/lib/dia_export";
import { parseOpenQuestions } from "@/lib/quiz_constraints";
import { isMissingColumnError } from "@/lib/supabase_errors";

/** Descarga el CSV Formato Pruebas DIA de un ensayo. Server-side (no requiere
 * cargar `answers` de todos los alumnos en el cliente) para poder ofrecer el
 * mismo link tanto desde la lista de ensayos como desde el detalle -- ver
 * dia-bot/docs/FINDINGS.md seccion 8.1 para el formato exacto. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, school } = await getDashboardContext();

  let quizResult = await supabase
    .from("quizzes")
    .select("id,subject,grade,num_questions,open_questions")
    .eq("id", id)
    .eq("school_id", school.id)
    .single();
  if (quizResult.error && isMissingColumnError(quizResult.error, "open_questions")) {
    quizResult = await supabase
      .from("quizzes")
      .select("id,subject,grade,num_questions")
      .eq("id", id)
      .eq("school_id", school.id)
      .single();
  }
  const { data: quiz, error: quizError } = quizResult;
  if (quizError || !quiz) return NextResponse.json({ error: "Ensayo no disponible" }, { status: 404 });

  const { data: papers, error: papersError } = await supabase
    .from("papers")
    .select("student_name,student_rut_norm,answers")
    .eq("quiz_id", id)
    .eq("school_id", school.id);
  if (papersError) return NextResponse.json({ error: "No se pudieron leer los resultados" }, { status: 500 });

  const csv = buildDiaCsv({
    papers: (papers ?? []) as ExportPaper[],
    numQuestions: Number(quiz.num_questions) || 0,
    subject: quiz.subject,
    grade: quiz.grade,
    openQuestions: parseOpenQuestions(
      (quiz as { open_questions?: string | null }).open_questions ?? "",
      Number(quiz.num_questions) || 0,
    ),
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slugCsvFilename(quiz.subject, quiz.grade)}"`,
    },
  });
}
