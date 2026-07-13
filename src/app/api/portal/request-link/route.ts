import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { validateNationalIdFormat, normalizeNationalId } from "@/lib/national_id";

export const dynamic = "force-dynamic";

// Respuesta GENERICA siempre: no revela si el ID matchea o no un alumno
// registrado (evita enumeracion de RUTs/DNIs validos en el sistema).
const GENERIC_MESSAGE = "Si el ID coincide con un alumno registrado, te enviamos un correo con el enlace de acceso.";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { countryCode?: string; nationalId?: string; email?: string } | null;
    const countryCode = String(body?.countryCode ?? "").trim().toUpperCase();
    const nationalIdRaw = String(body?.nationalId ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Ingresa un correo valido" }, { status: 400 });
    }
    if (!validateNationalIdFormat(nationalIdRaw, countryCode)) {
      return NextResponse.json({ error: "El ID no tiene el formato esperado para ese pais" }, { status: 400 });
    }

    const normalized = normalizeNationalId(nationalIdRaw);
    const admin = createSupabaseAdminClient();

    const { data: matches, error: matchError } = await admin
      .from("students")
      .select("id")
      .eq("national_id_normalized", normalized);
    if (matchError) throw matchError;

    if (matches && matches.length > 0) {
      const studentIds = matches.map((m) => m.id as string);
      const { error: pendingError } = await admin.from("guardian_pending_links").insert({
        email,
        country_code: countryCode,
        national_id_normalized: normalized,
        student_ids: studentIds,
      });
      if (pendingError) throw pendingError;

      const { error: otpError } = await admin.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${new URL(request.url).origin}/portal/auth/callback` },
      });
      if (otpError) throw otpError;
    }

    return NextResponse.json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("[portal/request-link]", error);
    return NextResponse.json({ error: "No se pudo procesar la solicitud" }, { status: 500 });
  }
}
