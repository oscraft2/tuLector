"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { shareQuiz, revokeQuizShare } from "@/app/dashboard/quizzes/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { ActionButton } from "@/components/dashboard/ActionButton";

const initialState: DashboardActionState = { status: "idle" };

export type ShareCandidate = { userId: string; label: string };
export type ExistingShare = { id: string; label: string; status: string };

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  pending: { text: "Esperando que acepte", className: "bg-amber-100 text-amber-800" },
  accepted: { text: "Aceptado", className: "bg-emerald-100 text-emerald-800" },
};

/**
 * Compartir un ensayo con docentes del colegio. Solo lo ve el dueño del ensayo
 * (o el admin) y solo en plan school — el gate real vive en el server action
 * (planHasFeature "quiz_sharing"), esto es la UI.
 *
 * El invitado NO recibe acceso al marcarlo aca: recibe correo + notificacion y
 * tiene que aceptar. Hasta entonces la RLS no le muestra nada.
 */
export function ShareQuizPanel({
  quizId,
  candidates,
  shares,
}: {
  quizId: string;
  candidates: ShareCandidate[];
  shares: ExistingShare[];
}) {
  const [state, formAction] = useActionState(shareQuiz, initialState);
  const [selected, setSelected] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const lastKey = useRef<number | undefined>(undefined);

  // Tras compartir con exito se limpia la seleccion: si no, quedan marcados
  // docentes que ya aparecen abajo en la lista de comparticiones vigentes.
  useEffect(() => {
    if (state.status === "success" && state.key !== lastKey.current) {
      lastKey.current = state.key;
      setSelected([]);
      formRef.current?.reset();
    }
  }, [state]);

  const toggle = (userId: string) =>
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  return (
    <section className="rounded-md border border-[#d8dde3] bg-white p-5">
      <h2 className="text-lg font-semibold text-[#111827]">Compartir con el equipo</h2>
      <p className="mt-1 text-sm text-[#5b6472]">
        El docente que acepte podrá ver este ensayo, imprimir su hoja y escanear. Las hojas que lea
        quedan en <strong>este mismo ensayo</strong>: no se crea uno nuevo ni se parte la base de resultados.
        No podrá editar la pauta ni archivarlo.
      </p>

      {candidates.length === 0 ? (
        <p className="mt-4 rounded-md border border-[#e6e8eb] bg-[#f8fafc] px-4 py-3 text-sm text-[#5b6472]">
          No hay otros docentes en el colegio todavía. Invítalos desde Configuración y vuelve aquí.
        </p>
      ) : (
        <form ref={formRef} action={formAction} className="mt-4">
          <input type="hidden" name="quiz_id" value={quizId} />
          <div className="grid gap-2 sm:grid-cols-2">
            {candidates.map((c) => (
              <label
                key={c.userId}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm transition ${
                  selected.includes(c.userId) ? "border-[#07305f] bg-[#eef4ff]" : "border-[#e1e5ea] hover:bg-[#f8fafc]"
                }`}
              >
                <input
                  type="checkbox"
                  name="user_ids"
                  value={c.userId}
                  checked={selected.includes(c.userId)}
                  onChange={() => toggle(c.userId)}
                  className="h-4 w-4"
                />
                <span className="truncate text-[#111827]">{c.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-4">
            <SubmitButton
              disabled={selected.length === 0}
              pendingLabel="Compartiendo…"
              className="rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {selected.length === 0 ? "Elige a quién compartir" : `Compartir con ${selected.length} docente${selected.length === 1 ? "" : "s"}`}
            </SubmitButton>
          </div>
        </form>
      )}

      {shares.length > 0 && (
        <div className="mt-6 border-t border-[#eef0f3] pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9aa3af]">Compartido con</p>
          <ul className="mt-3 space-y-2">
            {shares.map((share) => {
              const badge = STATUS_LABEL[share.status] ?? { text: share.status, className: "bg-gray-100 text-gray-700" };
              return (
                <li key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[#e1e5ea] bg-[#f8fafc] px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{share.label}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>{badge.text}</span>
                  </div>
                  <ActionButton
                    action={revokeQuizShare}
                    fields={{ share_id: share.id }}
                    label="Revocar"
                    pendingLabel="Revocando…"
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                    confirm={`¿Quitarle el acceso a ${share.label}? Las hojas que ya escaneó siguen en el ensayo; solo pierde el acceso de aquí en adelante.`}
                    confirmTitle="¿Revocar acceso?"
                    confirmLabel="Revocar"
                    danger
                  />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <ActionFeedbackDialog state={state} />
    </section>
  );
}
