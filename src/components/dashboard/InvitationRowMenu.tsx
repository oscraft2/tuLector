"use client";

import { useState } from "react";
import { resendInvitation, deleteInvitation, type DashboardActionState } from "@/app/dashboard/actions";
import { ActionFeedbackDialog } from "@/components/dashboard/ActionFeedbackDialog";
import { ActionButton } from "@/components/dashboard/ActionButton";
import { RowMenu, RowMenuItem, ROW_MENU_ITEM_CLS, ROW_MENU_ITEM_DANGER_CLS } from "@/components/dashboard/RowMenu";

const idleState: DashboardActionState = { status: "idle" };

export function InvitationRowMenu({ id, email, link }: { id: string; email: string; link: string }) {
  const [copyState, setCopyState] = useState<DashboardActionState>(idleState);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState({ status: "success", title: "Enlace copiado", message: `Comparte este link con ${email}.`, emoji: "🔗", key: Date.now() });
    } catch {
      setCopyState({ status: "error", title: "No se pudo copiar", message: "Copia el enlace manualmente desde la barra de direcciones.", emoji: "!", key: Date.now() });
    }
  };

  return (
    <>
      <RowMenu label={`Opciones para ${email}`}>
        <RowMenuItem onClick={handleCopy}>Copiar enlace</RowMenuItem>
        <ActionButton action={resendInvitation} fields={{ id }} label="Reenviar correo" pendingLabel="Reenviando…" className={ROW_MENU_ITEM_CLS} />
        <ActionButton
          action={deleteInvitation}
          fields={{ id }}
          label="Eliminar invitacion"
          pendingLabel="Eliminando…"
          className={ROW_MENU_ITEM_DANGER_CLS}
          confirm={`¿Eliminar la invitacion a ${email}? Vas a poder invitar de nuevo a este correo despues.`}
          confirmTitle="¿Eliminar invitacion?"
          confirmLabel="Eliminar"
          danger
        />
      </RowMenu>
      <ActionFeedbackDialog state={copyState} />
    </>
  );
}
