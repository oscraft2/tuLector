import { NextResponse } from "next/server";
import { getMercadoPagoPayment } from "@/lib/mercadopago";
import { applyVerifiedPayment, recordVerifiedFailure } from "@/lib/billing_webhook";

import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    
    // Verificacion de firma
    const xSignature = request.headers.get("x-signature");
    const xRequestId = request.headers.get("x-request-id");
    if (xSignature && xRequestId && process.env.MERCADOPAGO_WEBHOOK_SECRET) {
      let ts = "", v1 = "";
      for (const p of xSignature.split(",")) {
        const [k, v] = p.split("=");
        if (k === "ts") ts = v;
        if (k === "v1") v1 = v;
      }
      if (ts && v1) {
        if (Math.abs(Date.now() - parseInt(ts, 10)) > 300000) {
          return NextResponse.json({ error: "Firma expirada" }, { status: 400 });
        }
        const dataId = url.searchParams.get("data.id") || url.searchParams.get("id") || "";
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
        const hmac = crypto.createHmac("sha256", process.env.MERCADOPAGO_WEBHOOK_SECRET);
        const digest = hmac.update(manifest).digest("hex");
        try {
          if (!crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(digest))) {
            return NextResponse.json({ error: "Firma invalida" }, { status: 403 });
          }
        } catch {
          return NextResponse.json({ error: "Firma malformada" }, { status: 403 });
        }
      }
    }

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

    const payment = await getMercadoPagoPayment(String(paymentId));
    if (payment.status !== "approved") {
      if (payment.status === "rejected") await recordVerifiedFailure({
        orderId: payment.externalReference, amountCents: Math.round(payment.amount * 100),
        currency: String(payment.raw.currency_id || ""), gateway: "mercadopago", paymentId: String(paymentId),
      });
      return NextResponse.json({ status: "pending_or_failed" });
    }
    return NextResponse.json(await applyVerifiedPayment({
      orderId: payment.externalReference, amountCents: Math.round(payment.amount * 100),
      currency: String(payment.raw.currency_id || ""), gateway: "mercadopago", paymentId: String(paymentId),
    }));
  } catch (error) {
    console.error("[mp_webhook]", error);
    return NextResponse.json({ error: "No se pudo confirmar el pago; se puede reintentar." }, { status: 500 });
  }
}
