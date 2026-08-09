import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Crea la cuenta de un docente invitado ya CONFIRMADA (email_confirm: true)
 * y salta el correo de confirmacion de Supabase Auth -- el email ya fue
 * vetado por el admin al crear la invitacion (ver /api/invitations/[id]
 * para la validacion previa que ve el usuario en /auth), asi que pedirle
 * ademas que confirme el correo es friccion redundante, y ese correo de
 * confirmacion lo manda la infraestructura propia de Supabase (no Resend),
 * separada de la que ya arreglamos para las invitaciones.
 *
 * El insert en auth.users sigue disparando el trigger handle_new_user()
 * (supabase/migrations/20260626170000_invite_accept_flow.sql), que vincula
 * al colegio de la invitacion por email exacto -- misma logica que ya
 * corria con signUp normal, sin duplicarla aca.
 */
export async function POST(request: Request) {
  try {
    const { inviteId, password } = (await request.json()) as { inviteId?: string; password?: string };
    if (!inviteId || !password || password.length < 12) {
      return NextResponse.json({ error: "Datos invalidos." }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();

    const { data: invite } = await admin
      .from("invitations")
      .select("id, email, status, expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite || invite.status !== "pending" || new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ error: "Esta invitacion ya no es valida." }, { status: 400 });
    }

    const { data: created, error } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
    });

    if (error) {
      const alreadyExists = /already|existe/i.test(error.message);
      return NextResponse.json(
        { error: alreadyExists ? "Ya existe una cuenta con este correo. Inicia sesion normalmente." : error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, email: created.user?.email ?? invite.email });
  } catch (error) {
    console.error("[api/invitations/accept]", error);
    return NextResponse.json({ error: "No se pudo crear la cuenta." }, { status: 500 });
  }
}
