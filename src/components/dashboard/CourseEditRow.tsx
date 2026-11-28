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
  isAdmin: boolean;
  updateAction: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  archiveAction: (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;
  grades: readonly string[];
  /** Alumnos del curso. `null` si la BD aun no tiene course_student_counts. */
  studentCount?: number | null;
};

const initialState: DashboardActionState = { status: "idle" };

const COURSE_BADGES = [
  { emoji: "🏫", cls: "bg-[#eef4ff] ring-[#d5e3fb]" },
  { emoji: "📚", cls: "bg-[#fef3c7] ring-[#fde68a]" },
  { emoji: "🎒", cls: "bg-[#dcfce7] ring-[#bbf7d0]" },
  { emoji: "✏️", cls: "bg-[#ffedd5] ring-[#fed7aa]" },
  { emoji: "🌿", cls: "bg-[#ecfccb] ring-[#d9f99d]" },
  { emoji: "🧭", cls: "bg-[#e0f2fe] ring-[#bae6fd]" },
] as const;

function courseBadge(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COURSE_BADGES[hash % COURSE_BADGES.length];
}

/** Antes solo se podia crear/eliminar un curso -- una vez creado, un error de
 * tipeo (ej. "IIMC" en vez de "II C") quedaba pegado para siempre. Este
 * componente agrega edicion inline: boton "Editar" muestra un mini-form con
 * Guardar/Cancelar en el lugar del link+nivel de siempre. */
export function CourseEditRow({ course, isAdmin, updateAction, archiveAction, grades, studentCount = null }: CourseEditRowProps) {
  const badge = courseBadge(course.name);
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
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <Link href={`/dashboard/courses/${course.id}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 hover:bg-[#faf9f6] hover:text-[#07305f]">
        <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm ring-1 ${badge.cls}`}>
          {badge.emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold">{course.name}</span>
          <span className="text-xs text-[#78716c]">{course.grade}</span>
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-3">
        {studentCount !== null && (
          <Link
            href={`/dashboard/students?course=${course.id}`}
            className="tnum rounded-md bg-[#f4f2ec] px-2.5 py-0.5 text-xs font-semibold text-[#44403c] hover:bg-[#eef4ff] hover:text-[#07305f]"
            title="Ver estos alumnos en Gestión de alumnos"
          >
            {studentCount} alumno{studentCount === 1 ? "" : "s"}
          </Link>
        )}
      {isAdmin && (
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={() => setEditing(true)} className="text-xs font-semibold text-[#07305f] hover:underline">
            Editar
          </button>
          <DeleteButton
            action={archiveAction}
            id={course.id}
            label="Archivar"
            pendingLabel="Archivando…"
            confirmLabel="Archivar"
            confirmTitle="¿Archivar curso?"
            danger={false}
            className="text-xs font-semibold text-[#6b7280] hover:underline disabled:opacity-50"
            confirm={`"${course.name}" dejará de aparecer para asociar alumnos o ensayos nuevos. Los alumnos y ensayos ya vinculados no se tocan, y puedes restaurarlo cuando quieras desde "Cursos archivados".`}
          />
        </div>
      )}
      </div>
    </div>
  );
}
