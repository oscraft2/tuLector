export type BillingCountry = "CL" | "MX" | "BR" | "CO" | "AR" | "PE" | "EC" | "UY" | "GLOBAL";
export type BillingGateway = "flow" | "dlocal" | "mercadopago" | "stripe";
export type PaidPlan = "pro" | "school";
export type BillingCheckoutInput = { type: "plan"; plan: PaidPlan };

export type BillingCatalogItem = {
  type: "plan";
  plan: PaidPlan;
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
  CL: { pro: 19990, school: 99990 },
  MX: { pro: 490, school: 2490 },
  BR: { pro: 149, school: 749 },
  CO: { pro: 99000, school: 490000 },
  AR: { pro: 25, school: 120 },
  PE: { pro: 25, school: 120 },
  EC: { pro: 25, school: 120 },
  UY: { pro: 25, school: 120 },
  GLOBAL: { pro: 25, school: 120 },
};

const CURRENCIES: Record<BillingCountry, string> = {
  CL: "clp",
  MX: "mxn",
  BR: "brl",
  CO: "cop",
  AR: "usd",
  PE: "usd",
  EC: "usd",
  UY: "usd",
  GLOBAL: "usd",
};

// Paises soportados por el motor multi-pais (src/lib/country_profiles.ts: CL, AR, BR,
// PE, CO, EC, UY) mas MX, que aunque aun no tiene onboarding de dashboard activo, ya
// tiene paginas publicas/SEO propias (src/i18n/messages.ts) anunciando precios en MXN
// - no se retira del catalogo de precios para no dejar esas paginas prometiendo un
// pais que no factura.
export function resolveBillingCountry(countryCode: string | null | undefined): BillingCountry {
  const code = String(countryCode || "CL").toUpperCase();
  if (code === "CL" || code === "MX" || code === "BR" || code === "CO" || code === "AR" || code === "PE" || code === "EC" || code === "UY") return code;
  return "GLOBAL";
}

export function gatewayForCountry(country: BillingCountry): BillingGateway {
  if (country === "CL") return "flow";
  return "dlocal";
}

export function parseBillingCheckoutInput(payload: unknown): BillingCheckoutInput | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as Record<string, unknown>;
  if (data.type === "plan") {
    return data.plan === "pro" || data.plan === "school" ? { type: "plan", plan: data.plan } : null;
  }
  return null;
}

export function resolveBillingCatalogItem(input: BillingCheckoutInput, countryCode: string | null | undefined): BillingCatalogItem {
  const country = resolveBillingCountry(countryCode);
  const amount = PLAN_PRICES[country][input.plan];
  const scansAdded = PLAN_SCANS[input.plan];

  return {
    type: "plan",
    plan: input.plan,
    scansAdded,
    amount,
    amountCents: Math.round(amount * 100),
    currency: CURRENCIES[country],
    gateway: gatewayForCountry(country),
    description: `Suscripcion anual - Plan ${input.plan.toUpperCase()}`,
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