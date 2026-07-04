import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { PlanCard } from "@/components/dashboard/PlanCard";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { supabase, school, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const [{ data: subscription }, { data: orders }, { data: papers }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("school_id", school.id).maybeSingle(),
    supabase.from("orders").select("id,type,status,amount_cents,currency,invoice_pdf_url,created_at").eq("school_id", school.id).order("created_at", { ascending: false }),
    supabase.from("papers").select("scanned_at").neq("status", "void").order("scanned_at", { ascending: false }),
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

  return (
    <>
      <PageHeader title={t.billing} description="Plan, cuota de lecturas, compras de scans y facturas. Stripe queda conectado solo por rutas server-side." />
      <div className="space-y-6">
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
        <section className="grid gap-4 md:grid-cols-4"><PlanCard plan="starter" current={school.plan === "starter"} scans="100 lecturas" price="$0 piloto" /><PlanCard plan="pro" current={school.plan === "pro"} scans="2.000 lecturas" price="CLP mensual" /><PlanCard plan="school" current={school.plan === "school"} scans="10.000 lecturas" price="Institucional" /><PlanCard plan="district" current={school.plan === "district"} scans="Multi sede" price="Convenio" /></section>
        <DataTable columns={["Tipo", "Estado", "Monto", "Factura", "Fecha"]} rows={orders ?? []} empty="No hay compras ni facturas." renderRow={(order) => (
          <tr key={order.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{order.type}</td><td className="px-5 py-4">{order.status}</td><td className="px-5 py-4">{order.currency?.toUpperCase()} {Math.round((order.amount_cents ?? 0) / 100)}</td><td className="px-5 py-4">{order.invoice_pdf_url ? <a className="underline" href={order.invoice_pdf_url}>PDF</a> : "-"}</td><td className="px-5 py-4 text-[#5b6472]">{new Date(order.created_at).toLocaleDateString("es-CL")}</td></tr>
        )} />
      </div>
    </>
  );
}
