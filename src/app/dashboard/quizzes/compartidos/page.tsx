import Link from "next/link";
import { getDashboardContext } from "@/lib/supabase_server";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { acceptQuizShare, declineQuizShare, revokeQuizShare } from "@/app/dashboard/quizzes/actions";
import { fetchSharesByUser, fetchSharesForUser, fetchQuizSummaries, fetchUserEmails, userLabel } from "@/lib/quiz_shares";
import { formatDate } from "@/locales";

export const dynamic = "force-dynamic";

/**
 * Ensayos que otros docentes del colegio me compartieron y los que yo comparti.
 * Es el destino del correo "Te compartieron un ensayo" y del enlace de la
 * notificacion in-app. Aceptar aca es lo que abre la RLS: recien entonces el
 * ensayo aparece en /dashboard/quizzes, en /app/scan y en la lista offline del
 * lector, y las hojas que escanee caen en ESE ensayo.
 */
export default async function SharedQuizzesPage() {
  const { supabase, user, school, locale } = await getDashboardContext();

  const [incoming, outgoing] = await Promise.all([
    fetchSharesForUser(supabase, school.id, user.id, ["pending", "accepted"]),
    fetchSharesByUser(supabase, school.id, user.id, ["pending", "accepted"]),
  ]);

  const [quizzes, emails] = await Promise.all([
    fetchQuizSummaries([...incoming, ...outgoing].map((s) => s.quiz_id)),
    fetchUserEmails([...incoming.map((s) => s.shared_by ?? ""), ...outgoing.map((s) => s.shared_with)]),
  ]);

  const pending = incoming.filter((s) => s.status === "pending");
  const accepted = incoming.filter((s) => s.status === "accepted");
  const quizTitle = (quizId: string) => quizzes.get(quizId)?.title ?? "Ensayo compartido";

  return (
    <>
      <PageHeader
        title="Ensayos compartidos"
        description="Ensayos que tus colegas te compartieron para corregir entre varios, y los que tú compartiste. Al aceptar uno, las hojas que escanees quedan en el mismo ensayo: no se crea una copia."
      />

      <div className="space-y-6">
        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Esperando tu respuesta</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-sm text-[#5b6472]">No tienes ensayos compartidos por aceptar.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {pending.map((share) => (
                <li key={share.id} className="rounded-md border border-[#e1e5ea] bg-[#f8fafc] p-4">
                  <p className="text-base font-semibold text-[#111827]">{quizTitle(share.quiz_id)}</p>
                  <p className="mt-1 text-sm text-[#5b6472]">
                    Compartido por <strong>{userLabel(share.shared_by, emails)}</strong> · {formatDate(share.created_at, locale)}
                  </p>
                  <p className="mt-2 text-sm text-[#5b6472]">
                    Si aceptas podrás verlo, imprimir su hoja y escanear. No podrás editar su clave.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      action={acceptQuizShare}
                      fields={{ share_id: share.id }}
                      label="Aceptar"
                      pendingLabel="Aceptando…"
                      className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447]"
                    />
                    <ActionButton
                      action={declineQuizShare}
                      fields={{ share_id: share.id }}
                      label="Rechazar"
                      pendingLabel="Rechazando…"
                      className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#5b6472] hover:bg-gray-50"
                      confirm={`¿Rechazar "${quizTitle(share.quiz_id)}"? No lo verás en tu lista; quien te lo compartió puede volver a intentarlo.`}
                      confirmTitle="¿Rechazar el ensayo?"
                      confirmLabel="Rechazar"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Compartidos conmigo</h2>
          {accepted.length === 0 ? (
            <p className="mt-2 text-sm text-[#5b6472]">Todavía no has aceptado ningún ensayo de otro docente.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {accepted.map((share) => (
                <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e5ea] px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/quizzes/${share.quiz_id}`} className="text-sm font-semibold text-[#07305f] hover:underline">
                      {quizTitle(share.quiz_id)}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#5b6472]">de {userLabel(share.shared_by, emails)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/dashboard/results/${share.quiz_id}`} className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                      Resultados
                    </Link>
                    <Link href={`/sheet?quiz=${share.quiz_id}`} className="rounded-md border border-[#cfd6df] px-3 py-1.5 text-xs font-semibold hover:bg-gray-50">
                      Hoja
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-md border border-[#d8dde3] bg-white p-5">
          <h2 className="text-lg font-semibold text-[#111827]">Compartidos por mí</h2>
          {outgoing.length === 0 ? (
            <p className="mt-2 text-sm text-[#5b6472]">
              Todavía no compartiste ningún ensayo. Puedes hacerlo desde el detalle de cada uno, en{" "}
              <Link href="/dashboard/quizzes" className="font-semibold text-[#07305f] hover:underline">Ensayos</Link>.
            </p>
          ) : (
            <ul className="mt-4 space-y-2">
              {outgoing.map((share) => (
                <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e5ea] px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/dashboard/quizzes/${share.quiz_id}`} className="text-sm font-semibold text-[#07305f] hover:underline">
                      {quizTitle(share.quiz_id)}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#5b6472]">
                      con {userLabel(share.shared_with, emails)} ·{" "}
                      {share.status === "accepted" ? "aceptado" : "esperando que acepte"}
                    </p>
                  </div>
                  <ActionButton
                    action={revokeQuizShare}
                    fields={{ share_id: share.id }}
                    label="Revocar"
                    pendingLabel="Revocando…"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    confirm={`¿Quitarle el acceso a ${userLabel(share.shared_with, emails)}? Las hojas que ya escaneó siguen en el ensayo.`}
                    confirmTitle="¿Revocar acceso?"
                    confirmLabel="Revocar"
                    danger
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
