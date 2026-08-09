import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * Vincula al usuario YA AUTENTICADO (sesion real, no solo el correo que
 * escribio en un formulario) al colegio de una invitacion pendiente. Existe
 * para el caso "el correo invitado ya tenia cuenta en TuLector" -- ahi
 * handle_new_user() (el trigger que vincula en el registro normal, ver
 * supabase/migrations/20260626170000_invite_accept_flow.sql) nunca corre
 * porque no hay un INSERT nuevo en auth.users, asi que hay que hacer el
 * mismo trabajo (school_members + marcar aceptada) a mano aca.
 *
 * Seguridad: la sesion tiene que venir de una autenticacion real (login o
 * signup) hecha por el cliente antes de llamar esto -- este endpoint solo
 * confirma que el email de esa sesion coincide con el de la invitacion, y
 * usa el admin client (service role) para escribir, igual que hace el
 * trigger (SECURITY DEFINER).
 */
export async function POST(request: Request) {
  try {
    const { inviteId } = (await request.json()) as { inviteId?: string };
    if (!inviteId) {
      return NextResponse.json({ error: "Falta la invitacion." }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: "Debes iniciar sesion primero." }, { status: 401 });
    }

    const admin = createSupabaseAdminClient();

    const { data: invite } = await admin
      .from("invitations")
      .select("id, school_id, role, email, status, expires_at")
      .eq("id", inviteId)
      .maybeSingle();

    if (!invite || invite.status !== "pending" || new Date(invite.expires_at) <= new Date()) {
      return NextResponse.json({ error: "Esta invitacion ya no es valida." }, { status: 400 });
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Esta invitacion es para otro correo." }, { status: 403 });
    }

    const { error: memberError } = await admin
      .from("school_members")
      .upsert({ school_id: invite.school_id, user_id: user.id, role: invite.role }, { onConflict: "school_id,user_id" });
    if (memberError) throw new Error(memberError.message);

    await admin.from("invitations").update({ status: "accepted", revoked_at: new Date().toISOString() }).eq("id", invite.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[api/invitations/link]", error);
    return NextResponse.json({ error: "No se pudo vincular la cuenta al colegio." }, { status: 500 });
  }
}
