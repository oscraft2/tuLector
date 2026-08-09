"use server";

import { createSupabaseServerClient } from "@/lib/supabase_server";
import { getSiteUrl } from "@/lib/site_url";
import { sendTemplatedEmail } from "@/lib/email";

export async function createTicketAction(formData: FormData) {
  const supabase = createSupabaseServerClient();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const locale = String(formData.get("locale") ?? "es-CL").trim();

  if (!name || !email || !subject || !message) {
    throw new Error("Todos los campos son obligatorios.");
  }

  // 1. Crear el ticket
  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      subject,
      name,
      email,
      locale,
      status: "open",
      priority: "normal",
      // school_id y user_id quedan en NULL
    })
    .select("id, token")
    .single();

  if (ticketError || !ticket) {
    throw new Error(`Error al crear el ticket: ${ticketError?.message || "Desconocido"}`);
  }

  // 2. Crear el primer mensaje del cliente usando el token para pasar RLS
  const { error: msgError } = await supabase.rpc("reply_ticket_by_token", {
    p_token: ticket.token,
    p_body: message,
  });

  if (msgError) {
    // Si falla el mensaje, idealmente haríamos rollback o lo logueamos, pero por ahora lanzamos error
    throw new Error(`Ticket creado pero falló al guardar el mensaje: ${msgError.message}`);
  }

  // 3. Enviar correo de confirmación
  const siteUrl = getSiteUrl();
  await sendTemplatedEmail({
    to: email,
    templateKey: "ticket_created",
    locale,
    variables: {
      ticket_subject: subject,
      ticket_link: `${siteUrl}/t/${ticket.token}`,
    }
  });

  return ticket.token;
}
