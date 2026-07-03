"use client";

import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Diálogo de confirmación in-app (reemplaza al window.confirm nativo del
 * navegador). Overlay + tarjeta centrada, cierre con Escape o click afuera. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  pending = false,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Cerrar con Escape (si no está procesando).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-[#0b1220]/50 backdrop-blur-[2px] animate-in fade-in duration-150"
        onClick={() => !pending && onCancel()}
      />
      {/* Tarjeta */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-xl border border-[#e6e8eb] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] animate-in fade-in zoom-in-95 duration-150">
        <div className={danger ? "h-1.5 bg-[#b42318]" : "h-1.5 bg-[#07305f]"} />
        <div className="p-5">
          <div className="flex gap-3">
            <div
              className={
                danger
                  ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fee2e2] text-lg text-[#991b1b]"
                  : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e4eeff] text-lg text-[#07305f]"
              }
              aria-hidden="true"
            >
              {danger ? "🗑" : "?"}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-[#111827]">{title}</h3>
              {message ? <p className="mt-1 text-sm leading-5 text-[#5b6472]">{message}</p> : null}
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={pending}
              className="rounded-md border border-[#cfd6df] px-4 py-2 text-sm font-semibold text-[#374151] hover:bg-[#f4f6f8] disabled:opacity-50"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={pending}
              aria-busy={pending}
              className={
                danger
                  ? "rounded-md bg-[#b42318] px-4 py-2 text-sm font-semibold text-white hover:bg-[#991b1b] disabled:opacity-60"
                  : "rounded-md bg-[#07305f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062447] disabled:opacity-60"
              }
            >
              {pending ? "Procesando…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
