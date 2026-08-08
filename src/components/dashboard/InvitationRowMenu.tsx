"use client";

import { useActionState, useState } from "react";
import { resendInvitation, deleteInvitation, type DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ConfirmDialog } from "@/components/dashboard/ConfirmDialog";
import { RowMenu, RowMenuItem, RowMenuDivider } from "@/components/dashboard/RowMenu";

const idleState: DashboardActionState = { status: "idle" };

// El estado de cada accion (toast, confirm) vive aca, en el padre del
// RowMenu -- si viviera dentro de los items del menu, se perderia al
// cerrarse (el panel del menu se desmonta al cerrar).
export function InvitationRowMenu({ id, email, link }: { id: string; email: string; link: string }) {
  const [copyState, setCopyState] = useState<DashboardActionState>(idleState);
  const [resendState, dispatchResend, resendPending] = useActionState(resendInvitation, idleState);
  const [deleteState, dispatchDelete, deletePending] = useActionState(deleteInvitation, idleState);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState({ status: "success", title: "Enlace copiado", message: `Comparte este link con ${email}.`, emoji: "🔗", key: Date.now() });
    } catch {
      setCopyState({ status: "error", title: "No se pudo copiar", message: "Copia el enlace manualmente desde la barra de direcciones.", emoji: "!", key: Date.now() });
    }
  };

  const handleResend = () => {
    const formData = new FormData();
    formData.set("id", id);
    dispatchResend(formData);
  };

  const handleDeleteConfirm = () => {
    setConfirmDeleteOpen(false);
    const formData = new FormData();
    formData.set("id", id);
    dispatchDelete(formData);
  };

  return (
    <>
      <RowMenu label={`Opciones para ${email}`}>
        <RowMenuItem onClick={handleCopy}>Copiar enlace</RowMenuItem>
        <RowMenuItem onClick={handleResend} disabled={resendPending}>
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
