import { getDashboardContext } from "@/lib/supabase_server";
import { getDashboardMessages } from "@/locales";
import { QuotaBar } from "@/components/dashboard/QuotaBar";
import { PlanCard } from "@/components/dashboard/PlanCard";
import { DataTable } from "@/components/dashboard/DataTable";
import { PageHeader } from "@/components/dashboard/PageHeader";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const { supabase, school, locale } = await getDashboardContext();
  const t = getDashboardMessages(locale);
  const [{ data: subscription }, { data: orders }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("school_id", school.id).maybeSingle(),
    supabase.from("orders").select("id,type,status,amount_cents,currency,invoice_pdf_url,created_at").eq("school_id", school.id).order("created_at", { ascending: false }),
  ]);
  return (
    <>
      <PageHeader title={t.billing} description="Plan, cuota de lecturas, compras de scans y facturas. Stripe queda conectado solo por rutas server-side." />
      <div className="space-y-6">
        <section className="rounded-md border border-[#e1e5ea] bg-white p-5"><QuotaBar used={school.scans_used ?? 0} limit={school.scans_limit ?? 0} /><p className="mt-4 text-sm text-[#5b6472]">Estado: {subscription?.status ?? "sin suscripcion activa"}</p></section>
        <section className="grid gap-4 md:grid-cols-4"><PlanCard plan="starter" current={school.plan === "starter"} scans="100 lecturas" price="$0 piloto" /><PlanCard plan="pro" current={school.plan === "pro"} scans="2.000 lecturas" price="CLP mensual" /><PlanCard plan="school" current={school.plan === "school"} scans="10.000 lecturas" price="Institucional" /><PlanCard plan="district" current={school.plan === "district"} scans="Multi sede" price="Convenio" /></section>
        <DataTable columns={["Tipo", "Estado", "Monto", "Factura", "Fecha"]} rows={orders ?? []} empty="No hay compras ni facturas." renderRow={(order) => (
          <tr key={order.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{order.type}</td><td className="px-5 py-4">{order.status}</td><td className="px-5 py-4">{order.currency?.toUpperCase()} {Math.round((order.amount_cents ?? 0) / 100)}</td><td className="px-5 py-4">{order.invoice_pdf_url ? <a className="underline" href={order.invoice_pdf_url}>PDF</a> : "-"}</td><td className="px-5 py-4 text-[#5b6472]">{new Date(order.created_at).toLocaleDateString("es-CL")}</td></tr>
        )} />
      </div>
    </>
  );
}
