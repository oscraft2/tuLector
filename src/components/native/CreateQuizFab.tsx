"use client";

import { useState } from "react";
import { QuizCreateForm } from "@/components/dashboard/QuizCreateForm";

type CourseOption = { id: string; name: string; grade: string | null };

/**
 * Boton flotante "+" en /app/scan: la pantalla de escanear prioriza elegir un
 * ensayo existente (accion principal); crear uno nuevo es secundario y vive
 * detras de este FAB en vez de un formulario largo siempre visible al final
 * de la pagina.
 */
export function CreateQuizFab({ courses }: { courses: CourseOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Crear ensayo nuevo"
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
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-black text-[#111827]">Ensayo nuevo</h2>
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
            <QuizCreateForm courses={courses} />
          </div>
        </div>
      ) : null}
    </>
  );
}
