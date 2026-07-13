import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) return redirectToLogin(requestUrl.origin, "No se recibio codigo de autenticacion.");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user?.email) return redirectToLogin(requestUrl.origin, error?.message ?? "No se pudo iniciar sesion.");

  // Consume el vinculo pendiente mas reciente para este correo (creado en
  // /api/portal/request-link) y crea los guardian_links correspondientes.
  // Con service role: guardian_pending_links no tiene policy publica, y el
  // INSERT en guardian_links tampoco (solo hay policy de SELECT propia).
  try {
    const admin = createSupabaseAdminClient();
    const email = data.user.email.toLowerCase();

    const { data: pending } = await admin
      .from("guardian_pending_links")
      .select("id, student_ids")
      .eq("email", email)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.student_ids?.length) {
      const rows = (pending.student_ids as string[]).map((studentId) => ({
        auth_user_id: data.user!.id,
        student_id: studentId,
      }));
      await admin.from("guardian_links").upsert(rows, { onConflict: "auth_user_id,student_id", ignoreDuplicates: true });
      await admin.from("guardian_pending_links").delete().eq("id", pending.id);
    }
  } catch (linkError) {
    console.error("[portal/auth/callback] no se pudo vincular alumno", linkError);
    // No bloquea el login: si ya tenia guardian_links de antes, igual entra al portal.
  }

  return NextResponse.redirect(new URL("/portal", requestUrl.origin));
}

function redirectToLogin(origin: string, message: string) {
  const url = new URL("/portal/auth", origin);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
