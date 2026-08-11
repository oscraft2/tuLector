import Link from "next/link";
import { cookies } from "next/headers";
import { getDashboardContext } from "@/lib/supabase_server";
import { startScanForQuiz } from "@/app/dashboard/actions";
import { CreateQuizFab } from "@/components/native/CreateQuizFab";
import { parseSheetMode } from "@/lib/sheet_mode";

type QuizRow = {
  id: string;
  title: string;
  subject: string | null;
  grade: string | null;
  num_questions: number | null;
  options_per_question: number | null;
  archived_at: string | null;
  /** 'full' | 'compact' (ver src/lib/sheet_mode.ts). */
  sheet_mode?: string | null;
};

/** Un ensayo de bloque compacto se genera en /bloque, no en /sheet. */
const sheetHref = (quiz: QuizRow) =>
  parseSheetMode(quiz.sheet_mode) === "compact" ? `/bloque?quiz=${quiz.id}` : `/sheet?quiz=${quiz.id}`;

/**
 * Pantalla nativa de "Escanear": elegir el ensayo (o seguir con el ultimo
 * usado) y saltar a /scan con la camara. Reemplaza el link directo a
 * /dashboard/quizzes (pagina de escritorio) por una UI de tarjetas propia del
 * APK. El motor OMR y /scan no cambian — esto solo decide QUE ensayo escanear.
 */
export default async function NativeScanPage() {
  const { supabase, school, isAdmin } = await getDashboardContext();
  const activeQuizId = (await cookies()).get("tulector_active_quiz")?.value;

  const [{ data: quizzes }, { data: courses }] = await Promise.all([
    supabase
      .from("quizzes")
      .select("id,title,subject,grade,num_questions,options_per_question,archived_at,sheet_mode")
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("courses").select("id,name,grade").is("archived_at", null).order("name"),
  ]);

  // BD sin la migracion sheet_mode: se relee sin la columna en vez de dejar la
  // lista vacia (degradacion silenciosa -- sin columna no hay compactos).
  let quizRows: unknown = quizzes;
  if (!quizRows) {
    const { data } = await supabase
      .from("quizzes")
      .select("id,title,subject,grade,num_questions,options_per_question,archived_at")
      .eq("school_id", school.id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    quizRows = data;
  }
  const quizList = (quizRows ?? []) as unknown as QuizRow[];
  const activeQuiz = activeQuizId ? quizList.find((q) => q.id === activeQuizId) : null;
  const otherQuizzes = activeQuiz ? quizList.filter((q) => q.id !== activeQuiz.id) : quizList;

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt sticky top-0 z-30 flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Escanear</h1>
      </header>

      <section className="space-y-5 px-5 py-6 pb-24">
        {activeQuiz ? (
          <div className="overflow-hidden rounded-2xl bg-[#07305f] shadow-sm">
            <form action={startScanForQuiz}>
              <input type="hidden" name="quiz_id" value={activeQuiz.id} />
              <button className="w-full p-5 text-left text-white active:scale-[0.98]">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">Seguir escaneando</p>
                <p className="mt-1 text-lg font-black">{activeQuiz.title}</p>
                <p className="mt-1 text-sm text-white/70">{activeQuiz.num_questions} preguntas · {activeQuiz.options_per_question ?? 5} opciones</p>
              </button>
            </form>
            {/* /sheet?quiz=<id> (o /bloque?quiz=<id> si el ensayo es compacto)
                hereda formato, clave y codigo del ensayo, y es del mismo origen
                que server.url: se abre DENTRO del APK. */}
            <Link
              href={sheetHref(activeQuiz)}
              className="flex items-center gap-2 border-t border-white/15 px-5 py-3 text-sm font-bold text-white/90 active:bg-white/10"
            >
              <SheetIcon />
              {parseSheetMode(activeQuiz.sheet_mode) === "compact" ? "Ver / generar su bloque compacto" : "Ver / generar su hoja de respuestas"}
            </Link>
          </div>
        ) : null}

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">
            {activeQuiz ? "Otros ensayos" : "Tus ensayos"}
          </p>
          {otherQuizzes.length === 0 && !activeQuiz ? (
            <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              Todavia no tienes ensayos. Crea el primero con el boton + de abajo.
            </div>
          ) : (
            <div className="divide-y divide-[#e6e8eb] overflow-hidden rounded-2xl border border-[#e6e8eb] bg-white">
              {/* Dos acciones por ensayo: escanear (el <form>) y ver su hoja
                  (un <Link>). Van como HERMANOS en un contenedor flex: anidar
                  un enlace dentro del boton del formulario es HTML invalido. */}
              {otherQuizzes.map((quiz) => (
                <div key={quiz.id} className="flex items-stretch">
                  <form action={startScanForQuiz} className="min-w-0 flex-1">
                    <input type="hidden" name="quiz_id" value={quiz.id} />
                    <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#f4f6f8]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#111827]">{quiz.title}</p>
                        <p className="mt-0.5 text-xs text-[#5b6472]">{quiz.subject ?? quiz.grade ?? "Ensayo"} · {quiz.num_questions} preguntas</p>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </form>
                  <Link
                    href={sheetHref(quiz)}
                    aria-label={`Ver la hoja de respuestas de ${quiz.title}`}
                    title="Ver / generar su hoja de respuestas"
                    className="flex shrink-0 items-center border-l border-[#e6e8eb] px-4 text-[#07305f] active:bg-[#eef4ff]"
                  >
                    <SheetIcon />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

      </section>

      <CreateQuizFab courses={(courses ?? []) as { id: string; name: string; grade: string | null }[]} isAdmin={isAdmin} />
    </main>
  );
}

/** Icono de hoja de respuestas (documento con lineas). */
function SheetIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}
