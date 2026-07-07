import { getDashboardContext } from "@/lib/supabase_server";
import { ResultsScreen } from "@/components/native/ResultsScreen";

type QuizRow = { id: string; title: string; subject: string | null; grade: string | null; num_questions: number | null };
type PaperCount = { quiz_id: string; status: string | null };

/**
 * Pantalla nativa de "Resultados": lista de ensayos con cuantos alumnos ya
 * escanearon y cuantas hojas quedaron para revision manual, en tarjetas (no
 * la tabla de escritorio de /dashboard/papers). Tocar un ensayo lleva al
 * detalle en /app/results/[quizId]. El render vive en ResultsScreen (header +
 * filtros sticky, ver ese archivo).
 */
export default async function NativeResultsPage() {
  const { supabase, school } = await getDashboardContext();

  const [{ data: quizzes }, { data: papers }] = await Promise.all([
    supabase.from("quizzes").select("id,title,subject,grade,num_questions").eq("school_id", school.id).is("archived_at", null).order("created_at", { ascending: false }),
    supabase.from("papers").select("quiz_id,status").eq("school_id", school.id).neq("status", "void"),
  ]);

  const quizList = (quizzes ?? []) as QuizRow[];
  const paperRows = (papers ?? []) as PaperCount[];
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
