import "server-only";
import { createHash } from "node:crypto";
import type { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { resolveLocaleForCountry } from "@/lib/country_profiles";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

type ChileanBillingDetailsObject = {
  taxId: string | null;
  legalName: string;
  businessActivity: string;
  email: string;
  phone: string | null;
  addressLine: string;
  regionCode: string;
  regionName: string;
  commune: string;
};

type BillingOrder = {
  id: string;
  school_id: string;
  type: "plan" | "scan_pack";
  status: string | null;
  scans_added: number | null;
  amount_cents: number | null;
  currency: string | null;
  billing_details: ChileanBillingDetailsObject | null;
  receipt_seq: number | null;
  gateway: string | null;
  gateway_payment_id: string | null;
  receipt_sent_at: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  paid_at: string | null;
};

type PaidOrderResult = {
  alreadyProcessed: boolean;
  order: BillingOrder;
  school: { id: string; name: string; scans_limit: number | null; plan: string | null; country_code: string | null };
  extraScans: number;
  targetPlan: string | null;
};

type PaidOrderOptions = {
  expectedAmountCents?: number;
  expectedCurrency?: string;
  gateway?: string;
  gatewayPaymentId?: string;
  billingPeriodMonths?: number;
};

function buildReceiptNumber(receiptSeq: number | null | undefined) {
  const seq = typeof receiptSeq === "number" ? receiptSeq : 0;
  return `TL-${String(seq).padStart(8, "0")}`;
}

export function formatReceiptNumber(order: { receipt_seq: number | null }) {
  return buildReceiptNumber(order.receipt_seq);
}

/**
 * One database transaction owns the order, quota and subscription.
 * A failed call rolls everything back; duplicate callbacks are safe to retry.
 */
export async function markOrderPaidAndApplyEntitlement(
  admin: AdminClient,
  orderId: string,
  options: PaidOrderOptions,
): Promise<PaidOrderResult> {
  if (!Number.isSafeInteger(options.expectedAmountCents) || options.expectedAmountCents! <= 0
    || !options.expectedCurrency || !options.gateway || !options.gatewayPaymentId) {
    throw new Error("Faltan datos verificados de la pasarela");
  }
  const { data, error } = await admin.rpc("apply_paid_order", {
    p_order_id: orderId,
    p_amount_cents: options.expectedAmountCents,
    p_currency: options.expectedCurrency.toLowerCase(),
    p_gateway: options.gateway,
    p_payment_id: options.gatewayPaymentId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo confirmar la orden");
  return data as PaidOrderResult;
}

export type ReceiptSendResult = { sent: boolean; receiptNumber: string; alreadySent: boolean; error?: string };

interface OrderReceiptVariables {
  receipt_number: string;
  order_date: string;
  item_description: string;
  billing_period: string;
  amount: string;
  payment_method: string;
  transaction_id: string;
  school_name: string;
  legal_name: string;
  tax_id: string;
  business_activity: string;
  address_line: string;
  region_name: string;
  commune: string;
  dashboard_link: string;
}

function safeBillingDetails(order: BillingOrder): ChileanBillingDetailsObject | null {
  const raw = order.billing_details;
  if (!raw || typeof raw !== "object") return null;
  return raw as ChileanBillingDetailsObject;
}

export function buildOrderReceiptVariables(
  order: BillingOrder,
  school: { name: string },
  planOrPack: string,
  gatewayLabel: string,
  siteUrl: string,
): OrderReceiptVariables | null {
  const details = safeBillingDetails(order);
  if (!details) return null;

  const orderCurrency = String(order.currency || "clp").toUpperCase();
  const periodStart = order.billing_period_start
    ? new Date(order.billing_period_start).toLocaleDateString("es-CL")
    : new Date(order.paid_at || Date.now()).toLocaleDateString("es-CL");
  const periodEnd = order.billing_period_end
    ? new Date(order.billing_period_end).toLocaleDateString("es-CL")
    : undefined;

  const billingPeriod = periodEnd ? `${periodStart} al ${periodEnd}` : periodStart;

  return {
    receipt_number: formatReceiptNumber(order),
    order_date: new Date(order.paid_at || Date.now()).toLocaleDateString("es-CL"),
    item_description: planOrPack,
    billing_period: billingPeriod,
    amount: `$${(Number(order.amount_cents ?? 0) / 100).toLocaleString("es-CL")} ${orderCurrency}`,
    payment_method: gatewayLabel,
    transaction_id: order.gateway_payment_id || "N/A",
    school_name: school.name,
    legal_name: details.legalName || school.name,
    tax_id: details.taxId || "No informado",
    business_activity: details.businessActivity || "No informado",
    address_line: details.addressLine || "No informado",
    region_name: details.regionName || details.regionCode || "No informado",
    commune: details.commune || "No informado",
    dashboard_link: `${siteUrl}/dashboard`,
  };
}

export async function sendOrderReceiptIfNeeded(
  admin: AdminClient,
  orderId: string,
  planOrPack: string,
  gatewayLabel: string,
  siteUrl: string,
  resendKey?: string,
): Promise<ReceiptSendResult> {
  const { data: orderData, error: orderError } = await admin
    .from("orders")
    .select("*, schools:school_id ( name, country_code )")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !orderData) {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "Orden no encontrada" };
  }

  type OrderSchool = { name: string; country_code: string | null };
  const order = orderData as BillingOrder & { schools: OrderSchool | OrderSchool[] | null };
  const schoolRow = Array.isArray(order.schools) ? order.schools[0] : order.schools;
  const schoolName = schoolRow?.name;
  if (!schoolName) {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "Colegio no encontrado" };
  }

  if (order.status !== "paid") {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "La orden no esta pagada" };
  }

  const receiptNumber = formatReceiptNumber(order);

  if (order.receipt_sent_at && !resendKey) {
    return { sent: true, receiptNumber, alreadySent: true };
  }

  const variables = buildOrderReceiptVariables(order, { name: schoolName }, planOrPack, gatewayLabel, siteUrl);
  if (!variables) {
    return { sent: false, receiptNumber, alreadySent: false, error: "Faltan datos de facturacion" };
  }

  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", order.school_id)
    .eq("role", "admin");

  if (!members || members.length === 0) {
    return { sent: false, receiptNumber, alreadySent: false, error: "No hay administradores para notificar" };
  }

  const adminUserIds = members.map((m) => m.user_id);
  const userResults = await Promise.all(adminUserIds.map((id) => admin.auth.admin.getUserById(id)));
  const lookupError = userResults.find((result) => result.error)?.error;
  if (lookupError) throw new Error("No se pudieron consultar los destinatarios");
  const emails = Array.from(new Set(userResults.flatMap((result) => result.data.user?.email ? [result.data.user.email] : [])));

  if (emails.length === 0) {
    return { sent: false, receiptNumber, alreadySent: false, error: "No hay correos de administradores" };
  }

  const { sendTemplatedEmail } = await import("./email");
  const locale = resolveLocaleForCountry(schoolRow?.country_code);
  let lastError: string | undefined;

  for (const email of emails) {
    const result = await sendTemplatedEmail({
      to: email,
      templateKey: "order_receipt",
      idempotencyKey: `order-receipt/${orderId}/${resendKey || "original"}/${createHash("sha256").update(email).digest("hex").slice(0, 24)}`,
      locale,
      variables: variables as unknown as Record<string, string | number>,
    });
    if (!result.success) {
      lastError = result.error;
      console.warn(`[billing_orders] fallo envio de comprobante a ${email}:`, result.error);
    }
  }

  if (lastError) {
    return { sent: false, receiptNumber, alreadySent: false, error: lastError };
  }

  const { error: markError } = await admin
    .from("orders")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", orderId);

  if (markError) {
    console.error("[billing_orders] no se pudo marcar receipt_sent_at:", markError);
    // No consideramos fatal: el email ya salio. Devolvemos sent true pero logueamos.
  }

  return { sent: true, receiptNumber, alreadySent: false };
}

