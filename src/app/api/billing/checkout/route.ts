import { NextResponse } from "next/server";
import { getDashboardContext } from "@/lib/supabase_server";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createFlowPayment } from "@/lib/flow";
import { createMercadoPagoPreference } from "@/lib/mercadopago";

export async function POST(request: Request) {
  try {
    const { school, user } = await getDashboardContext();
    const payload = await request.json();

    const type = payload.type as "plan" | "scan_pack";
    const plan = (payload.plan as "pro" | "school") || "pro";
    const scansAdded = type === "scan_pack" ? Number(payload.scans_added || 500) : 0;

    const country = (school.country_code || "CL").toUpperCase();

    // 1. Resolve pricing & currency by country
    let currency = "usd";
    let amount = 0; // in main currency unit (e.g. 19900)
    let gateway: "flow" | "mercadopago" | "stripe" = "stripe";
    let description = "";

    if (country === "CL") {
      gateway = "flow";
      currency = "clp";
      if (type === "plan") {
        amount = plan === "pro" ? 19900 : 99000;
        description = `Suscripción Mensual - Plan ${plan.toUpperCase()}`;
      } else {
        amount = scansAdded === 1000 ? 18000 : 10000;
        description = `Paquete de ${scansAdded} escaneos OMR`;
      }
    } else if (["MX", "BR", "CO", "AR", "PE"].includes(country)) {
      gateway = "mercadopago";
      if (country === "MX") {
        currency = "mxn";
        amount = type === "plan" ? (plan === "pro" ? 490 : 2490) : (scansAdded === 1000 ? 450 : 250);
      } else if (country === "BR") {
        currency = "brl";
        amount = type === "plan" ? (plan === "pro" ? 149 : 749) : (scansAdded === 1000 ? 140 : 79);
      } else if (country === "CO") {
        currency = "cop";
        amount = type === "plan" ? (plan === "pro" ? 99000 : 490000) : (scansAdded === 1000 ? 89000 : 49000);
      } else {
        currency = "usd"; // Fallback LATAM
        amount = type === "plan" ? (plan === "pro" ? 25 : 120) : (scansAdded === 1000 ? 20 : 12);
      }
      description = type === "plan" ? `Suscripción - Plan ${plan.toUpperCase()}` : `Paquete de ${scansAdded} escaneos OMR`;
    } else {
      gateway = "stripe";
      currency = "usd";
      amount = type === "plan" ? (plan === "pro" ? 25 : 120) : (scansAdded === 1000 ? 20 : 12);
      description = type === "plan" ? `Suscripción - Plan ${plan.toUpperCase()}` : `Paquete de ${scansAdded} escaneos OMR`;
    }

    const amountCents = Math.round(amount * 100);

    // 2. Insert pending order in Database using Admin Client (bypass RLS)
    const admin = createSupabaseAdminClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        school_id: school.id,
        type,
        status: "pending",
        scans_added: type === "plan" ? (plan === "pro" ? 1000 : 10000) : scansAdded,
        amount_cents: amountCents,
        currency,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      console.error("[checkout] error al registrar orden:", orderError?.message);
      return NextResponse.json({ error: "No se pudo registrar la orden de pago" }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // 3. Initiate payment gateway session
    let redirectUrl = "";
    let sessionToken = "";

    if (gateway === "flow") {
      const flowResult = await createFlowPayment({
        amount,
        email: user.email || "",
        subject: description,
        commerceOrder: order.id,
        urlConfirmation: `${siteUrl}/api/billing/webhook/flow`,
        urlReturn: `${siteUrl}/dashboard/billing?order_id=${order.id}`,
      });
      redirectUrl = flowResult.url;
      sessionToken = flowResult.token;
    } else if (gateway === "mercadopago") {
      const mpResult = await createMercadoPagoPreference({
        title: description,
        unitPrice: amount,
        currencyId: currency.toUpperCase(),
        externalReference: order.id,
        notificationUrl: `${siteUrl}/api/billing/webhook/mercadopago`,
        backUrl: `${siteUrl}/dashboard/billing?order_id=${order.id}`,
        schoolId: school.id,
      });
      redirectUrl = mpResult.url;
      sessionToken = mpResult.preferenceId;
    } else {
      // Mock / Actual Stripe flow
      redirectUrl = `${siteUrl}/api/billing/mock-payment?gateway=stripe&token=stripe_sess_${order.id}&orderId=${order.id}`;
      sessionToken = `stripe_sess_${order.id}`;
    }

    // 4. Update the order with the session token / reference ID
    await admin
      .from("orders")
      .update({
        stripe_checkout_session_id: sessionToken,
      })
      .eq("id", order.id);

    return NextResponse.json({ url: redirectUrl });
  } catch (err: any) {
    console.error("[checkout] error crítico:", err);
    return NextResponse.json({ error: err.message || "Excepción de servidor" }, { status: 500 });
  }
}
