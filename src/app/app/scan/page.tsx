import Link from "next/link";
import { cookies } from "next/headers";
import { getDashboardContext } from "@/lib/supabase_server";
import { startScanForQuiz } from "@/app/dashboard/actions";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  archived_at: string | null;
};

/**
 * Pantalla nativa de "Escanear": elegir el ensayo (o seguir con el ultimo
 * usado) y saltar a /scan con la camara. Reemplaza el link directo a
 * /dashboard/quizzes (pagina de escritorio) por una UI de tarjetas propia del
 * APK. El motor OMR y /scan no cambian — esto solo decide QUE ensayo escanear.
 */
export default async function NativeScanPage() {
  const { supabase, school } = await getDashboardContext();
  const activeQuizId = (await cookies()).get("tulector_active_quiz")?.value;

  const [{ data: quizzes }, { data: courses }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id,title,subject,grade,num_questions,options_per_question,archived_at")
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id,name,grade").order("name"),
  ]);

  const quizList = (quizzes ?? []) as QuizRow[];
  const activeQuiz = activeQuizId ? quizList.find((q) => q.id === activeQuizId) : null;
  const otherQuizzes = activeQuiz ? quizList.filter((q) => q.id !== activeQuiz.id) : quizList;

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Escanear</h1>
      </header>

      <section className="space-y-5 px-5 py-6 pb-24">
        {activeQuiz ? (
          <form action={startScanForQuiz}>
            <input type="hidden" name="quiz_id" value={activeQuiz.id} />
            <button className="w-full rounded-2xl bg-[#07305f] p-5 text-left text-white shadow-sm active:scale-[0.98]">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Seguir escaneando</p>
              <p className="mt-1 text-lg font-black">{activeQuiz.title}</p>
              <p className="mt-1 text-sm text-white/70">{activeQuiz.num_questions} preguntas · {activeQuiz.options_per_question ?? 5} opciones</p>
            </button>
          </form>
        ) : null}

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
            {activeQuiz ? "Otros ensayos" : "Tus ensayos"}
          </p>
          {otherQuizzes.length === 0 && !activeQuiz ? (
            <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              Todavia no tienes ensayos. Crea el primero abajo.
            </div>
          ) : (
            <div className="grid gap-3">
              {otherQuizzes.map((quiz) => (
                <form key={quiz.id} action={startScanForQuiz}>
                  <input type="hidden" name="quiz_id" value={quiz.id} />
                  <button className="flex w-full items-center gap-3 rounded-2xl border border-[#e6e8eb] bg-white p-4 text-left shadow-sm active:scale-[0.98]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#111827]">{quiz.title}</p>
                      <p className="mt-0.5 text-xs text-[#5b6472]">{quiz.subject ?? quiz.grade ?? "Ensayo"} · {quiz.num_questions} preguntas</p>
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Crear ensayo nuevo</p>
          <QuizCreateForm courses={(courses ?? []) as { id: string; name: string; grade: string | null }[]} />
        </div>
      </section>
    </main>
  );
}
