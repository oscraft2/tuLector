export type BillingCountry = "CL" | "MX" | "BR" | "CO" | "AR" | "PE" | "GLOBAL";
export type BillingGateway = "flow" | "mercadopago" | "stripe";
export type PaidPlan = "pro" | "school";
export type ScanPackSize = 500 | 1000;

export type BillingCheckoutInput =
  | { type: "plan"; plan: PaidPlan }
  | { type: "scan_pack"; scansAdded: ScanPackSize };

export type BillingCatalogItem = {
  type: "plan" | "scan_pack";
  plan?: PaidPlan;
  scansAdded: number;
  amount: number;
  amountCents: number;
  currency: string;
  gateway: BillingGateway;
  description: string;
};

export type ChileanBillingDetails = {
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

const PLAN_SCANS: Record<PaidPlan, number> = {
  pro: 2000,
  school: 10000,
};

const PLAN_PRICES: Record<BillingCountry, Record<PaidPlan, number>> = {
  CL: { pro: 19900, school: 99000 },
  MX: { pro: 490, school: 2490 },
  BR: { pro: 149, school: 749 },
  CO: { pro: 99000, school: 490000 },
  AR: { pro: 25, school: 120 },
  PE: { pro: 25, school: 120 },
  GLOBAL: { pro: 25, school: 120 },
};

const PACK_PRICES: Record<BillingCountry, Record<ScanPackSize, number>> = {
  CL: { 500: 10000, 1000: 18000 },
  MX: { 500: 250, 1000: 450 },
  BR: { 500: 79, 1000: 140 },
  CO: { 500: 49000, 1000: 89000 },
  AR: { 500: 12, 1000: 20 },
  PE: { 500: 12, 1000: 20 },
  GLOBAL: { 500: 12, 1000: 20 },
};

const CURRENCIES: Record<BillingCountry, string> = {
  CL: "clp",
  MX: "mxn",
  BR: "brl",
  CO: "cop",
  AR: "usd",
  PE: "usd",
  GLOBAL: "usd",
};

export function resolveBillingCountry(countryCode: string | null | undefined): BillingCountry {
  const code = String(countryCode || "CL").toUpperCase();
  if (code === "CL" || code === "MX" || code === "BR" || code === "CO" || code === "AR" || code === "PE") return code;
  return "GLOBAL";
}

export function gatewayForCountry(country: BillingCountry): BillingGateway {
  if (country === "CL") return "flow";
  if (country === "MX" || country === "BR" || country === "CO" || country === "AR" || country === "PE") return "mercadopago";
  return "stripe";
}

export function parseBillingCheckoutInput(payload: unknown): BillingCheckoutInput | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (data.type === "plan") {
    return data.plan === "pro" || data.plan === "school" ? { type: "plan", plan: data.plan } : null;
  }
  if (data.type === "scan_pack") {
    const scansAdded = Number(data.scans_added ?? data.scansAdded);
    return scansAdded === 500 || scansAdded === 1000 ? { type: "scan_pack", scansAdded } : null;
  }
  return null;
}

export function resolveBillingCatalogItem(input: BillingCheckoutInput, countryCode: string | null | undefined): BillingCatalogItem {
  const country = resolveBillingCountry(countryCode);
  const currency = CURRENCIES[country];
  const gateway = gatewayForCountry(country);

  if (input.type === "plan") {
    const amount = PLAN_PRICES[country][input.plan];
    const scansAdded = PLAN_SCANS[input.plan];
    return {
      type: "plan",
      plan: input.plan,
      scansAdded,
      amount,
      amountCents: Math.round(amount * 100),
      currency,
      gateway,
      description: `Suscripcion mensual - Plan ${input.plan.toUpperCase()}`,
    };
  }

  const amount = PACK_PRICES[country][input.scansAdded];
  return {
    type: "scan_pack",
    scansAdded: input.scansAdded,
    amount,
    amountCents: Math.round(amount * 100),
    currency,
    gateway,
    description: `Paquete de ${input.scansAdded} escaneos OMR`,
  };
}

export function planScans(plan: PaidPlan) {
  return PLAN_SCANS[plan];
}

export function readBillingDetailsPayload(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== "object") return {};
  const data = payload as Record<string, unknown>;
  const details = data.billingDetails ?? data.billing_details;
  return details && typeof details === "object" ? details as Record<string, unknown> : {};
}
