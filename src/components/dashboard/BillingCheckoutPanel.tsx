"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export type CheckoutItem = {
  id: string;
  type: "plan" | "scan_pack";
  plan?: "pro" | "school";
  scansAdded: number;
  amountCents: number;
  currency: string;
  title: string;
  subtitle: string;
  badge?: string;
};

export type CommuneOption = {
  commune: string;
  regionCode: string;
  regionName: string;
};

type BillingFormState = {
  taxId: string;
  legalName: string;
  businessActivity: string;
  addressLine: string;
  regionCode: string;
  commune: string;
};

type Props = {
  schoolName: string;
  countryCode: string;
  currentPlan: string | null;
  isAdmin: boolean;
  items: CheckoutItem[];
  communes: CommuneOption[];
  paymentsReady: boolean;
};

const fieldInputClass = "min-h-12 w-full rounded-2xl border border-[#d8dde3] bg-white px-3.5 py-3 text-[0.95rem] font-semibold outline-none focus:border-[#07305f] focus:shadow-[0_0_0_4px_rgba(7,48,95,0.12)]";

function formatMoney(amountCents: number, currency: string) {
  const code = currency.toUpperCase();
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: code,
    maximumFractionDigits: code === "CLP" ? 0 : 2,
  }).format(amountCents / 100);
}

