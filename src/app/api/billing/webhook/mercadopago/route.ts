import { NextResponse } from "next/server";
import { getMercadoPagoPayment } from "@/lib/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTemplatedEmail } from "@/lib/email";
import { resolveLocaleForCountry } from "@/lib/country_profiles";
import { markOrderPaidAndApplyEntitlement, sendOrderReceiptIfNeeded, notifyPaymentFailed } from "@/lib/billing_orders";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    let topic = url.searchParams.get("topic");
    let paymentId = url.searchParams.get("id");

    // Handle JSON body for newer webhooks
    if (!topic || !paymentId) {
      try {
        const body = await request.json();
        if (body.type === "payment" || body.action?.startsWith("payment.")) {
          topic = "payment";
          paymentId = body.data?.id || body.id;
        }
      } catch {
        // Body reading failed or empty, ignore
      }
    }

    if (topic !== "payment" || !paymentId) {
      // Return 200 to acknowledge receipt of other topics (e.g. merchant_order)
      return NextResponse.json({ status: "ignored", reason: "not a payment topic" });
    }

    // 1. Fetch real payment details from MercadoPago
    const payment = await getMercadoPagoPayment(paymentId);
    const admin = createSupabaseAdminClient();

    if (payment.status !== "approved") {
      console.log(`[mp_webhook] pago no aprobado (status: ${payment.status}) para ID: ${paymentId}`);
      // "rejected" explicito -> avisar. "pending"/otros quedan silenciosos
      // (no son "pago no completado" en el mismo sentido).
      if (payment.status === "rejected" && payment.externalReference) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await notifyPaymentFailed(admin, payment.externalReference, "MercadoPago", "Rechazado", siteUrl);
      }
      return NextResponse.json({ status: "processed", detail: `pago no aprobado: ${payment.status}` });
    }

    const orderId = payment.externalReference;
    const result = await markOrderPaidAndApplyEntitlement(admin, orderId, {
      expectedAmountCents: Math.round(payment.amount * 100),
      billingPeriodMonths: 12,
    });

    if (result.alreadyProcessed) {
      return NextResponse.json({ status: "already_processed" });
    }

    const { order, school, extraScans, targetPlan } = result;
    const orderCurrency = String(order.currency || "usd").toUpperCase();
    const planOrPack = order.type === "plan" ? `Plan ${(targetPlan || "pro").toUpperCase()}` : `Paquete de ${extraScans} escaneos`;

    // Send confirmation email to admins
    const { data: members } = await admin
      .from("school_members")
      .select("user_id")
      .eq("school_id", school.id)
      .eq("role", "admin");

    if (members && members.length > 0) {
      const adminUserIds = members.map((m) => m.user_id);
      const { data: usersData } = await admin.auth.admin.listUsers();
      if (usersData) {
        const emails = usersData.users
          .filter((u) => adminUserIds.includes(u.id) && u.email)
          .map((u) => u.email!);

        const formattedAmount = `${(Number(order.amount_cents ?? 0) / 100).toFixed(2)} ${orderCurrency}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        const locale = resolveLocaleForCountry(school.country_code);

        for (const email of emails) {
          await sendTemplatedEmail({
            to: email,
            templateKey: "payment_success",
            locale,
            variables: {
              school_name: school.name,
              plan_or_pack: planOrPack,
              amount: formattedAmount,
              transaction_id: paymentId,
              payment_method: `MercadoPago (${payment.paymentMethod})`,
              dashboard_link: `${siteUrl}/dashboard`,
            },
          });
        }

        // Enviar comprobante formal solo si aun no se ha enviado (antes solo
        // lo hacia el webhook de Flow -- asimetria detectada en la auditoria
        // de correo, un colegio pagando por MercadoPago nunca lo recibia).
        const receiptResult = await sendOrderReceiptIfNeeded(admin, orderId, planOrPack, "MercadoPago", siteUrl);
        if (!receiptResult.sent && !receiptResult.alreadySent) {
          console.warn("[mp_webhook] no se pudo enviar comprobante:", receiptResult.error);
        }
      }
    }

    return NextResponse.json({ status: "success", order_id: orderId });
  } catch (err: unknown) {
    console.error("[mp_webhook] error crítico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepción de servidor" }, { status: 500 });
  }
}
