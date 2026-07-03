"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";

const initialState: DashboardActionState = { status: "idle" };

type ActionButtonProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  /** Inputs ocultos que la accion necesita (ej. { id: quiz.id }). */
  fields?: Record<string, string>;
  label: ReactNode;
  pendingLabel?: string;
  className?: string;
  /** Si se pasa, primero muestra un ConfirmDialog in-app. */
  confirm?: string;
  confirmTitle?: string;
  confirmLabel?: string;
  danger?: boolean;
};

/** Botón para una server action de un solo paso, con estado de carga, toast de
 * resultado (ActionFeedbackDialog) y confirmación opcional (ConfirmDialog). La
 * acción debe devolver DashboardActionState. Reutilizable (archivar, duplicar, …). */
export function ActionButton({
  action,
  fields = {},
  label,
  pendingLabel = "Procesando…",
  className,
  confirm,
  confirmTitle = "¿Confirmar?",
  confirmLabel = "Confirmar",
  danger = false,
}: ActionButtonProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const submit = () => {
    setOpen(false);
    formRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={formRef} action={formAction}>
        {Object.entries(fields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <button
          type="button"
          onClick={() => (confirm ? setOpen(true) : submit())}
          disabled={isPending}
          aria-busy={isPending}
          className={className}
        >
          {isPending ? pendingLabel : label}
        </button>
      </form>
      {confirm ? (
        <ConfirmDialog
          open={open}
          title={confirmTitle}
          message={confirm}
          confirmLabel={confirmLabel}
          pending={isPending}
          danger={danger}
          onConfirm={submit}
          onCancel={() => setOpen(false)}
        />
      ) : null}
      <ActionFeedbackDialog state={state} />
    </>
  );
}