export function BillingCheckoutPanel({
  schoolName,
  countryCode,
  currentPlan,
  isAdmin,
  items,
  communes,
  paymentsReady,
}: Props) {
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id ?? "");
  const [form, setForm] = useState<BillingFormState>({
    taxId: "",
    legalName: schoolName,
    businessActivity: "Educacion",
    addressLine: "",
    regionCode: "",
    commune: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const regions = Array.from(
    communes.reduce((map, option) => {
      map.set(option.regionCode, option.regionName || option.regionCode);
      return map;
    }, new Map<string, string>()),
  ).map(([code, name]) => ({ code, name }));
  const availableCommunes = communes.filter((option) => option.regionCode === form.regionCode);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0];
  const isChile = countryCode.toUpperCase() === "CL";
  const canCheckout = isAdmin && isChile && communes.length > 0 && paymentsReady && Boolean(selectedItem);
  const disabledReason = !isAdmin
    ? "Solo un administrador puede contratar planes."
    : !isChile
      ? "El checkout automatico esta habilitado por ahora solo para Chile."
      : communes.length === 0
        ? "No se pudieron cargar regiones y comunas de Chile."
        : !paymentsReady
          ? "Flow aun no esta configurado para pagos reales."
          : "";

  function updateForm<K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) {
    setForm((current) => key === "regionCode" ? { ...current, regionCode: value, commune: "" } : { ...current, [key]: value });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem || !canCheckout) return;

    setError("");
    setIsSubmitting(true);

    const checkoutSelection = selectedItem.type === "plan"
      ? { type: "plan", plan: selectedItem.plan }
      : { type: "scan_pack", scansAdded: selectedItem.scansAdded };

    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...checkoutSelection,
          billingDetails: form,
        }),
      });
      const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;

      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "No se pudo iniciar el pago con Flow.");
      }

      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No se pudo iniciar el pago.");
      setIsSubmitting(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-[#d8dde3] bg-[#071527] shadow-[0_24px_60px_rgba(15,23,42,0.18)]" aria-labelledby="billing-checkout-title">
      <div className="grid gap-0 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="p-5 text-white sm:p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9fc5ff]">Checkout seguro</p>
              <h2 id="billing-checkout-title" className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Sube de plan sin friccion</h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-[#cbd7ea]">Elige plan o paquete, completa datos de facturacion y paga en Flow. TuLector no guarda datos bancarios.</p>
            </div>
            <span className="hidden rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold text-white sm:inline-flex">Flow Chile</span>
          </div>

          <div className="mt-6 grid gap-3" role="radiogroup" aria-label="Opciones de compra">
            {items.map((item) => {
              const selected = item.id === selectedItem?.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedItemId(item.id)}
                  role="radio"
                  aria-checked={selected}
                  className={selected
                    ? "rounded-3xl border border-[#8fbfff] bg-white p-4 text-left text-[#071527] shadow-xl shadow-black/20"
                    : "rounded-3xl border border-white/10 bg-white/[0.08] p-4 text-left text-white hover:border-white/30 hover:bg-white/[0.12]"}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span>
                      <span className="block text-base font-black">{item.title}</span>
                      <span className={selected ? "mt-1 block text-sm text-[#475569]" : "mt-1 block text-sm text-[#cbd7ea]"}>{item.subtitle}</span>
                    </span>
                    <span className="text-right">
                      {item.badge ? <span className={selected ? "mb-2 inline-flex rounded-full bg-[#e6f0ff] px-2 py-1 text-[11px] font-black text-[#07305f]" : "mb-2 inline-flex rounded-full bg-white/10 px-2 py-1 text-[11px] font-black text-white"}>{item.badge}</span> : null}
                      <span className="block text-lg font-black">{formatMoney(item.amountCents, item.currency)}</span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.08] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9fc5ff]">Resumen</p>
                <p className="mt-1 text-sm text-[#e5edf8]">Plan actual: <span className="font-bold capitalize text-white">{currentPlan || "starter"}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[#cbd7ea]">Total</p>
                <p className="text-2xl font-black">{selectedItem ? formatMoney(selectedItem.amountCents, selectedItem.currency) : "-"}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] font-bold text-[#cbd7ea]">
              <span className="rounded-2xl bg-white/[0.08] px-2 py-2">Flow</span>
              <span className="rounded-2xl bg-white/[0.08] px-2 py-2">Webpay</span>
              <span className="rounded-2xl bg-white/[0.08] px-2 py-2">Factura</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-t-[28px] bg-white p-5 text-[#0b1220] sm:p-6 lg:rounded-l-[28px] lg:rounded-tr-none lg:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#64748b]">Facturacion</p>
              <h3 className="mt-2 text-xl font-black tracking-tight">Datos de la institucion</h3>
            </div>
            <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-xs font-black text-[#07305f]">Chile</span>
          </div>

          {disabledReason ? (
            <div className="mt-5 rounded-2xl border border-[#f4d7a1] bg-[#fff7ed] px-4 py-3 text-sm font-semibold text-[#92400e]">{disabledReason}</div>
          ) : null}
          {error ? (
            <div className="mt-5 rounded-2xl border border-[#fecaca] bg-[#fef2f2] px-4 py-3 text-sm font-semibold text-[#991b1b]" role="alert">{error}</div>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="RUT institucional (opcional)" htmlFor="billing-tax-id">
              <input id="billing-tax-id" name="taxId" value={form.taxId} onChange={(event) => updateForm("taxId", event.target.value)} placeholder="76.123.456-7" autoComplete="off" className={fieldInputClass} />
            </Field>
            <div className="rounded-2xl border border-[#d8dde3] bg-[#f8fafc] px-4 py-3 text-sm font-semibold leading-5 text-[#475569]">
              Usaremos el correo de tu cuenta para Flow y comprobantes.
            </div>
            <Field label="Razon social" htmlFor="billing-legal-name" className="sm:col-span-2">
              <input id="billing-legal-name" name="legalName" value={form.legalName} onChange={(event) => updateForm("legalName", event.target.value)} placeholder="Nombre legal de la institucion" autoComplete="organization" minLength={3} required className={fieldInputClass} />
            </Field>
            <Field label="Giro" htmlFor="billing-business-activity" className="sm:col-span-2">
              <input id="billing-business-activity" name="businessActivity" value={form.businessActivity} onChange={(event) => updateForm("businessActivity", event.target.value)} placeholder="Educacion, capacitacion u otro" minLength={3} required className={fieldInputClass} />
            </Field>
            <Field label="Direccion obligatoria" htmlFor="billing-address" className="sm:col-span-2">
              <input id="billing-address" name="addressLine" value={form.addressLine} onChange={(event) => updateForm("addressLine", event.target.value)} placeholder="Calle, numero, oficina" autoComplete="street-address" minLength={5} required className={fieldInputClass} />
            </Field>
            <Field label="Region obligatoria" htmlFor="billing-region">
              <select id="billing-region" name="regionCode" value={form.regionCode} onChange={(event) => updateForm("regionCode", event.target.value)} required className={fieldInputClass}>
                <option value="">Selecciona region</option>
                {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
              </select>
            </Field>
            <Field label="Comuna obligatoria" htmlFor="billing-commune">
              <select id="billing-commune" name="commune" value={form.commune} onChange={(event) => updateForm("commune", event.target.value)} disabled={!form.regionCode} required className={`${fieldInputClass} disabled:bg-[#f8fafc] disabled:text-[#94a3b8]`}>
                <option value="">Selecciona comuna</option>
                {availableCommunes.map((option) => <option key={`${option.regionCode}-${option.commune}`} value={option.commune}>{option.commune}</option>)}
              </select>
            </Field>
          </div>

          <button type="submit" disabled={!canCheckout || isSubmitting} className="mt-6 min-h-[3.25rem] w-full rounded-2xl bg-[#07305f] px-5 py-3.5 text-base font-black text-white shadow-lg shadow-[#07305f]/20 hover:bg-[#0a3d78] disabled:bg-[#94a3b8]">
            {isSubmitting ? "Abriendo Flow..." : "Continuar a pago seguro"}
          </button>
          <p className="mt-3 text-center text-xs leading-5 text-[#64748b]">Seras redirigido a Flow para pagar con Webpay u otro medio disponible. Validamos plan, monto y facturacion en servidor.</p>
        </form>
      </div>

    </section>
  );
}

function Field({ label, htmlFor, className = "", children }: { label: string; htmlFor: string; className?: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-black text-[#334155]">{label}</span>
      {children}
    </label>
  );
}
