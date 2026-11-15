import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { markOrderPaidAndApplyEntitlement, sendOrderReceiptIfNeeded, notifyPaymentFailed } from "@/lib/billing_orders";
import { getSiteUrl } from "@/lib/site_url";

export async function applyVerifiedPayment(input: {
  orderId: string; amountCents: number; currency: string; gateway: string; paymentId: string;
}) {
  const admin = createSupabaseAdminClient();
  const result = await markOrderPaidAndApplyEntitlement(admin, input.orderId, {
    expectedAmountCents: input.amountCents,
    expectedCurrency: input.currency,
    gateway: input.gateway,
    gatewayPaymentId: input.paymentId,
  });
  // Retry notification delivery even when the financial transaction was already committed.
  // The receipt is the confirmation email; its provider idempotency key prevents duplicate delivery.
  const description = result.order.type === "plan"
    ? `Plan ${(result.targetPlan || "pro").toUpperCase()}`
    : `Paquete de ${result.extraScans} escaneos`;
  const receipt = await sendOrderReceiptIfNeeded(admin, input.orderId, description,
    input.gateway === "flow" ? "Flow (Chile)" : input.gateway === "dlocal" ? "dLocal" : "MercadoPago",
    getSiteUrl());
  if (!receipt.sent) {
    console.warn("[billing] pago aplicado; comprobante pendiente:", input.orderId, receipt.error);
  }
  return { status: result.alreadyProcessed ? "already_processed" : "success",
    order_id: input.orderId, receiptPending: !receipt.sent };
}

export async function recordVerifiedFailure(input: {
  orderId: string; amountCents: number; currency: string; gateway: string; paymentId: string;
}) {
  const admin = createSupabaseAdminClient();
  const { data: order, error } = await admin.from("orders")
    .select("id,status,amount_cents,currency,gateway,stripe_checkout_session_id")
    .eq("id", input.orderId).single();
  if (error || !order) throw new Error("Orden no encontrada.");
  if (order.amount_cents !== input.amountCents || order.currency?.toLowerCase() !== input.currency.toLowerCase()
    || (order.gateway && order.gateway !== input.gateway)
    || (input.gateway !== "mercadopago" && order.stripe_checkout_session_id
      && order.stripe_checkout_session_id !== input.paymentId)) {
    throw new Error("La notificacion no coincide con la orden.");
  }
  if (order.status !== "pending" && order.status !== "failed") return;
  const { error: updateError } = await admin.from("orders")
    .update({ status: "failed", failed_at: new Date().toISOString() }).eq("id", order.id).eq("status", "pending");
  if (updateError) throw updateError;
  await notifyPaymentFailed(admin, order.id, input.gateway, "Rechazado", getSiteUrl());
}
