import { getDashboardContext } from "@/lib/supabase_server";
import { ResultsScreen } from "@/components/native/ResultsScreen";
import { applyTeacherScope, parseTeacherScope } from "@/lib/teacher_scope";
import { sharedQuizIdsFor } from "@/lib/quiz_shares";

type QuizRow = { id: string; title: string; subject: string | null; grade: string | null; num_questions: number | null };
type PaperCount = { quiz_id: string; status: string | null };

/**
 * Pantalla nativa de "Resultados": lista de ensayos con cuantos alumnos ya
 * escanearon y cuantas hojas quedaron para revision manual, en tarjetas (no
 * la tabla de escritorio de /dashboard/papers). Tocar un ensayo lleva al
 * detalle en /app/results/[quizId]. El render vive en ResultsScreen (header +
 * filtros sticky, ver ese archivo).
 */
export default async function NativeResultsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, user, school, isAdmin } = await getDashboardContext();
  const sp = (await searchParams) ?? {};

  // Mismo foco por docente que el dashboard web: un admin de plan school ve por
  // defecto SUS ensayos. Un docente no-admin ya viene aislado por RLS.
  const scope = parseTeacherScope(sp, { userId: user.id, isAdmin, plan: school.plan });
  // Ensayos de otros docentes que acepte (quiz_shares): la RLS ya me los deja
  // ver, esto evita que el filtro por autor del admin los esconda.
  const sharedQuizIds = await sharedQuizIdsFor(supabase, school.id, user.id);

  const [{ data: quizzes }, { data: papers }] = await Promise.all([
    applyTeacherScope(
      supabase.from("quizzes").select("id,title,subject,grade,num_questions").eq("school_id", school.id).is("archived_at", null).order("created_at", { ascending: false }),
      scope,
      sharedQuizIds,
    ),
    supabase.from("papers").select("quiz_id,status").eq("school_id", school.id).neq("status", "void"),
  ]);

  const quizList = (quizzes ?? []) as QuizRow[];
  // Las hojas se cuentan SOLO sobre los ensayos visibles: si no, el contador de
  // "por revisar" sumaria hojas de ensayos de otros docentes que ni se listan.
  const visibleQuizIds = new Set(quizList.map((q) => q.id));
  const paperRows = ((papers ?? []) as PaperCount[]).filter((p) => p.quiz_id && visibleQuizIds.has(p.quiz_id));
  const countByQuiz = new Map<string, { total: number; pending: number }>();
  for (const p of paperRows) {
    if (!p.quiz_id) continue;
    const entry = countByQuiz.get(p.quiz_id) ?? { total: 0, pending: 0 };
    entry.total += 1;
    if (p.status === "manual_review") entry.pending += 1;
    countByQuiz.set(p.quiz_id, entry);
  }
  const totalPending = paperRows.filter((p) => p.status === "manual_review").length;

  return (
    <ResultsScreen
      totalPending={totalPending}
      quizzes={quizList.map((quiz) => ({
        ...quiz,
        ...(countByQuiz.get(quiz.id) ?? { total: 0, pending: 0 }),
      }))}
    />
  );
}
