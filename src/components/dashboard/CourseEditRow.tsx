"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { SubmitButton } from "@/components/dashboard/SubmitButton";
import { DeleteButton } from "@/components/dashboard/DeleteButton";

type Course = { id: string; name: string; grade: string | null };

type CourseEditRowProps = {
  course: Course;
  selected: boolean;
  isAdmin: boolean;
  updateAction: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  deleteAction: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  grades: readonly string[];
};

const initialState: DashboardActionState = { status: "idle" };

/** Antes solo se podia crear/eliminar un curso -- una vez creado, un error de
 * tipeo (ej. "IIMC" en vez de "II C") quedaba pegado para siempre. Este
 * componente agrega edicion inline: boton "Editar" muestra un mini-form con
 * Guardar/Cancelar en el lugar del link+nivel de siempre. */
export function CourseEditRow({ course, selected, isAdmin, updateAction, deleteAction, grades }: CourseEditRowProps) {
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(updateAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // Sincroniza con el resultado de la server action (useActionState) --
    // "external system" segun la propia regla, caso valido.
    if (state.status === "success") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEditing(false);
    }
  }, [state.key, state.status]);

  if (editing) {
    return (
      <div className="space-y-2 rounded-md border border-[#cfd6df] bg-[#f8fafc] p-2">
        <form ref={formRef} action={formAction} className="space-y-2">
          <input type="hidden" name="id" value={course.id} />
          <input
            name="name"
            defaultValue={course.name}
            required
            className="w-full rounded-md border border-[#cfd6df] px-2 py-1 text-sm outline-none focus:border-[#07305f]"
          />
          <select
            name="grade"
            defaultValue={course.grade ?? ""}
            required
            className="w-full rounded-md border border-[#cfd6df] bg-white px-2 py-1 text-sm outline-none focus:border-[#07305f]"
          >
            <option value="">Selecciona nivel</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <SubmitButton pendingLabel="Guardando…" className="rounded-md bg-[#07305f] px-3 py-1 text-xs font-semibold text-white hover:bg-[#062447] disabled:opacity-60">
              Guardar
            </SubmitButton>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-[#cfd6df] px-3 py-1 text-xs font-semibold hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
        <ActionFeedbackDialog state={state} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 text-sm">
      <Link
        href={`/dashboard/students?course=${course.id}`}
        className={selected ? "min-w-0 rounded-md bg-[#eef4ff] px-2 py-1 text-[#07305f]" : "min-w-0 rounded-md px-2 py-1 hover:bg-[#f4f6f8] hover:text-[#07305f]"}
      >
        <span className="block truncate font-semibold">{course.name}</span>
        <span className="text-xs text-[#6b7280]">{course.grade}</span>
      </Link>
      {isAdmin && (
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-[#07305f] hover:underline">
            Editar
          </button>
          <DeleteButton
            action={deleteAction}
            id={course.id}
            confirm={`¿Eliminar el curso "${course.name}"? Los alumnos no se borran, pero deberás reasignarlos.`}
          />
        </div>
      )}
    </div>
  );
}
