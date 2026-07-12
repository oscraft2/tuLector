"use client";

import { useState, useTransition } from "react";
import { deleteMyAccount } from "@/app/dashboard/actions";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";

/** Botón "Eliminar mi cuenta" — requisito de Apple/Google para aprobar la app. */
export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        await deleteMyAccount();
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
        {pending ? "Eliminando…" : "Eliminar mi cuenta"}
      </button>
      <ConfirmDialog
        open={open}
        title="¿Eliminar tu cuenta?"
        message="Esta accion es permanente. Se eliminara tu perfil y acceso a TuLector con este correo. Los ensayos, alumnos y resultados del colegio no se borran, ya que pertenecen a la institucion."
        confirmLabel="Eliminar cuenta"
        pending={pending}
        danger
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}
