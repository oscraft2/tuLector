"use client";

import { useActionState, useEffect, useRef } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

const initialState: DashboardActionState = { status: "idle" };

type CourseOption = {
  id: string;
  name: string;
  grade: string | null;
};

type StudentFormProps = {
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  courses: readonly CourseOption[];
  defaultCourse?: string;
};

export function StudentForm({ action, courses, defaultCourse }: StudentFormProps) {
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const disabled = courses.length === 0 && !defaultCourse;

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.key, state.status]);

  return (
    <>
      <form ref={formRef} action={formAction} className="space-y-3">
        <label className="block text-xs font-semibold">
          Nombre completo
          <input
            name="name"
            required
            placeholder="Ej: Juan Perez"
            className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm outline-none focus:border-[#111827]"
          />
        </label>

        <label className="block text-xs font-semibold">
          RUT Chileno
          <input
            name="rut"
            required
            placeholder="Ej: 12.345.678-5"
            className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm outline-none focus:border-[#111827]"
          />
        </label>

        {defaultCourse ? (
          <input type="hidden" name="course" value={defaultCourse} />
        ) : (
          <label className="block text-xs font-semibold">
            Curso / Grupo
            <select
              name="course"
              required
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-sm outline-none focus:border-[#111827] disabled:bg-[#f3f4f6]"
            >
              <option value="">Selecciona curso</option>
              {courses.map((course) => (
                <option key={course.id} value={course.name}>{course.name} ({course.grade ?? "sin nivel"})</option>
              ))}
            </select>
          </label>
        )}

        <SubmitButton pendingLabel="Agregando…" disabled={disabled} className="w-full rounded-md bg-[#111827] py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-50">{disabled ? "Primero crea un curso" : "Agregar alumno"}</SubmitButton>
      </form>
      <ActionFeedbackDialog state={state} />
    </>
  );
}