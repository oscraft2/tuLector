"use client";

import { useActionState, useEffect, useRef } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

const initialState: DashboardActionState = { status: "idle" };

type CourseFormProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  grades: readonly string[];
};

export function CourseForm({ action, grades }: CourseFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.key, state.status]);

  return (
    <>
      <form ref={formRef} action={formAction} className="pt-2 border-t border-[#eef0f3] space-y-3">
        <p className="text-xs font-semibold text-[#07305f]">Agregar nuevo curso</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            name="name"
            required
            placeholder="Ej: IV Medio A"
            className="w-full rounded-md border border-[#cfd6df] px-3 py-1.5 text-sm outline-none focus:border-[#07305f]"
          />
          <select
            name="grade"
            required
            className="w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1.5 text-sm outline-none focus:border-[#07305f]"
          >
            <option value="">Selecciona nivel</option>
            {grades.map((grade) => (
              <option key={grade} value={grade}>{grade}</option>
            ))}
          </select>
        </div>
        <SubmitButton pendingLabel="Creando…" className="w-full rounded-md bg-[#07305f] py-1.5 text-xs font-semibold text-white hover:bg-[#062447] disabled:cursor-not-allowed disabled:opacity-60">Crear curso</SubmitButton>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}