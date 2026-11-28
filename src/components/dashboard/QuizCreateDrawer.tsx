"use client";

import { useEffect, useState, type ReactNode } from "react";

export function QuizCreateDrawer({
  defaultOpen = false,
  children,
}: {
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-[#07305f] px-4 py-2 text-sm font-semibold text-white shadow-xs transition hover:bg-[#062447]"
      >
        + Nuevo ensayo
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Crear nuevo ensayo">
          <div
            className="fixed inset-0 bg-[#1c1917]/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 flex h-full w-full max-w-xl flex-col bg-[#f7f6f2] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#e7e5df] bg-white px-5 py-4">
              <div>
                <h2 className="text-lg font-bold text-[#1c1917]">Crear ensayo</h2>
                <p className="text-xs text-[#57534e]">Configura las preguntas, el curso y la clave de respuestas.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar panel"
                className="rounded-lg border border-[#d6d3cb] bg-white px-3 py-1.5 text-xs font-semibold text-[#44403c] hover:bg-[#f7f6f2]"
              >
                Cerrar
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
