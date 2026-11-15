import { headers } from "next/headers";
import { getDashboardContext } from "@/lib/supabase_server";
import { DataTable } from "@/components/dashboard/DataTable";
import { BillingCheckoutPanel, type CheckoutItem, type CommuneOption } from "@/components/dashboard/BillingCheckoutPanel";
import { BillingReceiptButton } from "@/components/dashboard/BillingReceiptButton";
import { BillingReturnStatus } from "@/components/dashboard/BillingReturnStatus";
import { resolveBillingCatalogItem } from "@/lib/billing_catalog";
import { hasActiveSubscription } from "@/lib/billing_entitlement";
import { getFlowConfig } from "@/lib/flow";
import { getDlocalConfig } from "@/lib/dlocal";

export const dynamic = "force-dynamic";
type Order = {
  id: string; type: string; plan_code: string | null; status: string | null;
  amount_cents: number | null; currency: string | null; invoice_pdf_url: string | null;
  receipt_seq: number | null; receipt_sent_at: string | null; created_at: string;
};
const STATUS: Record<string, string> = {
  paid: "Pagado", pending: "Pendiente", failed: "No completado",
  refunded: "Devolución registrada", void: "Anulado", manual_review: "En revisión",
};
function orderName(order: Order) {
  if (order.type !== "plan") return "Lecturas adicionales";
  return order.plan_code === "school" ? "Plan School" : order.plan_code === "pro" ? "Plan Pro" : "Plan anual";
}
function orderAmount(order: Order) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency", currency: (order.currency || "CLP").toUpperCase(),
    maximumFractionDigits: (order.currency || "CLP").toUpperCase() === "CLP" ? 0 : 2,
  }).format((order.amount_cents ?? 0) / 100);
}
function Receipt({ order, canResend }: { order: Order; canResend: boolean }) {
  if (order.status !== "paid" && order.status !== "refunded") return <span className="text-[#858b94]">—</span>;
  return <div>
    {order.receipt_seq
      ? <span className="font-mono text-xs text-[#535b66]">{"TL-" + String(order.receipt_seq).padStart(8, "0")}</span>
      : order.invoice_pdf_url ? <a href={order.invoice_pdf_url} className="text-[#07305f] underline">Documento PDF</a>
      : <span className="text-[#858b94]">—</span>}
    {canResend && order.status === "paid" ? <BillingReceiptButton orderId={order.id} /> : null}
  </div>;
}

