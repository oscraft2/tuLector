import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { publicLocales, type PublicLocale } from "@/lib/public_i18n";
import { normalizeRut, validateRut } from "@/lib/rut";
import { sendTemplatedEmail } from "@/lib/email";
import type { DashboardLocale } from "@/locales";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Locale del sitio publico (es/pt/en) -> locale que espera sendTemplatedEmail
// (es-CL/en/pt-BR, ver src/locales). Mapeo propio y chico: distinto del
// legacyToNew interno de public_i18n.ts, que resuelve textos del sitio
// marketing (otro catalogo), no plantillas de correo.
const NEWSLETTER_EMAIL_LOCALE: Record<PublicLocale, DashboardLocale> = { es: "es-CL", pt: "pt-BR", en: "en" };

function cleanText(value: unknown, maxLength: number) {
  const text = String(value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
  }

  const input = body as {
    email?: unknown;
    name?: unknown;
    institution?: unknown;
    institutionalRut?: unknown;
    role?: unknown;
    phone?: unknown;
    country?: unknown;
    locale?: unknown;
    source?: unknown;
    website?: unknown;
    consentMarketing?: unknown;
  };

  const email = String(input.email ?? "").trim().toLowerCase();
  const locale = publicLocales.includes(input.locale as PublicLocale) ? input.locale as PublicLocale : "es";
  const source = cleanText(input.source, 180) ?? "/";
  const honeypot = String(input.website ?? "").trim();
  const consentMarketing = input.consentMarketing !== false;

  if (honeypot) {
    return NextResponse.json({ ok: true });
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Ingresa un correo valido." }, { status: 400 });
  }

  if (!consentMarketing) {
    return NextResponse.json({ error: "Debes aceptar que te contactemos sobre TuLector." }, { status: 400 });
  }

  const name = cleanText(input.name, 120);
  const institution = cleanText(input.institution, 160);
  const role = cleanText(input.role, 100);
  const phone = cleanText(input.phone, 60);
  const country = cleanText(input.country, 80) ?? (locale === "pt" ? "Brasil" : locale === "en" ? "International" : "Chile");
  const rutInput = cleanText(input.institutionalRut, 20);
  const institutionalRut = rutInput ? normalizeRut(rutInput) : null;

  if (institutionalRut && !validateRut(institutionalRut)) {
    return NextResponse.json({ error: "Ingresa un RUT institucional valido o deja el campo vacio." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const now = new Date().toISOString();
    const consentText = "Solicito informacion sobre TuLector y autorizo el contacto comercial asociado a esta solicitud.";

    const { error } = await admin
      .from("contact_leads")
      .upsert({
        email,
        name,
        institution,
        institutional_rut: institutionalRut,
        role,
        phone,
        country,
        locale,
        source,
        status: "new",
        consent_marketing: true,
        consent_text: consentText,
        updated_at: now,
        metadata: {
          referer: request.headers.get("referer"),
          user_agent: request.headers.get("user-agent"),
          ip: forwardedFor || request.headers.get("x-real-ip"),
        },
      }, { onConflict: "email" });

    if (error) {
      console.error("[contact_leads] upsert failed", error);
      return NextResponse.json({ error: "No pudimos registrar tu solicitud. Intenta nuevamente." }, { status: 500 });
    }

    // Confirmacion simple (no doble opt-in): el lead ya quedo guardado, un
    // fallo de correo no debe bloquear la respuesta al usuario.
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      await sendTemplatedEmail({
        to: email,
        templateKey: "newsletter_confirm",
        locale: NEWSLETTER_EMAIL_LOCALE[locale],
        variables: {
          name_greeting: name ? `, ${name}` : "",
          info_link: `${siteUrl}/precios`,
        },
      });
    } catch (emailError) {
      console.warn("[contact_leads] fallo el correo de confirmacion:", emailError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[contact_leads] unexpected failure", error);
    return NextResponse.json({ error: "No pudimos registrar tu solicitud. Intenta nuevamente." }, { status: 500 });
  }
}


