"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Menu de opciones "..." para una fila de tabla (reenviar, copiar, eliminar).
 * Cierra al hacer click afuera o con Escape. Los items van como children --
 * usar RowMenuItem para texto simple, o un ActionButton con className de
 * item para acciones que necesitan confirmacion/estado de carga. */
export function RowMenu({ children, label = "Mas opciones" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block text-left" onClick={() => setOpen(false)}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={label}
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold leading-none text-[#5b6472] hover:bg-[#f4f6f8] hover:text-[#111827]"
      >
        ⋮
      </button>
      {open ? (
        <div
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border border-[#e1e5ea] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.16)]"
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export const ROW_MENU_ITEM_CLS = "block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#1f2937] hover:bg-[#f4f6f8]";
export const ROW_MENU_ITEM_DANGER_CLS = "block w-full rounded-md px-3 py-2 text-left text-sm font-medium text-[#b42318] hover:bg-[#fef2f2]";

export function RowMenuItem({ onClick, children, danger }: { onClick: () => void; children: ReactNode; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={danger ? ROW_MENU_ITEM_DANGER_CLS : ROW_MENU_ITEM_CLS} role="menuitem">
      {children}
    </button>
  );
}
