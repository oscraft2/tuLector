"use client";

import { useState } from "react";
import { StudentForm } from "@/components/dashboard/StudentForm";
import { CourseForm } from "@/components/dashboard/CourseForm";
import { createStudent, createCourse } from "@/app/dashboard/actions";

type CourseOption = { id: string; name: string; grade: string | null };

// Mismos niveles que src/app/dashboard/students/page.tsx (CHILEAN_GRADES) —
// duplicado a proposito: es una lista estatica corta, no vale la pena
// compartir un archivo solo por esto.
const CHILEAN_GRADES = [
  "1° Básico", "2° Básico", "3° Básico", "4° Básico", "5° Básico", "6° Básico",
  "7° Básico", "8° Básico", "I Medio", "II Medio", "III Medio", "IV Medio",
  "Educación Superior", "Otro",
];

/**
 * Boton flotante "+" en /app/students: antes el formulario "Agregar alumno"
 * vivia siempre visible al fondo de la pagina (y si no habia cursos, mandaba
 * al navegador — no habia forma de crear un curso desde el APK). Ahora es un
 * FAB con dos pestañas (Alumno / Curso), ambas nativas.
 */
export function StudentsFab({ courses }: { courses: CourseOption[] }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"alumno" | "curso">(courses.length === 0 ? "curso" : "alumno");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Agregar alumno o curso"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#07305f] text-white shadow-lg active:scale-[0.95]"
      >
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={() => setOpen(false)}>
          <div
            className="max-h-[85vh] overflow-y-auto rounded-t-[1.5rem] bg-[#f5f6f8] p-5 pb-10 shadow-[0_-10px_50px_rgba(0,0,0,0.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#111827]">Agregar</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#111827] shadow-sm active:scale-[0.95]"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[#e6e8eb] p-1">
              <button
                type="button"
                onClick={() => setTab("alumno")}
                className={`rounded-lg py-2 text-sm font-bold transition ${tab === "alumno" ? "bg-white text-[#07305f] shadow-sm" : "text-[#5b6472]"}`}
              >
                Alumno
              </button>
              <button
                type="button"
                onClick={() => setTab("curso")}
                className={`rounded-lg py-2 text-sm font-bold transition ${tab === "curso" ? "bg-white text-[#07305f] shadow-sm" : "text-[#5b6472]"}`}
              >
                Curso
              </button>
            </div>

            {tab === "alumno" ? (
              courses.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#dfe3e8] bg-white/50 p-4 text-center text-sm text-[#5b6472]">
                  Primero crea un curso — cambia a la pestaña &quot;Curso&quot;.
                </p>
              ) : (
                <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
                  <StudentForm action={createStudent} courses={courses} />
                </div>
              )
            ) : (
              <div className="rounded-2xl border border-[#e6e8eb] bg-white p-4">
                <CourseForm action={createCourse} grades={CHILEAN_GRADES} />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
