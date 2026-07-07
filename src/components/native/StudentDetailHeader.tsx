"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StudentEditSheet } from "./StudentEditSheet";

type StudentRow = { id: string; rut: string | null; student_id: string | null; name: string; course: string | null };
type CourseOption = { id: string; name: string; grade: string | null };

/** Header sticky del perfil nativo de alumno: "Volver" + nombre + boton
 * editar (abre el mismo StudentEditSheet que antes se abria al tocar la
 * tarjeta en la lista — ahora tocar la tarjeta lleva aca, a ver resultados). */
export function StudentDetailHeader({ student, courses }: { student: StudentRow; courses: CourseOption[] }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  return (
    <>
      <header className="safe-pt sticky top-0 z-30 flex items-center gap-3 bg-[#111827] px-5 pb-5 pt-5 text-white">
        <Link href="/app/students" aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-black tracking-tight">{student.name}</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Editar alumno"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z" />
          </svg>
        </button>
      </header>

      {editing ? (
        <StudentEditSheet
          student={student}
          courses={courses}
          onClose={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}
