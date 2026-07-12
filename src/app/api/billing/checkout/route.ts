import { NextResponse } from "next/server";
import { assertSchoolAdmin, getDashboardContext } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createFlowPayment, getFlowConfig } from "@/lib/flow";
import { canonicalRut } from "@/lib/rut";
import { isMissingColumnError } from "@/lib/supabase_errors";
import {
  readBillingDetailsPayload,
  parseBillingCheckoutInput,
  resolveBillingCatalogItem,
  type ChileanBillingDetails,
} from "@/lib/billing_catalog";

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function cleanEmail(value: unknown) {
  const email = cleanText(value, 160).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

async function parseChileanBillingDetails(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  payload: Record<string, unknown>,
  accountEmail: string,
): Promise<ChileanBillingDetails | null> {
  const taxIdInput = cleanText(payload.taxId ?? payload.tax_id, 20);
  const canonicalTaxId = taxIdInput ? canonicalRut(taxIdInput) : null;
  const legalName = cleanText(payload.legalName ?? payload.legal_name, 160);
  const businessActivity = cleanText(payload.businessActivity ?? payload.business_activity, 160);
  const email = accountEmail;
  const phone = cleanText(payload.phone, 40) || null;
  const addressLine = cleanText(payload.addressLine ?? payload.address_line, 180);
  const regionCode = cleanText(payload.regionCode ?? payload.region_code, 20).toUpperCase();
  const commune = cleanText(payload.commune ?? payload.comuna, 120).toUpperCase();

  if ((taxIdInput && !canonicalTaxId) || legalName.length < 3 || businessActivity.length < 3 || !email || addressLine.length < 5 || !regionCode || !commune) {
    return null;
  }

  const { data: communeRow, error } = await admin
    .from("comunas")
    .select("region_cod, region_nombre, comuna")
    .eq("region_cod", regionCode)
    .eq("comuna", commune)
    .maybeSingle();

  if (error || !communeRow) return null;

  return {
    taxId: canonicalTaxId,
    legalName,
    businessActivity,
    email,
    phone,
    addressLine,
    regionCode: communeRow.region_cod,
    regionName: communeRow.region_nombre || regionCode,
    commune: communeRow.comuna,
  };
}

export async function POST(request: Request) {
  try {
    const { school, user, isAdmin } = await getDashboardContext();
    try {
      assertSchoolAdmin(isAdmin);
    } catch {
      return NextResponse.json({ error: "Solo un administrador puede contratar planes o comprar escaneos." }, { status: 403 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: "El cuerpo de la solicitud no es JSON valido." }, { status: 400 });
    }

    const input = parseBillingCheckoutInput(payload);
    if (!input) {
      return NextResponse.json({ error: "Solicitud de pago invalida." }, { status: 400 });
    }

    const item = resolveBillingCatalogItem(input, school.country_code);
    if (item.gateway !== "flow") {
      return NextResponse.json({ error: "La pasarela para este pais aun no esta habilitada. Contactanos para activar pagos institucionales." }, { status: 501 });
    }

    const flowConfig = getFlowConfig();
    if (!flowConfig.configured && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Flow no esta configurado para pagos reales." }, { status: 503 });
    }
    if (flowConfig.sandbox && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Flow sandbox no esta permitido en produccion." }, { status: 503 });
    }

    const admin = createSupabaseAdminClient();
    const accountEmail = cleanEmail(user.email);
    if (!accountEmail) {
      return NextResponse.json({ error: "Tu cuenta no tiene un correo valido para iniciar el pago." }, { status: 422 });
    }

    const billingDetails = await parseChileanBillingDetails(admin, readBillingDetailsPayload(payload), accountEmail);
    if (!billingDetails) {
      return NextResponse.json({ error: "Completa datos de facturacion validos para Chile." }, { status: 422 });
    }

    let orderInsert = await admin
      .from("orders")
      .insert({
        school_id: school.id,
        type: item.type,
        status: "pending",
        scans_added: item.scansAdded,
        amount_cents: item.amountCents,
        currency: item.currency,
        billing_details: billingDetails,
      })
      .select("id")
      .single();

    if (orderInsert.error && isMissingColumnError(orderInsert.error, "billing_details")) {
      orderInsert = await admin
        .from("orders")
        .insert({
          school_id: school.id,
          type: item.type,
          status: "pending",
          scans_added: item.scansAdded,
          amount_cents: item.amountCents,
          currency: item.currency,
        })
        .select("id")
        .single();
    }

    const { data: order, error: orderError } = orderInsert;

    if (orderError || !order) {
      console.error("[checkout] error al registrar orden:", orderError?.message);
      return NextResponse.json({ error: "No se pudo registrar la orden de pago" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    let redirectUrl = "";
    let sessionToken = "";

    const flowResult = await createFlowPayment({
      amount: item.amount,
      email: accountEmail,
      subject: item.description,
      commerceOrder: order.id,
      urlConfirmation: `${siteUrl}/api/billing/webhook/flow`,
      urlReturn: `${siteUrl}/dashboard/billing?order_id=${order.id}`,
    });
    redirectUrl = flowResult.url;
    sessionToken = flowResult.token;

    await admin
      .from("orders")
      .update({
        stripe_checkout_session_id: sessionToken,
      })
      .eq("id", order.id);

    return NextResponse.json({ url: redirectUrl });
  } catch (err: unknown) {
    console.error("[checkout] error crítico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepción de servidor" }, { status: 500 });
  }
}
