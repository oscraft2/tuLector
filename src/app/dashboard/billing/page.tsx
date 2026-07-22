import { headers } from "next/headers";
import Image from "next/image";
import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { BillingCheckoutPanel, type CheckoutItem, type CommuneOption } from "@/components/dashboard/BillingCheckoutPanel";
import { resolveBillingCatalogItem, type BillingCheckoutInput } from "@/lib/billing_catalog";
import { getFlowConfig } from "@/lib/flow";
import { planHasFeature } from "@/lib/plan_gates";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { supabase, school, locale, isAdmin } = await getDashboardContext();
  // Apple/Google prohiben vender contenido digital (planes anuales)
  // DENTRO del APK sin usar su IAP. Como el pago nunca se procesa en la app
  // (Flow queda solo en la web), aca se oculta el checkout y se muestra una
  // vista de solo lectura + un mensaje para comprar desde un navegador.
  const isNativeApp = /TuLectorApp/i.test((await headers()).get("user-agent") ?? "");
  const t = getDashboardMessages(locale);
  const [{ data: subscription }, { data: orders }, { data: papers }, { data: comunas }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("school_id", school.id).maybeSingle(),
    supabase.from("orders").select("id,type,status,amount_cents,currency,invoice_pdf_url,receipt_seq,receipt_sent_at,gateway,gateway_payment_id,created_at").eq("school_id", school.id).order("created_at", { ascending: false }),
    supabase.from("papers").select("scanned_at").neq("status", "void").order("scanned_at", { ascending: false }),
    // Solo hace falta para el formulario de checkout, que no se renderiza en nativo.
    isNativeApp
      ? Promise.resolve({ data: [] as { comuna: string; region_cod: string; region_nombre: string }[] })
      : supabase.from("comunas").select("comuna,region_cod,region_nombre").order("region_cod", { ascending: true }).order("comuna", { ascending: true }),
  ]);

  const scansByMonth: Record<string, number> = {};
  for (const p of papers ?? []) {
    const key = p.scanned_at?.slice(0, 7) ?? "desconocido";
    scansByMonth[key] = (scansByMonth[key] ?? 0) + 1;
  }
  const monthlyEntries = Object.entries(scansByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);
  const maxMonth = Math.max(1, ...monthlyEntries.map(([, c]) => c));
  const projConsumption = monthlyEntries.length >= 2
    ? Math.round(monthlyEntries.slice(-3).reduce((s, [, c]) => s + c, 0) / Math.min(3, monthlyEntries.slice(-3).length))
    : (monthlyEntries[0]?.[1] ?? 0);
  const flowConfig = getFlowConfig();
  const paymentsReady = process.env.NODE_ENV !== "production" || (flowConfig.configured && !flowConfig.sandbox);
  const checkoutInputs: Array<{ id: string; title: string; subtitle: string; badge?: string; input: BillingCheckoutInput }> = [
    { id: "pro", title: "Plan Pro", subtitle: "2.000 lecturas anuales", badge: "Recomendado", input: { type: "plan", plan: "pro" } },
    { id: "school", title: "Plan School", subtitle: "10.000 lecturas anuales y pestaña Equipo", input: { type: "plan", plan: "school" } },
  ];
  const checkoutItems: CheckoutItem[] = checkoutInputs.map(({ id, title, subtitle, badge, input }) => {
    const item = resolveBillingCatalogItem(input, school.country_code);
    return {
      id,
      type: item.type,
      plan: item.plan,
      scansAdded: item.scansAdded,
      amountCents: item.amountCents,
      currency: item.currency,
      title,
      subtitle,
      badge,
    };
  });
  const communeOptions: CommuneOption[] = (comunas ?? [])
    .map((row) => ({
      commune: String(row.comuna || ""),
      regionCode: String(row.region_cod || ""),
      regionName: String(row.region_nombre || row.region_cod || ""),
    }))
    .filter((row) => row.commune && row.regionCode);

  return (
    <>
      <PageHeader
        title={t.billing}
        description={isNativeApp
          ? "Plan actual, cuota de lecturas y tu historial de facturas."
          : "Plan anual, cuota de lecturas y facturacion. En Chile el pago se procesa con Flow desde un checkout seguro."}
      />
      <div className="space-y-6">
        {isNativeApp ? (
          <div className="rounded-md border border-[#e1e5ea] bg-[#f8faf9] p-5">
            <p className="text-sm font-semibold text-[#111827]">Plan actual: {school.plan}</p>
            <p className="mt-2 text-sm text-[#5b6472]">
              Para contratar o cambiar tu plan anual, ingresa a tulector.app desde un navegador (computador o celular).
            </p>
          </div>
        ) : (
          <BillingCheckoutPanel
            schoolName={school.name}
            countryCode={school.country_code || "CL"}
            currentPlan={school.plan}
            isAdmin={isAdmin}
            items={checkoutItems}
            communes={communeOptions}
            paymentsReady={paymentsReady}
          />
        )}
        {school.country_code === "CL" && !planHasFeature(school.plan, "dia_sync") ? (
          <div className="flex items-center gap-4 rounded-md border border-[#2f6f5e]/30 bg-[#f0f7f4] p-5">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-2">
              <Image src="/agencia-calidad-educacion.png" alt="Agencia de Calidad de la Educacion" width={200} height={130} className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#111827]">Sube tus resultados a la plataforma DIA automaticamente</p>
              <p className="mt-1 text-sm text-[#4b5563]">
                Exclusivo de Plan Pro y School: sincroniza los resultados escaneados directo con la plataforma DIA sin digitarlos
                uno por uno. Sube tu plan para activarlo.
              </p>
            </div>
          </div>
        ) : null}
        <KPIGrid>
          <KPI label="Escaneos usados" value={`${school.scans_used ?? 0}/${school.scans_limit ?? "—"}`} />
          <KPI label="Consumo mensual est." value={String(projConsumption)} />
          <KPI label="Meses con datos" value={monthlyEntries.length} />
        </KPIGrid>
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5">
          <h2 className="mb-4 text-lg font-semibold">Consumo mensual</h2>
          <QuotaBar used={school.scans_used ?? 0} limit={school.scans_limit ?? 0} />
          <p className="mt-4 text-sm text-[#5b6472]">Estado: {subscription?.status ?? "sin suscripcion activa"}</p>
          {monthlyEntries.length > 0 && (
            <div className="mt-4 flex items-end gap-2" style={{ height: 100 }}>
              {monthlyEntries.map(([month, count]) => (
                <div key={month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-[#5b6472]">{count}</span>
                  <div className="w-full rounded-t-sm bg-[#07305f]" style={{ height: `${Math.round((count / maxMonth) * 60)}px` }} />
                  <span className="text-[9px] text-[#9aa3af]">{month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <DataTable columns={["Tipo", "Estado", "Monto", "Comprobante", "Fecha"]} rows={orders ?? []} empty="No hay compras ni facturas." renderMobileRow={(order) => {
          const receiptNumber = order.receipt_seq ? `TL-${String(order.receipt_seq).padStart(8, "0")}` : null;
          return (
            <article key={order.id} className="rounded-2xl border border-[#e1e5ea] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black capitalize text-[#111827]">{order.type}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#64748b]">{order.status}</p>
                </div>
                <p className="text-sm font-black text-[#07305f]">{order.currency?.toUpperCase()} {Math.round((order.amount_cents ?? 0) / 100).toLocaleString("es-CL")}</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-[#64748b]">
                <span>{new Date(order.created_at).toLocaleDateString("es-CL")}</span>
                {receiptNumber ? (
                  <span className="font-bold text-[#07305f]">{receiptNumber}</span>
                ) : order.invoice_pdf_url ? (
                  <a className="font-bold text-[#07305f] underline" href={order.invoice_pdf_url}>Factura PDF</a>
                ) : (
                  <span>Sin comprobante</span>
                )}
              </div>
            </article>
          );
        }} renderRow={(order) => {
          const receiptNumber = order.receipt_seq ? `TL-${String(order.receipt_seq).padStart(8, "0")}` : null;
          return (
            <tr key={order.id} className="border-b border-[#eef0f3] last:border-0">
              <td className="px-5 py-4 font-semibold">{order.type}</td>
              <td className="px-5 py-4">{order.status}</td>
              <td className="px-5 py-4">{order.currency?.toUpperCase()} {Math.round((order.amount_cents ?? 0) / 100)}</td>
              <td className="px-5 py-4">
                {receiptNumber ? (
                  <span className="font-bold text-[#07305f]" title={order.receipt_sent_at ? `Enviado el ${new Date(order.receipt_sent_at).toLocaleDateString("es-CL")}` : "Comprobante generado"}>{receiptNumber}</span>
                ) : order.invoice_pdf_url ? (
                  <a className="underline" href={order.invoice_pdf_url}>PDF</a>
                ) : (
                  "-"
                )}
              </td>
              <td className="px-5 py-4 text-[#5b6472]">{new Date(order.created_at).toLocaleDateString("es-CL")}</td>
            </tr>
          );
        }} />
      </div>
    </>
  );
}
