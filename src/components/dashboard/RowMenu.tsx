"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Menu de opciones "..." para una fila de tabla. Se renderiza en un portal
 * a document.body y se posiciona con coordenadas fijas del boton que lo
 * abre -- evita que lo recorte el overflow-x-auto de las tablas (DataTable).
 * Los items van como children (RowMenuItem) y viven fuera de este
 * componente en el arbol de React solo visualmente: el estado de cada
 * accion (toast, confirm) debe vivir en el padre para no perderse al
 * cerrar el menu. */
export function RowMenu({ children, label = "Mas opciones" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.bottom + 6, right: Math.max(8, window.innerWidth - rect.right) });
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onScrollOrResize() {
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        aria-label={label}
        aria-expanded={open}
        className={
          open
            ? "flex h-8 w-8 items-center justify-center rounded-md bg-[#eef1f4] text-lg font-bold leading-none text-[#111827]"
            : "flex h-8 w-8 items-center justify-center rounded-md text-lg font-bold leading-none text-[#5b6472] transition-colors hover:bg-[#f4f6f8] hover:text-[#111827]"
        }
      >
        ⋮
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              style={{ position: "fixed", top: coords.top, right: coords.right }}
              className="z-[70] w-56 overflow-hidden rounded-lg border border-[#e1e5ea] bg-white py-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.18)] animate-in fade-in zoom-in-95 duration-100"
              role="menu"
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function RowMenuItem({ onClick, children, danger, disabled }: { onClick: () => void; children: ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="menuitem"
      className={
        danger
          ? "block w-full px-3.5 py-2.5 text-left text-sm font-medium text-[#b42318] transition-colors hover:bg-[#fef2f2] disabled:opacity-50"
          : "block w-full px-3.5 py-2.5 text-left text-sm font-medium text-[#1f2937] transition-colors hover:bg-[#f4f6f8] disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

export function RowMenuDivider() {
  return <div className="my-1 border-t border-[#eef0f3]" />;
}
