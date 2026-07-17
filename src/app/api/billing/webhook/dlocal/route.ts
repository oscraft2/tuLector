import { NextResponse } from "next/server";
import { getDlocalPaymentStatus } from "@/lib/dlocal";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTemplatedEmail } from "@/lib/email";
import { resolveLocaleForCountry } from "@/lib/country_profiles";
import { markOrderPaidAndApplyEntitlement, sendOrderReceiptIfNeeded, notifyPaymentFailed } from "@/lib/billing_orders";

export async function POST(request: Request) {
  try {
    let paymentId: string | null = null;
    try {
      const body = await request.json();
      paymentId = body?.id || body?.payment_id || null;
    } catch {
      const url = new URL(request.url);
      paymentId = url.searchParams.get("payment_id") || url.searchParams.get("id");
    }

    if (!paymentId) {
      return NextResponse.json({ error: "Falta payment_id" }, { status: 400 });
    }

    // 1. Consultar el estado real en dLocal para evitar spoofing del webhook.
    const payment = await getDlocalPaymentStatus(paymentId);
    const admin = createSupabaseAdminClient();

    if (payment.status !== "PAID") {
      console.log(`[dlocal_webhook] pago no aprobado (status: ${payment.status}) para orden: ${payment.orderId}`);
      // REJECTED/CANCELLED/EXPIRED son estados finales negativos -> avisar.
      // PENDING/AUTHORIZED quedan silenciosos (metodos de settlement diferido
      // como boleto/OXXO/Rapipago pasan por PENDING antes de confirmar).
      if (["REJECTED", "CANCELLED", "EXPIRED"].includes(payment.status) && payment.orderId) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
        await notifyPaymentFailed(admin, payment.orderId, "dLocal", "Rechazado", siteUrl);
      }
      return NextResponse.json({ status: "processed", detail: `pago no aprobado: ${payment.status}` });
    }

    const orderId = payment.orderId;
    const result = await markOrderPaidAndApplyEntitlement(admin, orderId, {
      expectedAmountCents: Math.round(payment.amount * 100),
      expectedCurrency: payment.currency,
      gateway: "dlocal",
      gatewayPaymentId: paymentId,
      billingPeriodMonths: 12,
    });

    if (result.alreadyProcessed) {
      return NextResponse.json({ status: "already_processed" });
    }

    const { order, school, extraScans, targetPlan } = result;
    const orderCurrency = String(order.currency || "usd").toUpperCase();
    const planOrPack = order.type === "plan" ? `Plan ${(targetPlan || "pro").toUpperCase()}` : `Paquete de ${extraScans} escaneos`;

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
              payment_method: "dLocal",
              dashboard_link: `${siteUrl}/dashboard`,
            },
          });
        }

        const receiptResult = await sendOrderReceiptIfNeeded(admin, orderId, planOrPack, "dLocal", siteUrl);
        if (!receiptResult.sent && !receiptResult.alreadySent) {
          console.warn("[dlocal_webhook] no se pudo enviar comprobante:", receiptResult.error);
        }
      }
    }

    return NextResponse.json({ status: "success", order_id: orderId });
  } catch (err: unknown) {
    console.error("[dlocal_webhook] error crítico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepción de servidor" }, { status: 500 });
  }
}
