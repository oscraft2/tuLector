"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type SubmitButtonProps = {
  children: ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** Botón de submit con estado de carga automatico (useFormStatus). Debe ir DENTRO
 * de un <form> con action. Muestra pendingLabel + spinner mientras la accion corre. */
export function SubmitButton({ children, pendingLabel = "Guardando…", disabled, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const busy = pending;
  return (
    <button type="submit" disabled={busy || disabled} aria-busy={busy} className={className}>
      <span className="inline-flex items-center justify-center gap-2">
        {busy && (
          <span
            className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden="true"
          />
        )}
        {busy ? pendingLabel : children}
      </span>
    </button>
  );
}
