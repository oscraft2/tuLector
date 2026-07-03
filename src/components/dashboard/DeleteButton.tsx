"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";

const initialState: DashboardActionState = { status: "idle" };

type DeleteButtonProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  id: string;
  confirm?: string;
  label?: string;
  className?: string;
};

function Submit({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className ?? "text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"}
    >
      {pending ? "Eliminando..." : label}
    </button>
  );
}

export function DeleteButton({ action, id, confirm, label = "Eliminar", className }: DeleteButtonProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <>
      <form
        action={formAction}
        onSubmit={(e) => {
          if (confirm && !window.confirm(confirm)) e.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Submit label={label} className={className} />
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}
