import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { isMissingColumnError } from "@/lib/supabase_errors";

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  course_id?: string | null;
  num_questions: number | null;
};

/** Lista, en JSON, los ensayos con al menos 1 hoja ya leida -- para que la
 * extension de Chrome (dia-bot-extension) ofrezca un selector en vez de
 * obligar a exportar/descargar/elegir el CSV a mano. Mismo query liviano que
 * ya usa dashboard/quizzes/page.tsx (conteo de papers sin traer `answers`),
 * solo que devuelto como JSON en vez de una tabla renderizada. Solo lectura:
 * no expone respuestas, solo metadata (titulo/curso/asignatura/cantidad). */
export async function GET() {
  const { supabase, school } = await getDashboardContext();

  // OJO: filtrar school_id EXPLICITO acá, igual que export-dia/route.ts --
  // no basta con confiar solo en RLS. Un usuario con acceso a mas de un
  // colegio puede tener RLS que le deje ver quizzes de varios colegios a la
  // vez, pero export-dia SI filtra por el colegio "activo" de la sesion
  // (school.id); sin este mismo filtro acá, list-dia podia listar un ensayo
  // que export-dia despues rechazaba con 404 "Ensayo no disponible" -- bug
  // real encontrado en vivo probando el sync con la extension de Chrome.
  const [quizzesResult, { data: courses }] = await Promise.all([
    supabase.from("quizzes").select("id,title,subject,grade,course_id,num_questions").eq("school_id", school.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("courses").select("id,name").eq("school_id", school.id),
  ]);

  let quizzesData: unknown = quizzesResult.data;
  if (quizzesResult.error && isMissingColumnError(quizzesResult.error, "course_id")) {
    const fallback = await supabase.from("quizzes").select("id,title,subject,grade,num_questions").eq("school_id", school.id).is("archived_at", null).order("created_at", { ascending: false });
    quizzesData = fallback.data;
  }

  const quizzes = (quizzesData ?? []) as QuizRow[];
  const courseNameById = new Map((courses ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

  const quizIds = quizzes.map((q) => q.id);
  const paperCountByQuiz = new Map<string, number>();
  if (quizIds.length > 0) {
    const { data: paperRows } = await supabase.from("papers").select("quiz_id").in("quiz_id", quizIds);
    for (const row of paperRows ?? []) paperCountByQuiz.set(row.quiz_id, (paperCountByQuiz.get(row.quiz_id) ?? 0) + 1);
  }

  const ensayos = quizzes
    .map((q) => ({
      id: q.id,
      titulo: q.title,
      asignatura: q.subject,
      curso: q.course_id ? (courseNameById.get(q.course_id) ?? q.grade ?? null) : (q.grade ?? null),
      numPreguntas: q.num_questions,
      hojasLeidas: paperCountByQuiz.get(q.id) ?? 0,
    }))
    .filter((q) => q.hojasLeidas > 0);

  return NextResponse.json({ ensayos });
}
