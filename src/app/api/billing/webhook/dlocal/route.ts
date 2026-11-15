import { NextResponse } from "next/server";
import { getDlocalPaymentStatus } from "@/lib/dlocal";
import { applyVerifiedPayment, recordVerifiedFailure } from "@/lib/billing_webhook";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => null);
    const rawId = body?.id ?? body?.payment_id ?? url.searchParams.get("payment_id") ?? url.searchParams.get("id");
    if (typeof rawId !== "string" || !rawId || rawId.length > 200 || !/^[A-Za-z0-9_-]+$/.test(rawId)) {
      return NextResponse.json({ error: "payment_id invalido" }, { status: 400 });
    }
    const payment = await getDlocalPaymentStatus(rawId);
    if (payment.status !== "PAID") {
      if (["REJECTED", "CANCELLED", "EXPIRED"].includes(payment.status)) await recordVerifiedFailure({
        orderId: payment.orderId, amountCents: Math.round(payment.amount * 100),
        currency: payment.currency, gateway: "dlocal", paymentId: rawId,
      });
      return NextResponse.json({ status: "pending_or_failed" });
    }
    return NextResponse.json(await applyVerifiedPayment({
      orderId: payment.orderId, amountCents: Math.round(payment.amount * 100),
      currency: payment.currency, gateway: "dlocal", paymentId: rawId,
    }));
  } catch (error) {
    console.error("[dlocal_webhook]", error);
    return NextResponse.json({ error: "No se pudo confirmar el pago; se puede reintentar." }, { status: 500 });
  }
}
