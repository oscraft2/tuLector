"use client";

import { useState, type FormEvent, type ReactNode } from "react";

export type CheckoutItem = {
  id: string; type: "plan"; plan: "pro" | "school";
  scansAdded: number; amountCents: number; currency: string;
  title: string; subtitle: string; badge?: string;
};
export type CommuneOption = { commune: string; regionCode: string; regionName: string };
type BillingFormState = {
  taxId: string; legalName: string; businessActivity: string;
  addressLine: string; regionCode: string; commune: string;
};
type Props = {
  schoolName: string; countryCode: string; currentPlan: string | null;
  isAdmin: boolean; items: CheckoutItem[]; communes: CommuneOption[];
  paymentsReady: boolean; initialPlan?: string;
};

const inputClass = "min-h-11 w-full min-w-0 rounded-md border border-[#cfd3d8] bg-white px-3 py-2 text-[15px] text-[#20242b] outline-none focus:border-[#07305f] focus:ring-2 focus:ring-[#07305f]/15 disabled:bg-[#f4f5f6] disabled:text-[#737a84]";
function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency", currency: currency.toUpperCase(),
    maximumFractionDigits: currency.toUpperCase() === "CLP" ? 0 : 2,
  }).format(amountCents / 100);
}

export function BillingCheckoutPanel({
  schoolName, countryCode, currentPlan, isAdmin, items, communes, paymentsReady, initialPlan,
}: Props) {
  const canSelect = (item: CheckoutItem) => !(currentPlan === "school" && item.plan === "pro");
  const initial = items.find((item) => (item.id === initialPlan || item.plan === initialPlan) && canSelect(item))
    ?? items.find((item) => item.plan === currentPlan) ?? items.find(canSelect);
  const [selectedItemId, setSelectedItemId] = useState(initial?.id ?? "");
  const [form, setForm] = useState<BillingFormState>({
    taxId: "", legalName: schoolName, businessActivity: "Educación",
    addressLine: "", regionCode: "", commune: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = items.find((item) => item.id === selectedItemId);
  const isChile = countryCode.toUpperCase() === "CL";
  const gateway = isChile ? "Flow" : "dLocal";
  const regions = Array.from(communes.reduce((map, option) =>
    map.set(option.regionCode, option.regionName || option.regionCode), new Map<string, string>()))
    .map(([code, name]) => ({ code, name }));
  const availableCommunes = communes.filter((option) => option.regionCode === form.regionCode);
  const disabledReason = !isAdmin ? "Solo un administrador de la cuenta puede comprar o renovar un plan."
    : !paymentsReady ? "Los pagos con " + gateway + " no están disponibles en este momento."
    : isChile && communes.length === 0 ? "No pudimos cargar las regiones y comunas. Actualiza la página para volver a intentarlo."
    : !selectedItem ? "No hay planes disponibles para esta cuenta." : "";
  const canCheckout = !disabledReason && Boolean(selectedItem);

  function updateForm<K extends keyof BillingFormState>(key: K, value: BillingFormState[K]) {
    setForm((current) => key === "regionCode"
      ? { ...current, regionCode: value, commune: "" } : { ...current, [key]: value });
  }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedItem || !canCheckout || isSubmitting) return;
    setError("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "plan", plan: selectedItem.plan, billingDetails: form }),
      });
      const data = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.error || "No pudimos iniciar el pago. Inténtalo de nuevo.");
      window.location.assign(data.url);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "No pudimos iniciar el pago.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Compra de plan anual"
      className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-10">
      <div className="min-w-0">
        {disabledReason ? <p role="status" className="mb-6 border-l-2 border-[#d7ad62] bg-[#fcf9f2] px-4 py-3 text-sm leading-6 text-[#77521f]">{disabledReason}</p> : null}
        <fieldset disabled={!isAdmin || isSubmitting} className="min-w-0">
          <legend className="text-lg font-semibold text-[#20242b]">Elige tu plan</legend>
          <p className="mt-1 text-sm text-[#676e78]">Un pago al año, sin renovación automática.</p>
          <div className="mt-4 border-t border-[#dde0e4]">
            {items.map((item) => {
              const selected = item.id === selectedItem?.id;
              const unavailable = !canSelect(item);
              return (
                <label key={item.id} className={"flex items-start gap-3 border-b border-[#dde0e4] px-3 py-4 " + (selected ? "bg-[#f4f6f8] " : "") + (unavailable ? "opacity-50" : "")}>
                  <input type="radio" name="plan" value={item.id} checked={selected}
                    disabled={unavailable} onChange={() => setSelectedItemId(item.id)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[#07305f]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-[#20242b]">{item.title}</span>
                    <span className="mt-1 block text-sm leading-5 text-[#676e78]">{item.subtitle}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-semibold tabular-nums text-[#20242b]">{formatMoney(item.amountCents, item.currency)}</span>
                    <span className="mt-1 block text-xs text-[#676e78]">por año</span>
                  </span>
                </label>
              );
            })}
          </div>
          {currentPlan === "school" ? <p className="mt-3 text-sm leading-5 text-[#676e78]">Para cambiar de School a Pro, <a href="/dashboard/support" className="text-[#07305f] underline underline-offset-2">contacta a soporte</a>.</p> : null}
        </fieldset>

        <fieldset disabled={!isAdmin || isSubmitting} className="mt-8 min-w-0">
          <legend className="text-lg font-semibold text-[#20242b]">Datos de compra</legend>
          <p className="mt-1 text-sm leading-5 text-[#676e78]">El comprobante se enviará al correo de tu cuenta.</p>
          <div className="mt-5 grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Field label="Nombre o razón social" htmlFor="billing-legal-name" className="sm:col-span-2">
              <input id="billing-legal-name" name="legalName" value={form.legalName}
                onChange={(event) => updateForm("legalName", event.target.value)}
                autoComplete="organization" minLength={3} maxLength={160} required className={inputClass} />
            </Field>
            <Field label={isChile ? "RUT" : "Documento nacional"} optional htmlFor="billing-tax-id"
              className={isChile ? "" : "sm:col-span-2"}>
              <input id="billing-tax-id" name="taxId" value={form.taxId}
                onChange={(event) => updateForm("taxId", event.target.value)}
                placeholder={isChile ? "12.345.678-9" : ""} autoComplete="off" maxLength={20} className={inputClass} />
            </Field>
            {isChile ? <>
              <Field label="Giro" htmlFor="billing-business-activity">
                <input id="billing-business-activity" name="businessActivity" value={form.businessActivity}
                  onChange={(event) => updateForm("businessActivity", event.target.value)}
                  minLength={3} maxLength={160} required className={inputClass} />
              </Field>
              <Field label="Dirección" htmlFor="billing-address" className="sm:col-span-2">
                <input id="billing-address" name="addressLine" value={form.addressLine}
                  onChange={(event) => updateForm("addressLine", event.target.value)}
                  autoComplete="street-address" minLength={5} maxLength={180} required className={inputClass} />
              </Field>
              <Field label="Región" htmlFor="billing-region">
                <select id="billing-region" name="regionCode" value={form.regionCode}
                  onChange={(event) => updateForm("regionCode", event.target.value)} required className={inputClass}>
                  <option value="">Selecciona una región</option>
                  {regions.map((region) => <option key={region.code} value={region.code}>{region.name}</option>)}
                </select>
              </Field>
              <Field label="Comuna" htmlFor="billing-commune">
                <select id="billing-commune" name="commune" value={form.commune}
                  onChange={(event) => updateForm("commune", event.target.value)}
                  disabled={!form.regionCode} required className={inputClass}>
                  <option value="">Selecciona una comuna</option>
                  {availableCommunes.map((option) => <option key={option.regionCode + "-" + option.commune} value={option.commune}>{option.commune}</option>)}
                </select>
              </Field>
            </> : null}
          </div>
        </fieldset>
      </div>

      <aside aria-label="Resumen de compra" className="min-w-0 rounded-md border border-[#dde0e4] bg-white p-5 lg:sticky lg:top-6">
        <h2 className="text-base font-semibold text-[#20242b]">Resumen</h2>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-[#676e78]">Plan</dt><dd className="font-medium text-[#20242b]">{selectedItem?.title ?? "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#676e78]">Lecturas</dt><dd className="tabular-nums text-[#20242b]">{selectedItem?.scansAdded.toLocaleString("es-CL") ?? "—"}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-[#676e78]">Duración</dt><dd className="text-[#20242b]">1 año</dd></div>
        </dl>
        <div className="mt-5 border-t border-[#dde0e4] pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium text-[#20242b]">Total</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight text-[#20242b]">
              {selectedItem ? formatMoney(selectedItem.amountCents, selectedItem.currency) : "—"}
            </span>
          </div>
          <p className="mt-1 text-right text-xs text-[#676e78]">{selectedItem?.currency.toUpperCase()}</p>
        </div>
        {error ? <p role="alert" className="mt-4 text-sm leading-5 text-[#a12c2c]">{error}</p> : null}
        <button type="submit" disabled={!canCheckout || isSubmitting}
          className="mt-5 min-h-11 w-full rounded-md bg-[#07305f] px-4 py-3 text-sm font-semibold text-white hover:bg-[#05264b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#07305f] disabled:bg-[#dfe2e6] disabled:text-[#737a84]">
          {isSubmitting ? "Preparando el pago…" : "Continuar a " + gateway}
        </button>
        <p className="mt-3 text-xs leading-5 text-[#676e78]">Elegirás el medio de pago en {gateway}. TuLector no guarda los datos de tu tarjeta.</p>
        {currentPlan === selectedItem?.plan ? <p className="mt-3 border-t border-[#dde0e4] pt-3 text-xs leading-5 text-[#676e78]">La renovación conserva tus lecturas disponibles y extiende la vigencia un año.</p> : null}
      </aside>
    </form>
  );
}

function Field({ label, htmlFor, optional, className = "", children }: {
  label: string; htmlFor: string; optional?: boolean; className?: string; children: ReactNode;
}) {
  return <div className={"min-w-0 " + className}>
    <label htmlFor={htmlFor} className="mb-1.5 flex flex-wrap items-baseline gap-x-2 text-sm font-medium text-[#3c434d]">
      {label}{optional ? <span className="font-normal text-[#858b94]">Opcional</span> : null}
    </label>
    {children}
  </div>;
}
