import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { NativeBottomNav } from "@/components/native/NativeBottomNav";

type QuizRow = { id: string; title: string; subject: string | null; grade: string | null; num_questions: number | null };
type PaperCount = { quiz_id: string; status: string | null };

/**
 * Pantalla nativa de "Resultados": lista de ensayos con cuantos alumnos ya
 * escanearon y cuantas hojas quedaron para revision manual, en tarjetas (no
 * la tabla de escritorio de /dashboard/papers). Tocar un ensayo lleva al
 * detalle en /app/results/[quizId].
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
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Resultados</h1>
      </header>

      <section className="space-y-5 px-5 py-6 pb-24">
        {totalPending > 0 ? (
          <div className="rounded-2xl border border-[#fbceb1] bg-[#fdf3ec] p-4 text-sm text-[#9a3412]">
            <span className="font-bold">{totalPending} hoja{totalPending === 1 ? "" : "s"}</span> quedaron para revision manual (respuestas dudosas). Revisalas desde el navegador en tulector.cl.
          </div>
        ) : null}

        {quizList.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
            Todavia no hay ensayos con resultados.
          </div>
        ) : (
          <div className="grid gap-3">
            {quizList.map((quiz) => {
              const counts = countByQuiz.get(quiz.id) ?? { total: 0, pending: 0 };
              return (
                <Link
                  key={quiz.id}
                  href={`/app/results/${quiz.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#e6e8eb] bg-white p-4 shadow-sm active:scale-[0.98]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#111827]">{quiz.title}</p>
                    <p className="mt-0.5 text-xs text-[#5b6472]">
                      {counts.total} escaneo{counts.total === 1 ? "" : "s"}
                      {counts.pending > 0 ? ` · ${counts.pending} por revisar` : ""}
                    </p>
                  </div>
                  <svg className="h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                </Link>
              );
            })}
          </div>
        )}
      </section>
      <NativeBottomNav />
    </main>
  );
}
