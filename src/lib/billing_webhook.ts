import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { markOrderPaidAndApplyEntitlement, sendOrderReceiptIfNeeded } from "@/lib/billing_orders";
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
