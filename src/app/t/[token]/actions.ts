"use server";

import { createSupabaseServerClient } from "@/lib/supabase_server";
import { rateLimit } from "@/lib/rateLimit";

export async function replyTicketAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const token = String(formData.get("token") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!token || !body) {
    throw new Error("Falta el token o el mensaje.");
  }
  if (body.length > 10000) throw new Error("El mensaje supera el largo permitido.");
  const limit = await rateLimit({ key: `support:reply:${token}`, windowMs: 60 * 60 * 1000, max: 20 });
  if (!limit.success) throw new Error("Has alcanzado el límite temporal de respuestas.");

  const { error } = await supabase.rpc("reply_ticket_by_token", {
    p_token: token,
    p_body: body,
  });

  if (error) {
    throw new Error(`Error al enviar mensaje: ${error.message}`);
  }
}
