"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { updateStudent, deleteStudent } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";

type CourseOption = { id: string; name: string; grade: string | null };
type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };

const initialState: DashboardActionState = { status: "idle" };

/** Sheet nativo para editar (o eliminar) un alumno existente — antes solo se
 * podia buscar y crear, corregir un nombre o RUT con typo exigia el navegador. */
export function StudentEditSheet({
  student,
  courses,
  onClose,
}: {
  student: StudentRow;
  courses: readonly CourseOption[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(updateStudent, initialState);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();

  useEffect(() => {
    if (state.status === "success") onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.key, state.status]);

  const handleDelete = () => {
    startDelete(async () => {
      const fd = new FormData();
      fd.set("id", student.id);
      await deleteStudent(initialState, fd);
      onClose();
    });
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[85vh] overflow-y-auto rounded-t-[1.5rem] bg-[#f5f6f8] p-5 pb-10 shadow-[0_-10px_50px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#111827]">Editar alumno</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111827] shadow-sm active:scale-[0.95]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
          <form action={formAction} className="space-y-3">
            <input type="hidden" name="id" value={student.id} />
            <label className="block text-xs font-semibold">
              Nombre completo
              <input
                name="name"
                required
                defaultValue={student.name}
                className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm outline-none focus:border-[#111827]"
              />
            </label>
            <label className="block text-xs font-semibold">
              RUT Chileno
              <input
                name="rut"
                required
                defaultValue={student.rut ?? student.student_id ?? ""}
                className="mt-1 w-full rounded-md border border-[#cfd6df] px-3 py-2 font-normal text-sm outline-none focus:border-[#111827]"
              />
            </label>
            <label className="block text-xs font-semibold">
              Curso / Grupo
              <select
                name="course"
                required
                defaultValue={student.course ?? ""}
                className="mt-1 w-full rounded-md border border-[#cfd6df] bg-white px-3 py-2 font-normal text-sm outline-none focus:border-[#111827]"
              >
                <option value="">Selecciona curso</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.name}>{course.name} ({course.grade ?? "sin nivel"})</option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="Guardando…" className="w-full rounded-md bg-[#07305f] py-2 text-sm font-semibold text-white hover:bg-[#062447] disabled:cursor-not-allowed disabled:opacity-50">
              Guardar cambios
            </SubmitButton>
          </form>
          <ActionFeedbackDialog state={state} />
        </div>

        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mt-4 w-full rounded-md border border-red-200 bg-red-50 py-2 text-sm font-semibold text-red-700"
        >
          Eliminar alumno
        </button>
      </div>
    </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar alumno"
        message={`Se eliminara a ${student.name} del establecimiento. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        pending={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
