"use server";

import { createSupabaseServerClient } from "@/lib/supabase_server";
import { getSiteUrl } from "@/lib/site_url";
import { sendTemplatedEmail } from "@/lib/email";
import { getDashboardContext } from "@/lib/supabase_server";

const LOCALES = new Set(["es-CL", "es-MX", "es-PE", "es-AR", "pt-BR"]);

function readTicketInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const localeValue = String(formData.get("locale") ?? "es-CL").trim();
  const locale = LOCALES.has(localeValue) ? localeValue : "es-CL";

  if (!name || !email || !subject || !message) throw new Error("Todos los campos son obligatorios.");
  if (name.length > 120 || email.length > 320 || subject.length > 160 || message.length > 10000) {
    throw new Error("Uno de los campos supera el largo permitido.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ingresa un correo válido.");
  return { name, email, subject, message, locale };
}

async function sendTicketEmail(email: string, subject: string, locale: string, token: string) {
  const siteUrl = getSiteUrl();
  await sendTemplatedEmail({
    to: email,
    templateKey: "ticket_created",
    locale,
    variables: { ticket_subject: subject, ticket_link: `${siteUrl}/t/${token}` },
  });
}

export async function createTicketAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();

  const { name, email, subject, message, locale } = readTicketInput(formData);

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
  await sendTicketEmail(email, subject, locale, ticket.token);

  return ticket.token;
}

export async function createAuthenticatedTicketAction(formData: FormData) {
  const { school, user, locale: dashboardLocale } = await getDashboardContext();
  const input = readTicketInput(formData);
  const supabase = await createSupabaseServerClient();
  const locale = LOCALES.has(dashboardLocale) ? dashboardLocale : input.locale;
  const email = user.email ?? input.email;

  const { data: ticket, error: ticketError } = await supabase
    .from("support_tickets")
    .insert({
      school_id: school.id,
      user_id: user.id,
      subject: input.subject,
      name: input.name,
      email,
      locale,
      status: "open",
      priority: "normal",
    })
    .select("id, token")
    .single();

  if (ticketError || !ticket) throw new Error("No se pudo crear el ticket.");

  const { error: messageError } = await supabase.from("support_ticket_messages").insert({
    ticket_id: ticket.id,
    author_type: "customer",
    author_id: user.id,
    body: input.message,
  });
  if (messageError) throw new Error("El ticket se creó, pero no se pudo guardar el mensaje.");

  await sendTicketEmail(email, input.subject, locale, ticket.token);
  return ticket.token;
}
