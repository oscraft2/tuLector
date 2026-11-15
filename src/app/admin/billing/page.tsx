import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { recordExternalRefund, resendAdminReceipt } from "@/app/admin/actions";
import { getFlowConfig } from "@/lib/flow";
import { getDlocalConfig } from "@/lib/dlocal";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;
const STATUSES = ["pending", "paid", "refunded", "void", "failed", "manual_review"];
const GATEWAYS = ["flow", "dlocal", "mercadopago", "stripe"];
const LABELS: Record<string, string> = {
  pending: "Pendiente", paid: "Pagado", refunded: "Devolucion registrada",
  void: "Anulado", failed: "Fallido", manual_review: "Revision manual",
};
type BillingSummary = {
  order_count: number; paid_count: number; pending_count: number; refunded_count: number;
  active_subscriptions: number;
  revenue_by_currency: Record<string, number>; paid_by_gateway: Record<string, number>;
};
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency,
    maximumFractionDigits: ["CLP", "COP"].includes(currency) ? 0 : 2 }).format(amount);

export default async function BillingAdminPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { admin } = await requirePlatformContext(["platform_admin", "finance"]);
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : "";
  const gateway = typeof sp.gateway === "string" && GATEWAYS.includes(sp.gateway) ? sp.gateway : "";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));
  let query = admin.from("orders").select(
    "id,type,status,scans_added,amount_cents,currency,gateway,created_at,school_id,receipt_sent_at,refund_reference,entitlement_snapshot,schools(name)",
    { count: "exact" }).order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  if (gateway) query = query.eq("gateway", gateway);
  const [summaryResult, orderResult] = await Promise.all([
    admin.rpc("billing_summary"), query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  if (summaryResult.error || orderResult.error) throw new Error("No se pudieron cargar los datos financieros.");
  const summary = summaryResult.data as BillingSummary;
  const flow = getFlowConfig();
  const dlocal = getDlocalConfig();
  const configLabel = (config: { configured: boolean; sandbox: boolean }) =>
    !config.configured ? "Sin configurar" : config.sandbox ? "Sandbox" : "Credenciales de produccion presentes";
  const pageHref = (next: number) => "/admin/billing?" + new URLSearchParams({
    page: String(next), ...(status ? { status } : {}), ...(gateway ? { gateway } : {}),
  }).toString();

  return <AdminShell active="/admin/billing" title="Facturacion e ingresos"
    description="Cobros anuales confirmados, comprobantes y registro de devoluciones.">
    <div className="space-y-6">
      <KPIGrid>
        <KPI label="Suscripciones vigentes" value={summary.active_subscriptions} />
        <KPI label="Pagos confirmados" value={summary.paid_count} />
        <KPI label="Ordenes pendientes" value={summary.pending_count} />
        <KPI label="Devoluciones registradas" value={summary.refunded_count} />
      </KPIGrid>
      <section className="rounded-md border border-[#e1e5ea] bg-white p-5 text-sm">
        <h2 className="font-semibold">Ingresos por moneda</h2>
        <p className="mt-2">{Object.entries(summary.revenue_by_currency).map(([currency, amount]) =>
          money(amount, currency) + " " + currency).join(" · ") || "Sin pagos confirmados"}</p>
        <p className="mt-3">Flow: {configLabel(flow)}. dLocal: {configLabel(dlocal)}.</p>
        <p className="mt-2 text-[#5b6472]">La presencia de credenciales no verifica la conexion con la pasarela.
          Los comprobantes de compra no reemplazan documentos tributarios.</p>
        <p className="mt-2 text-[#5b6472]">Las devoluciones de dinero se realizan en la pasarela.
          Aqui se registra la devolucion completa ya realizada, con su referencia.
          Las ordenes anteriores a esta actualizacion requieren revisar su acceso manualmente.</p>
      </section>
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Estado
          <select name="status" defaultValue={status} className="ml-2 rounded border p-2">
            <option value="">Todos</option>
            {STATUSES.map((value) => <option key={value} value={value}>{LABELS[value]}</option>)}
          </select>
        </label>
        <label className="text-sm">Pasarela
          <select name="gateway" defaultValue={gateway} className="ml-2 rounded border p-2">
            <option value="">Todas</option>
            {GATEWAYS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button className="rounded border px-3 py-2 text-sm">Filtrar</button>
      </form>
      <DataTable columns={["Orden / Fecha", "Colegio", "Pasarela", "Monto", "Estado", "Acciones"]}
        rows={orderResult.data ?? []} empty="Sin transacciones para estos filtros." renderRow={(order) => {
          const school = Array.isArray(order.schools) ? order.schools[0] : order.schools;
          return <tr key={order.id} className="border-b text-sm">
            <td className="px-5 py-4"><span className="font-mono">{order.id.slice(0, 8)}</span>
              <p className="text-xs text-[#5b6472]">{new Date(order.created_at).toLocaleString("es-CL")}</p></td>
            <td className="px-5 py-4"><Link href={"/admin/schools/" + order.school_id}>{school?.name || "Colegio"}</Link></td>
            <td className="px-5 py-4">{order.gateway || "Sin registrar"}</td>
            <td className="px-5 py-4">{money((order.amount_cents ?? 0) / 100, (order.currency || "clp").toUpperCase())}</td>
            <td className="px-5 py-4">{LABELS[order.status ?? ""] || order.status}
              {order.refund_reference ? <p className="text-xs">{order.refund_reference}</p> : null}
              {!order.entitlement_snapshot && order.status === "refunded"
                ? <p className="text-xs text-amber-800">Revisar acceso manualmente</p> : null}</td>
            <td className="px-5 py-4">{order.status === "paid" ? <div className="space-y-3">
              <form action={resendAdminReceipt}>
                <input type="hidden" name="order_id" value={order.id} />
                <button className="text-xs underline">Reenviar comprobante</button>
              </form>
              <details><summary className="cursor-pointer text-xs">Registrar devolucion externa</summary>
                <form action={recordExternalRefund} className="mt-2 grid min-w-52 gap-2">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input name="refund_reference" aria-label="Referencia de devolucion" placeholder="Referencia de la pasarela" required minLength={3} maxLength={200} className="rounded border p-2 text-xs" />
                  <input name="reason" aria-label="Motivo de devolucion" placeholder="Motivo" required minLength={3} maxLength={500} className="rounded border p-2 text-xs" />
                  <label className="text-xs"><input type="checkbox" name="refund_confirmed" required /> Confirmo que devolvi el monto completo en la pasarela.</label>
                  <button className="rounded border border-red-200 p-2 text-xs text-red-700">Registrar devolucion realizada</button>
                </form>
              </details>
            </div> : "—"}</td>
          </tr>;
        }} />
      <nav aria-label="Paginas de transacciones" className="flex items-center gap-4 text-sm">
        {page > 1 ? <Link href={pageHref(page - 1)}>Anterior</Link> : null}
        <span>Pagina {page} · {orderResult.count ?? 0} transacciones</span>
        {page * PAGE_SIZE < (orderResult.count ?? 0) ? <Link href={pageHref(page + 1)}>Siguiente</Link> : null}
      </nav>
    </div>
  </AdminShell>;
}
