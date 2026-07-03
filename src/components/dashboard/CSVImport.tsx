"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";

const initialState: DashboardActionState = { status: "idle" };

type CSVImportProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className="mt-4 rounded-md bg-[#111827] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
      {pending ? "Importando..." : "Importar"}
    </button>
  );
}

export function CSVImport({ action }: CSVImportProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.key, state.status]);

  return (
    <>
      <form ref={formRef} action={formAction} className="rounded-md border border-[#e6e8eb] bg-white p-5">
        <label className="block text-sm font-semibold text-[#111827]" htmlFor="csv">Importar CSV de alumnos</label>
        <p className="mt-1 text-sm text-[#4b5563]">Columnas soportadas: rut, nombre, curso. Se valida RUT chileno y se evita duplicar por colegio.</p>
        <textarea id="csv" name="csv" rows={8} className="mt-4 w-full rounded-md border border-[#d8dde3] px-3 py-2 text-sm outline-none focus:border-[#111827]" placeholder={"rut,nombre,curso\n12345678-5,Ana Perez,IV Medio A"} />
        <SubmitButton />
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}