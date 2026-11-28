"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { DashboardActionState } from "@/app/dashboard/actions";
import { ActionButton } from "@/components/dashboard/ActionButton";

/** Alto aproximado del menu completo, para decidir si abre hacia arriba. */
const ALTO_MENU = 200;

type ActionFn = (state: DashboardActionState, formData: FormData) => Promise<DashboardActionState>;

export function QuizRowActions({
  quizId,
  quizTitle,
  hasPapers,
  isAdmin,
  isOwner,
  duplicateAction,
  archiveAction,
}: {
  quizId: string;
  quizTitle: string;
  hasPapers: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  duplicateAction: ActionFn;
  archiveAction: ActionFn;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top?: number; bottom?: number; right: number }>({ right: 8 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // El menu se dibuja en document.body (como RowMenu): dentro de la tabla, su
  // overflow-x-auto lo recortaba y no se alcanzaba ninguna opcion.
  const abrir = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const right = Math.max(8, window.innerWidth - rect.right);
    const haciaArriba = window.innerHeight - rect.bottom < ALTO_MENU && rect.top > ALTO_MENU;
    setCoords(haciaArriba ? { bottom: window.innerHeight - rect.top + 6, right } : { top: rect.bottom + 6, right });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    // La confirmacion vive dentro del menu: mientras este abierta no se cierra,
    // porque se desmontaria a mitad de camino.
    const hayDialogo = () => Boolean(panelRef.current?.querySelector('[role="dialog"]'));
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !hayDialogo()) setOpen(false);
    };
    const onMove = () => {
      if (!hayDialogo()) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  const excelHref = `/api/export/results/${quizId}?cols=rut,student_name,correct&fmt=xlsx`;
  const diaHref = `/api/quiz/${quizId}/export-dia`;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : abrir())}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Más acciones para ${quizTitle}`}
        className="rounded-lg border border-[#d6d3cb] bg-white px-2.5 py-1.5 text-xs font-bold text-[#44403c] hover:bg-[#f7f6f2]"
      >
        ⋯
      </button>

      {open && createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={{ position: "fixed", ...coords }}
          className="z-[70] w-56 rounded-xl border border-[#e7e5df] bg-white p-1.5 text-left shadow-lg"
        >
          <a
            href={hasPapers ? diaHref : undefined}
            aria-disabled={!hasPapers}
            onClick={() => setOpen(false)}
            role="menuitem"
            className={`block rounded-lg px-3 py-2 text-xs font-semibold ${
              hasPapers ? "text-[#07305f] hover:bg-[#eef4ff]" : "pointer-events-none text-[#a8a29e]"
            }`}
          >
            Exportar formato DIA
          </a>

          {isAdmin && (
            <a
              href={hasPapers ? excelHref : undefined}
              aria-disabled={!hasPapers}
              onClick={() => setOpen(false)}
              role="menuitem"
              className={`block rounded-lg px-3 py-2 text-xs font-semibold ${
                hasPapers ? "text-[#07305f] hover:bg-[#eef4ff]" : "pointer-events-none text-[#a8a29e]"
              }`}
            >
              RUT / Nombre / Correctas (Excel)
            </a>
          )}

          {isOwner && (
            <div className="my-1 border-t border-[#efede8] pt-1">
              <ActionButton
                action={duplicateAction}
                fields={{ id: quizId }}
                label="Duplicar ensayo"
                pendingLabel="Duplicando…"
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#1c1917] hover:bg-[#faf9f6]"
              />
              <ActionButton
                action={archiveAction}
                fields={{ id: quizId }}
                label="Archivar ensayo"
                pendingLabel="Archivando…"
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                confirm={`¿Archivar "${quizTitle}"? Podrás recuperarlo desde archivados.`}
                confirmTitle="¿Archivar ensayo?"
                confirmLabel="Archivar"
              />
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