export default async function BillingPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, school, isAdmin } = await getDashboardContext();
  const sp = await searchParams;
  const countryCode = (school.country_code || "CL").toUpperCase();
  const isChile = countryCode === "CL";
  const isNativeApp = /TuLectorApp/i.test((await headers()).get("user-agent") ?? "");
  const [subscriptionResult, orderResult, communeResult] = await Promise.all([
    supabase.from("subscriptions").select("plan,status,current_period_end").eq("school_id", school.id).maybeSingle(),
    supabase.from("orders")
      .select("id,type,plan_code,status,amount_cents,currency,invoice_pdf_url,receipt_seq,receipt_sent_at,created_at")
      .eq("school_id", school.id).order("created_at", { ascending: false }),
    isNativeApp || !isChile
      ? Promise.resolve({ data: [] as { comuna: string; region_cod: string; region_nombre: string }[] })
      : supabase.from("comunas").select("comuna,region_cod,region_nombre").order("region_cod").order("comuna"),
  ]);
  if (subscriptionResult.error || orderResult.error) throw new Error("No pudimos cargar el historial de pagos.");
  const subscription = subscriptionResult.data;
  const orders = (orderResult.data ?? []) as Order[];
  const planParam = typeof sp.plan === "string" && ["pro", "school"].includes(sp.plan) ? sp.plan : undefined;
  const returnOrder = typeof sp.order_id === "string" ? orders.find((order) => order.id === sp.order_id) : undefined;
  const gatewayConfig = isChile ? getFlowConfig() : getDlocalConfig();
  const paymentsReady = process.env.NODE_ENV !== "production" || (gatewayConfig.configured && !gatewayConfig.sandbox);
  const checkoutItems: CheckoutItem[] = (["pro", "school"] as const).map((plan) => {
    const item = resolveBillingCatalogItem({ type: "plan", plan }, countryCode);
    return {
      id: plan, type: item.type, plan, scansAdded: item.scansAdded,
      amountCents: item.amountCents, currency: item.currency,
      title: plan === "pro" ? "Pro" : "School",
      subtitle: plan === "pro" ? "2.000 lecturas al año" : "10.000 lecturas al año y trabajo en equipo",
    };
  });
  const communes: CommuneOption[] = (communeResult.data ?? []).map((row) => ({
    commune: row.comuna, regionCode: row.region_cod, regionName: row.region_nombre || row.region_cod,
  })).filter((row) => row.commune && row.regionCode);
  const used = Math.max(0, school.scans_used ?? 0);
  const limit = school.scans_limit;
  const remaining = limit === null ? null : Math.max(0, limit - used);
  const progress = limit && limit > 0 ? Math.min(100, Math.max(0, used / limit * 100)) : 0;
  const active = hasActiveSubscription(school.plan, subscription);
  const planName = school.plan === "school" ? "School" : school.plan === "pro" ? "Pro" : "Gratis";

  return <div className="max-w-[1040px]">
    <header className="mb-7">
      <h1 className="text-2xl font-semibold tracking-tight text-[#20242b] sm:text-3xl">Plan y pagos</h1>
      <p className="mt-2 text-sm leading-6 text-[#676e78]">Consulta tus lecturas y administra tu plan.</p>
    </header>

    {returnOrder ? <div className="mb-6"><BillingReturnStatus status={returnOrder.status} /></div> : null}

    <section aria-label="Tu plan actual" className="mb-8 grid gap-5 border-y border-[#dde0e4] py-5 sm:grid-cols-2 sm:gap-10">
      <div>
        <p className="text-sm text-[#676e78]">Plan actual</p>
        <p className="mt-1 text-lg font-semibold text-[#20242b]">{planName}</p>
        <p className="mt-1 text-sm text-[#676e78]">
          {active && subscription?.current_period_end
            ? "Vigente hasta el " + new Date(subscription.current_period_end).toLocaleDateString("es-CL")
            : "Sin suscripción anual activa."}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-[#676e78]">Lecturas disponibles</span>
          <strong className="font-semibold tabular-nums text-[#20242b]">{remaining === null ? "Sin límite" : remaining.toLocaleString("es-CL")}</strong>
        </div>
        {limit !== null && limit > 0 ? <div className="mt-3 h-1.5 overflow-hidden rounded-sm bg-[#e6e8eb]"
          role="progressbar" aria-label="Lecturas utilizadas" aria-valuemin={0} aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)} aria-valuetext={used.toLocaleString("es-CL") + " lecturas utilizadas"}>
          <div className="h-full bg-[#697888]" style={{ width: progress + "%" }} />
        </div> : null}
        <p className="mt-2 text-xs text-[#858b94]">{used.toLocaleString("es-CL")} utilizadas{limit !== null ? " de " + limit.toLocaleString("es-CL") : ""}</p>
      </div>
    </section>

    {isNativeApp ? <p className="text-sm leading-6 text-[#535b66]">Para contratar o renovar tu plan, ingresa a tulector.app desde un navegador.</p>
      : <BillingCheckoutPanel schoolName={school.name} countryCode={countryCode} currentPlan={school.plan}
        isAdmin={isAdmin} items={checkoutItems} communes={communes} paymentsReady={paymentsReady} initialPlan={planParam} />}

    <section aria-labelledby="billing-history-title" className="mt-12 border-t border-[#dde0e4] pt-7">
      <h2 id="billing-history-title" className="mb-4 text-lg font-semibold text-[#20242b]">Historial de compras</h2>
      <DataTable columns={["Compra", "Fecha", "Estado", "Monto", "Comprobante"]} rows={orders}
        empty="Todavía no hay compras en esta cuenta."
        renderMobileRow={(order) => <article key={order.id} className="border-b border-[#dde0e4] py-4 last:border-0">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-medium text-[#20242b]">{orderName(order)}</p>
              <p className="mt-1 text-xs text-[#858b94]">{new Date(order.created_at).toLocaleDateString("es-CL")}</p></div>
            <p className="text-sm font-medium tabular-nums text-[#20242b]">{orderAmount(order)}</p>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4 text-sm">
            <span className={order.status === "paid" ? "text-[#32664f]" : "text-[#676e78]"}>{STATUS[order.status || ""] || order.status}</span>
            <Receipt order={order} canResend={isAdmin} />
          </div>
        </article>}
        renderRow={(order) => <tr key={order.id} className="border-b border-[#eceef0] last:border-0">
          <td className="px-5 py-4 font-medium text-[#20242b]">{orderName(order)}</td>
          <td className="px-5 py-4 text-[#676e78]">{new Date(order.created_at).toLocaleDateString("es-CL")}</td>
          <td className={"px-5 py-4 " + (order.status === "paid" ? "text-[#32664f]" : "text-[#676e78]")}>{STATUS[order.status || ""] || order.status}</td>
          <td className="px-5 py-4 tabular-nums text-[#20242b]">{orderAmount(order)}</td>
          <td className="px-5 py-4"><Receipt order={order} canResend={isAdmin} /></td>
        </tr>} />
    </section>
  </div>;
}
