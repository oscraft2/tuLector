"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";

const initialState: DashboardActionState = { status: "idle" };

type StudentOption = {
  id: string;
  name: string;
  rut: string | null;
  student_id: string | null;
  course: string | null;
};

type CourseRosterProps = {
  courseName: string;
  students: readonly StudentOption[];
  availableStudents: readonly StudentOption[];
  isAdmin: boolean;
  action: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
};

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function CourseRoster({ courseName, students, availableStudents, isAdmin, action }: CourseRosterProps) {
  const [state, formAction] = useActionState(action, initialState);

  return (
    <section className="rounded-md border border-[#d8dde3] bg-white p-4 md:p-5">
      <div className="flex flex-col gap-2 border-b border-[#eef0f3] pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6b7280]">Curso seleccionado</p>
          <h2 className="mt-1 text-xl font-semibold text-[#111827]">{courseName}</h2>
        </div>
        <p className="text-sm font-semibold text-[#07305f]">{students.length} alumno{students.length === 1 ? "" : "s"}</p>
      </div>

      {isAdmin ? (
        <form action={formAction} className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input type="hidden" name="course" value={courseName} />
          <label className="block text-xs font-semibold text-[#111827]">
            Agregar alumno existente
            <select name="student_id" required className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#07305f]">
              <option value="">Selecciona alumno</option>
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} ({student.course ? `actual: ${student.course}` : "sin curso"})
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <SubmitButton label="Agregar" pendingLabel="Agregando..." className="w-full rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447] sm:w-auto" />
          </div>
        </form>
      ) : null}

      <p className="mt-4 rounded-md bg-[#f8fafc] px-3 py-3 text-sm text-[#5b6472]">
        Revisa, quita del curso o elimina alumnos desde la tabla inferior.
      </p>

      <ActionFeedbackDialog state={state} />
    </section>
  );
}