export type PaymentFailedNotifyResult = { sent: boolean; error?: string };

/**
 * Avisa a los admins del colegio que un pago fue RECHAZADO explicitamente
 * (no simplemente pendiente/en proceso). No muta `orders` -- el pago no se
 * marca como pagado, la orden sigue pendiente para un reintento real. Sin
 * proteccion anti-duplicado (a diferencia de sendOrderReceiptIfNeeded): un
 * reintento del webhook de la pasarela podria reenviar este aviso; se acepta
 * ese riesgo menor (a lo sumo 2 avisos de "no se pudo cobrar", no confunde
 * como si fuera un doble cobro) en vez de sumar una migracion nueva solo
 * para este caso.
 */
export async function notifyPaymentFailed(
  admin: AdminClient,
  orderId: string,
  gatewayLabel: string,
  statusLabel: string,
  siteUrl: string,
): Promise<PaymentFailedNotifyResult> {
  const { data: orderData, error: orderError } = await admin
    .from("orders")
    .select("*, schools:school_id ( name, country_code )")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !orderData) {
    return { sent: false, error: "Orden no encontrada" };
  }

  type OrderSchool = { name: string; country_code: string | null };
  const order = orderData as BillingOrder & { schools: OrderSchool | OrderSchool[] | null };
  const schoolRow = Array.isArray(order.schools) ? order.schools[0] : order.schools;
  if (!schoolRow?.name) {
    return { sent: false, error: "Colegio no encontrado" };
  }

  const { data: members } = await admin
    .from("school_members")
    .select("user_id")
    .eq("school_id", order.school_id)
    .eq("role", "admin");

  if (!members || members.length === 0) {
    return { sent: false, error: "No hay administradores para notificar" };
  }

  const adminUserIds = members.map((m) => m.user_id);
  const userResults = await Promise.all(adminUserIds.map((id) => admin.auth.admin.getUserById(id)));
  const lookupError = userResults.find((result) => result.error)?.error;
  if (lookupError) throw new Error("No se pudieron consultar los destinatarios");
  const emails = Array.from(new Set(userResults.flatMap((result) => result.data.user?.email ? [result.data.user.email] : [])));

  if (emails.length === 0) {
    return { sent: false, error: "No hay correos de administradores" };
  }

  const itemDescription = order.type === "plan" ? "Actualizacion de plan" : `Paquete de ${order.scans_added ?? 0} escaneos`;
  const orderCurrency = String(order.currency || "clp").toUpperCase();
  const amount = `$${(Number(order.amount_cents ?? 0) / 100).toLocaleString("es-CL")} ${orderCurrency}`;
  const locale = resolveLocaleForCountry(schoolRow.country_code);

  const { sendTemplatedEmail } = await import("./email");
  let lastError: string | undefined;
  for (const email of emails) {
    const result = await sendTemplatedEmail({
      to: email,
      templateKey: "payment_failed",
      locale,
      variables: {
        school_name: schoolRow.name,
        item_description: itemDescription,
        amount,
        status_label: statusLabel,
        billing_link: `${siteUrl}/dashboard/billing`,
      },
    });
    if (!result.success) {
      lastError = result.error;
      console.warn(`[billing_orders] fallo aviso de pago rechazado a ${email}:`, result.error);
    }
  }

  return lastError ? { sent: false, error: lastError } : { sent: true };
}
