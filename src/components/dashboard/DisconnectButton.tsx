"use client";

import { useState, useTransition } from "react";
import { disconnectSchool } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";

export function DisconnectButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await disconnectSchool();
      } catch {
        /* la server action redirige (NEXT_REDIRECT) */
      }
    });
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={pending}
        aria-busy={pending}
        className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Desvinculando…" : "Desvincular institución"}
      </button>
      <ConfirmDialog
        open={open}
        title="¿Desvincular institución?"
        message="Perderás acceso inmediato a sus ensayos, alumnos y reportes. Serás redirigido para seleccionar o crear otro colegio."
        confirmLabel="Desvincular"
        pending={pending}
        danger
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
