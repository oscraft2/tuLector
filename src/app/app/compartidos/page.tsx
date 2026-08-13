import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { startScanForQuiz } from "@/app/dashboard/actions";
import { acceptQuizShare, declineQuizShare } from "@/app/dashboard/quizzes/actions";
import { fetchSharesForUser, fetchQuizSummaries, fetchUserEmails, userLabel } from "@/lib/quiz_shares";

export const dynamic = "force-dynamic";

/**
 * Ensayos que un colega me compartio, en version nativa.
 *
 * Existe para que el APK NO tenga que mandar al docente a /dashboard: desde
 * aca acepta, y el ensayo aparece al toque en /app/scan (y en la descarga
 * offline de /api/scan/quiz-packs). Los server actions son los mismos que usa
 * la web -- lo unico propio es la piel.
 */
export default async function NativeSharedQuizzesPage() {
  const { supabase, user, school } = await getDashboardContext();

  const shares = await fetchSharesForUser(supabase, school.id, user.id, ["pending", "accepted"]);
  const [quizzes, emails] = await Promise.all([
    fetchQuizSummaries(shares.map((s) => s.quiz_id)),
    fetchUserEmails(shares.map((s) => s.shared_by ?? "")),
  ]);

  const pending = shares.filter((s) => s.status === "pending");
  const accepted = shares.filter((s) => s.status === "accepted");
  const titleOf = (quizId: string) => quizzes.get(quizId)?.title ?? "Ensayo compartido";
  const detailOf = (quizId: string) => {
    const quiz = quizzes.get(quizId);
    if (!quiz) return "Ensayo del colegio";
    return [quiz.subject ?? quiz.grade, quiz.num_questions ? `${quiz.num_questions} preguntas` : null]
      .filter(Boolean)
      .join(" · ") || "Ensayo del colegio";
  };

  return (
    <main className="min-h-dvh bg-[#f5f6f8] text-[#0b1220]">
      <header className="safe-pt sticky top-0 z-30 flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="text-lg font-black tracking-tight">Compartidos</h1>
      </header>

      <section className="space-y-6 px-5 py-6 pb-24">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Esperando tu respuesta</p>
          {pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              No tienes ensayos compartidos por aceptar.
            </div>
          ) : (
            <div className="space-y-3">
              {pending.map((share) => (
                <article key={share.id} className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
                  <p className="text-base font-black text-[#111827]">{titleOf(share.quiz_id)}</p>
                  <p className="mt-1 text-xs text-[#5b6472]">{detailOf(share.quiz_id)}</p>
                  <p className="mt-2 text-sm text-[#5b6472]">
                    Te lo compartió <strong>{userLabel(share.shared_by, emails)}</strong>. Si aceptas, las hojas que escanees
                    quedan en ese mismo ensayo.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      action={acceptQuizShare}
                      fields={{ share_id: share.id }}
                      label="Aceptar"
                      pendingLabel="Aceptando…"
                      className="rounded-xl bg-[#07305f] px-5 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
                    />
                    <ActionButton
                      action={declineQuizShare}
                      fields={{ share_id: share.id }}
                      label="Rechazar"
                      pendingLabel="Rechazando…"
                      className="rounded-xl border border-[#dfe3e8] px-5 py-2.5 text-sm font-bold text-[#5b6472] active:bg-[#f4f6f8]"
                      confirm={`¿Rechazar "${titleOf(share.quiz_id)}"?`}
                      confirmTitle="¿Rechazar el ensayo?"
                      confirmLabel="Rechazar"
                    />
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#6b7280]">Ya aceptados</p>
          {accepted.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dfe3e8] bg-white/50 p-5 text-center text-sm text-[#5b6472]">
              Cuando aceptes un ensayo, aparecerá aquí y en la pantalla Escanear.
            </div>
          ) : (
            <div className="divide-y divide-[#e6e8eb] overflow-hidden rounded-2xl border border-[#e6e8eb] bg-white">
              {accepted.map((share) => (
                <form key={share.id} action={startScanForQuiz}>
                  <input type="hidden" name="quiz_id" value={share.quiz_id} />
                  <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-[#f4f6f8]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[#111827]">{titleOf(share.quiz_id)}</p>
                      <p className="mt-0.5 text-xs text-[#5b6472]">de {userLabel(share.shared_by, emails)} · {detailOf(share.quiz_id)}</p>
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-[#9aa3af]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
