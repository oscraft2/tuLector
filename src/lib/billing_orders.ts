import "server-only";
import type { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

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
  school: { id: string; name: string; scans_limit: number | null; plan: string | null };
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

async function upsertSchoolSubscription(
  admin: AdminClient,
  input: { schoolId: string; plan: string; currency: string; amountCents: number },
) {
  const payload = {
    school_id: input.schoolId,
    plan: input.plan,
    status: "active",
    currency: input.currency,
    amount_cents: input.amountCents,
    current_period_start: new Date().toISOString(),
    current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: existingError } = await admin
    .from("subscriptions")
    .select("id")
    .eq("school_id", input.schoolId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { error } = await admin.from("subscriptions").update(payload).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from("subscriptions").insert({ ...payload, created_at: new Date().toISOString() });
  if (error) throw error;
}

function buildReceiptNumber(receiptSeq: number | null | undefined) {
  const seq = typeof receiptSeq === "number" ? receiptSeq : 0;
  return `TL-${String(seq).padStart(8, "0")}`;
}

export function formatReceiptNumber(order: { receipt_seq: number | null }) {
  return buildReceiptNumber(order.receipt_seq);
}

export async function markOrderPaidAndApplyEntitlement(admin: AdminClient, orderId: string, options: PaidOrderOptions = {}): Promise<PaidOrderResult> {
  const { data: orderData, error: orderError } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .single();

  if (orderError || !orderData) throw new Error("Orden no encontrada");

  const order = orderData as BillingOrder;

  if (options.expectedAmountCents !== undefined && Number(order.amount_cents ?? 0) !== options.expectedAmountCents) {
    throw new Error("El monto pagado no coincide con la orden");
  }

  if (options.expectedCurrency && String(order.currency || "").toLowerCase() !== options.expectedCurrency.toLowerCase()) {
    throw new Error("La moneda pagada no coincide con la orden");
  }

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .select("id, name, scans_limit, plan")
    .eq("id", order.school_id)
    .single();

  if (schoolError || !school) throw new Error("Colegio no encontrado");

  if (order.status === "paid") {
    const extraScans = Number(order.scans_added ?? 0);
    const targetPlan = order.type === "plan" ? (extraScans >= 10000 ? "school" : "pro") : school.plan;
    return { alreadyProcessed: true, order, school, extraScans, targetPlan };
  }

  if (order.status !== "pending") throw new Error("La orden no esta pendiente");

  const now = new Date();
  const periodMonths = options.billingPeriodMonths ?? (order.type === "plan" ? 12 : 0);
  const periodEnd = periodMonths > 0 ? new Date(now.getTime() + periodMonths * 30 * 24 * 60 * 60 * 1000).toISOString() : null;

  const { data: paidOrderData, error: updateOrderError } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: now.toISOString(),
      gateway: options.gateway ?? order.gateway ?? "flow",
      gateway_payment_id: options.gatewayPaymentId ?? order.gateway_payment_id ?? null,
      billing_period_start: order.billing_period_start ?? now.toISOString(),
      billing_period_end: periodEnd ?? order.billing_period_end,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateOrderError) throw updateOrderError;
  if (!paidOrderData) {
    return { alreadyProcessed: true, order, school, extraScans: Number(order.scans_added ?? 0), targetPlan: school.plan };
  }

  const paidOrder = paidOrderData as BillingOrder;

  const extraScans = Number(paidOrder.scans_added ?? 0);
  const targetPlan = paidOrder.type === "plan" ? (extraScans >= 10000 ? "school" : "pro") : school.plan;
  const newScansLimit = paidOrder.type === "plan" ? extraScans : (school.scans_limit ?? 0) + extraScans;
  const schoolUpdate: { scans_limit: number; updated_at: string; plan?: string; scans_used?: number } = {
    scans_limit: newScansLimit,
    updated_at: new Date().toISOString(),
  };

  if (targetPlan) schoolUpdate.plan = targetPlan;
  if (paidOrder.type === "plan") schoolUpdate.scans_used = 0;

  const { error: updateSchoolError } = await admin
    .from("schools")
    .update(schoolUpdate)
    .eq("id", school.id);

  if (updateSchoolError) throw updateSchoolError;

  if (paidOrder.type === "plan") {
    await upsertSchoolSubscription(admin, {
      schoolId: school.id,
      plan: targetPlan,
      currency: paidOrder.currency || "clp",
      amountCents: Number(paidOrder.amount_cents ?? 0),
    });
  }

  return { alreadyProcessed: false, order: paidOrder, school, extraScans, targetPlan };
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
): Promise<ReceiptSendResult> {
  const { data: orderData, error: orderError } = await admin
    .from("orders")
    .select("*, schools:school_id ( name )")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !orderData) {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "Orden no encontrada" };
  }

  const order = orderData as BillingOrder & { schools: { name: string } | { name: string }[] | null };
  const schoolName = Array.isArray(order.schools) ? order.schools[0]?.name : order.schools?.name;
  if (!schoolName) {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "Colegio no encontrado" };
  }

  if (order.status !== "paid") {
    return { sent: false, receiptNumber: "", alreadySent: false, error: "La orden no esta pagada" };
  }

  const receiptNumber = formatReceiptNumber(order);

  if (order.receipt_sent_at) {
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
  const { data: usersData } = await admin.auth.admin.listUsers();
  const emails = (usersData?.users ?? [])
    .filter((u) => adminUserIds.includes(u.id) && u.email)
    .map((u) => u.email!);

  if (emails.length === 0) {
    return { sent: false, receiptNumber, alreadySent: false, error: "No hay correos de administradores" };
  }

  const { sendTemplatedEmail } = await import("./email");
  let lastError: string | undefined;

  for (const email of emails) {
    const result = await sendTemplatedEmail({
      to: email,
      templateKey: "order_receipt",
      locale: "es-CL",
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
