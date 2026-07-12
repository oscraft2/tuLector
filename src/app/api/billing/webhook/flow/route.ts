import { NextResponse } from "next/server";
import { getFlowPaymentStatus } from "@/lib/flow";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { sendTemplatedEmail } from "@/lib/email";
import { markOrderPaidAndApplyEntitlement, sendOrderReceiptIfNeeded } from "@/lib/billing_orders";

export async function POST(request: Request) {
  try {
    const textBody = await request.text();
    const params = new URLSearchParams(textBody);
    const token = params.get("token");

    if (!token) {
      return NextResponse.json({ error: "Falta token" }, { status: 400 });
    }

    // 1. Fetch real status from Flow to prevent spoofing
    const payment = await getFlowPaymentStatus(token);

    if (payment.status !== 2) {
      console.log(`[flow_webhook] pago no aprobado (status: ${payment.status}) para orden: ${payment.commerceOrder}`);
      return NextResponse.json({ status: "processed", detail: "pago no aprobado" });
    }

    const orderId = payment.commerceOrder;
    const admin = createSupabaseAdminClient();
    const result = await markOrderPaidAndApplyEntitlement(admin, orderId, {
      expectedAmountCents: Math.round(payment.amount * 100),
      expectedCurrency: "clp",
      gateway: "flow",
      gatewayPaymentId: token,
      billingPeriodMonths: 12,
    });

    const { order, school, extraScans, targetPlan } = result;
    const orderCurrency = String(order.currency || "clp").toUpperCase();
    const planOrPack = order.type === "plan" ? `Plan ${(targetPlan || "pro").toUpperCase()}` : `Paquete de ${extraScans} escaneos`;

    // Fetch admins to send confirmation email
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

        const formattedAmount = `$${(Number(order.amount_cents ?? 0) / 100).toLocaleString("es-CL")} ${orderCurrency}`;
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

        for (const email of emails) {
          await sendTemplatedEmail({
            to: email,
            templateKey: result.alreadyProcessed ? "payment_success" : "payment_success",
            locale: "es-CL",
            variables: {
              school_name: school.name,
              plan_or_pack: planOrPack,
              amount: formattedAmount,
              transaction_id: token,
              payment_method: "Flow (Chile)",
              dashboard_link: `${siteUrl}/dashboard`,
            },
          });
        }

        // Enviar comprobante formal solo si aun no se ha enviado.
        const receiptResult = await sendOrderReceiptIfNeeded(admin, orderId, planOrPack, "Flow (Chile)", siteUrl);
        if (!receiptResult.sent && !receiptResult.alreadySent) {
          console.warn("[flow_webhook] no se pudo enviar comprobante:", receiptResult.error);
        }
      }
    }

    return NextResponse.json({ status: "success", order_id: orderId });
  } catch (err: unknown) {
    console.error("[flow_webhook] error crítico:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Excepción de servidor" }, { status: 500 });
  }
}
