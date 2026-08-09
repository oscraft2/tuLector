"use client";

import { useActionState, useRef, useState } from "react";
import { resendInvitation, deleteInvitation, type DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { RowMenu, RowMenuItem, RowMenuDivider } from "@/components/dashboard/RowMenu";

const idleState: DashboardActionState = { status: "idle" };

// El estado de cada accion (toast, confirm) vive aca, en el padre del
// RowMenu -- si viviera dentro de los items del menu, se perderia al
// cerrarse (el panel del menu se desmonta al cerrar). Reenviar/eliminar
// se disparan via <form>+requestSubmit() (no dispatch directo) -- mismo
// mecanismo que ActionButton, ya probado en el resto del dashboard.
export function InvitationRowMenu({ id, email, link }: { id: string; email: string; link: string }) {
  const [copyState, setCopyState] = useState<DashboardActionState>(idleState);
  const [resendState, resendAction, resendPending] = useActionState(resendInvitation, idleState);
  const [deleteState, deleteActionFn, deletePending] = useActionState(deleteInvitation, idleState);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const resendFormRef = useRef<HTMLFormElement>(null);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState({ status: "success", title: "Enlace copiado", message: `Comparte este link con ${email}.`, emoji: "🔗", key: Date.now() });
    } catch {
      setCopyState({ status: "error", title: "No se pudo copiar", message: "Copia el enlace manualmente desde la barra de direcciones.", emoji: "!", key: Date.now() });
    }
  };

  const handleDeleteConfirm = () => {
    setConfirmDeleteOpen(false);
    deleteFormRef.current?.requestSubmit();
  };

  return (
    <>
      <form ref={resendFormRef} action={resendAction} className="hidden">
        <input type="hidden" name="id" value={id} />
      </form>
      <form ref={deleteFormRef} action={deleteActionFn} className="hidden">
        <input type="hidden" name="id" value={id} />
      </form>

      <RowMenu label={`Opciones para ${email}`}>
        <RowMenuItem onClick={handleCopy}>Copiar enlace</RowMenuItem>
        <RowMenuItem onClick={() => resendFormRef.current?.requestSubmit()} disabled={resendPending}>
          {resendPending ? "Reenviando…" : "Reenviar correo"}
        </RowMenuItem>
        <RowMenuDivider />
        <RowMenuItem danger onClick={() => setConfirmDeleteOpen(true)} disabled={deletePending}>
          Eliminar invitacion
        </RowMenuItem>
      </RowMenu>

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="¿Eliminar invitacion?"
        message={`¿Eliminar la invitacion a ${email}? Vas a poder invitar de nuevo a este correo despues.`}
        confirmLabel="Eliminar"
        pending={deletePending}
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ActionFeedbackDialog state={copyState} />
      <ActionFeedbackDialog state={resendState} />
      <ActionFeedbackDialog state={deleteState} />
    </>
  );
}
