import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { refundOrVoidOrder } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

export default async function BillingAdminPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "finance"]);

  // Fetch all orders with school details and subscriptions
  const [{ data: orders }, { count: activeSubs }] = await Promise.all([
    admin
      .from("orders")
      .select(`
        id,
        type,
        status,
        scans_added,
        amount_cents,
        currency,
        gateway,
        paid_at,
        created_at,
        school_id,
        schools (
          name
        )
      `)
      .order("created_at", { ascending: false }),
    admin
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  // Calculations for dashboard
  const paidOrders = orders?.filter((o) => o.status === "paid") ?? [];
  const totalOrdersCount = orders?.length ?? 0;
  const paidOrdersCount = paidOrders.length;

  const GATEWAY_LABELS: Record<string, string> = {
    flow: "Flow (Chile)",
    dlocal: "dLocal (LatAm)",
    mercadopago: "MercadoPago (legado)",
    stripe: "Stripe (legado)",
  };
  const gatewayLabel = (gateway: string | null) => GATEWAY_LABELS[gateway ?? ""] ?? "Sin registrar";

  // Group earnings by currency (para totales financieros reales)
  const earningsByCurrency: Record<string, number> = {};
  for (const o of paidOrders) {
    const cur = (o.currency || "usd").toUpperCase();
    earningsByCurrency[cur] = (earningsByCurrency[cur] || 0) + (o.amount_cents ?? 0) / 100;
  }

  // Format currency helpers
  const formatCurrency = (val: number, cur: string) => {
    if (cur === "CLP" || cur === "COP") {
      return `$${Math.round(val).toLocaleString("es-CL")} ${cur}`;
    }
    return `$${val.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;
  };

  const clpTotal = earningsByCurrency["CLP"] || 0;

  // Ingresos agrupados por pasarela REAL (orders.gateway), no adivinados por moneda
  const paidByGateway = new Map<string, number>();
  for (const o of paidOrders) {
    const key = o.gateway ?? "(sin registrar)";
    paidByGateway.set(key, (paidByGateway.get(key) ?? 0) + 1);
  }
  const dlocalPaidCount = paidByGateway.get("dlocal") ?? 0;
  const legacyPaidCount = (paidByGateway.get("mercadopago") ?? 0) + (paidByGateway.get("stripe") ?? 0);

  return (
    <AdminShell
      active="/admin/billing"
      title="Facturación e Ingresos"
      description="Monitoreo de ingresos recurrentes, facturas, tasas de conversión de pasarelas locales (Flow en Chile, dLocal en el resto de LatAm) e IVA Chile 19%."
    >
      <div className="space-y-6">
        {/* Financial KPI Cards */}
        <KPIGrid>
          <KPI label="Suscripciones Activas" value={activeSubs ?? 0} detail="Planes Pro/School" />
          <KPI label="Ingresos Chile (Flow)" value={formatCurrency(clpTotal, "CLP")} detail={`${paidByGateway.get("flow") ?? 0} pagos`} />
          <KPI label="Ingresos dLocal (LatAm)" value={dlocalPaidCount} detail="Pagos confirmados vía dLocal" />
          <KPI label="Otros / sin pasarela activa" value={legacyPaidCount} detail="MercadoPago/Stripe (legado, sin checkout activo)" />
        </KPIGrid>

        {/* VAT / Impuestos Info Box */}
        <section className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-base font-semibold">Cumplimiento Tributario & Pasarelas</h2>
              <p className="mt-1 text-sm text-[#5b6472]">
                Los pagos en pesos chilenos (CLP) vía Flow incluyen el **19% de IVA (Ley de Impuestos a Servicios Digitales en Chile)**. El resto de LatAm se cobra vía dLocal y se concilia según el origen tributario del tenant.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded bg-[#f0fdf4] px-2.5 py-1 text-xs font-semibold text-green-800 border border-green-200">Flow Prod OK</span>
              <span className="rounded bg-[#fffbeb] px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">dLocal pendiente de activar</span>
            </div>
          </div>
        </section>

        {/* Orders Table */}
        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="text-base font-semibold mb-4">Registro de Transacciones</h2>
          <DataTable
            columns={["Orden / Fecha", "Colegio", "Detalle / Pasarela", "Monto", "Estado", "Acciones"]}
            rows={orders ?? []}
            empty="No hay transacciones registradas."
            renderRow={(order) => {
              const schoolName = (order.schools as any)?.name || "Colegio Eliminado";
              const date = new Date(order.created_at).toLocaleString("es-CL");
              const isPaid = order.status === "paid";
              const isVoid = order.status === "void" || order.status === "manual_review";
              const gatewayName = gatewayLabel(order.gateway ?? null);

              return (
                <tr key={order.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs text-[#07305f] font-semibold">{order.id.slice(0, 8)}...</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{date}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#111827]">{schoolName}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#4b5563]">
                      {order.type === "plan" ? "Suscripción Plan" : `Paquete de +${order.scans_added} escaneos`}
                    </p>
                    <p className="text-xs text-[#9ca3af] mt-0.5">Pasarela: {gatewayName}</p>
                  </td>
                  <td className="px-5 py-4 font-semibold text-[#111827]">
                    {formatCurrency((order.amount_cents ?? 0) / 100, (order.currency || "usd").toUpperCase())}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                        isPaid
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : isVoid
                          ? "bg-red-100 text-red-800 border border-red-200"
                          : "bg-yellow-100 text-yellow-800 border border-yellow-200"
                      }`}
                    >
                      {order.status === "paid" ? "Pagado" : order.status === "void" ? "Anulado/Reembolsado" : order.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {isPaid ? (
                      <form action={refundOrVoidOrder} className="flex items-center gap-2">
                        <input type="hidden" name="order_id" value={order.id} />
                        <input type="hidden" name="action" value="refund" />
                        <input
                          type="text"
                          name="reason"
                          placeholder="Motivo de reembolso..."
                          required
                          className="rounded border border-[#cfd6df] px-2 py-1 text-xs outline-none focus:border-red-500 w-40"
                        />
                        <button className="rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 text-xs font-semibold transition-colors">
                          Reembolsar
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-[#9ca3af]">-</span>
                    )}
                  </td>
                </tr>
              );
            }}
          />
        </div>
      </div>
    </AdminShell>
  );
}
