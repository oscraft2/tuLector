import { NextResponse } from "next/server";
import { getFlowPaymentStatus } from "@/lib/flow";
import { applyVerifiedPayment, recordVerifiedFailure } from "@/lib/billing_webhook";

export async function POST(request: Request) {
  try {
    const token = new URLSearchParams(await request.text()).get("token");
    if (!token) return NextResponse.json({ error: "Falta token" }, { status: 400 });
    // No event lock before verification: pending statuses and transient failures must remain retryable.
    const payment = await getFlowPaymentStatus(token);
    if (payment.status !== 2) {
      if (payment.status === 3 || payment.status === 4) await recordVerifiedFailure({
        orderId: payment.commerceOrder, amountCents: Math.round(payment.amount * 100),
        currency: payment.currency, gateway: "flow", paymentId: token,
      });
      return NextResponse.json({ status: payment.status === 1 ? "pending" : "failed" });
    }
    return NextResponse.json(await applyVerifiedPayment({
      orderId: payment.commerceOrder, amountCents: Math.round(payment.amount * 100),
      currency: payment.currency, gateway: "flow", paymentId: token,
    }));
  } catch (error) {
    console.error("[flow_webhook]", error);
    return NextResponse.json({ error: "No se pudo confirmar el pago; se puede reintentar." }, { status: 500 });
  }
}
