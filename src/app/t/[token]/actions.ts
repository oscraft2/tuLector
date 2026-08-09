"use server";

import { createSupabaseServerClient } from "@/lib/supabase_server";

export async function replyTicketAction(formData: FormData) {
  const supabase = createSupabaseServerClient();
  const token = String(formData.get("token") ?? "");
  const body = String(formData.get("body") ?? "").trim();

  if (!token || !body) {
    throw new Error("Falta el token o el mensaje.");
  }

  const { error } = await supabase.rpc("reply_ticket_by_token", {
    p_token: token,
    p_body: body,
  });

  if (error) {
    throw new Error(`Error al enviar mensaje: ${error.message}`);
  }
}
