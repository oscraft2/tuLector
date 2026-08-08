"use client";

import { useActionState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";

const initialState: DashboardActionState = { status: "idle" };

export function InviteForm({ action }: { action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState> }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <>
      <form action={formAction} className="rounded-md border border-[#e6e8eb] bg-white p-5">
        <h2 className="text-base font-semibold text-[#111827]">Invitar miembro</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px_auto]">
          <input name="email" type="email" required placeholder="correo@colegio.cl" className="rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" />
          <select name="role" className="rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" defaultValue="teacher">
            <option value="admin">Admin</option>
            <option value="teacher">Profesor</option>
            <option value="viewer">Observador</option>
          </select>
          <button disabled={isPending} aria-busy={isPending} className="rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {isPending ? "Invitando…" : "Invitar"}
          </button>
        </div>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}
