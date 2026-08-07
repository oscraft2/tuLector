"use client";

import { useActionState, useRef, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";

const initialState: DashboardActionState = { status: "idle" };

type DeleteButtonProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  id: string;
  confirm?: string;
  confirmTitle?: string;
  label?: string;
  pendingLabel?: string;
  confirmLabel?: string;
  className?: string;
  danger?: boolean;
};

/** Pese al nombre (quedo de cuando solo se usaba para borrar), sirve para
 * cualquier accion destructiva-o-no que necesite confirmacion + form oculto
 * -- ej. "Archivar" (danger=false, reversible) reusa exactamente lo mismo
 * que "Eliminar" (danger=true) via los props de texto. */
export function DeleteButton({
  action,
  id,
  confirm,
  confirmTitle = "¿Eliminar?",
  label = "Eliminar",
  pendingLabel = "Eliminando…",
  confirmLabel = "Eliminar",
  className,
  danger = true,
}: DeleteButtonProps) {
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
        <input type="hidden" name="id" value={id} />
        <button
          type="button"
          onClick={() => (confirm ? setOpen(true) : submit())}
          disabled={isPending}
          aria-busy={isPending}
          className={className ?? "text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"}
        >
          {isPending ? pendingLabel : label}
        </button>
      </form>
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
      <ActionFeedbackDialog state={state} />
    </>
  );
}
