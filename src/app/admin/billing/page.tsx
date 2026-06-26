import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function BillingAdminPage() { const { admin } = await requirePlatformContext(["platform_admin", "finance"]); const [{ count: subs }, { count: orders }] = await Promise.all([admin.from("subscriptions").select("id", { count: "exact", head: true }), admin.from("orders").select("id", { count: "exact", head: true })]); return <AdminPlaceholder active="/admin/billing" title="Facturacion e ingresos" description="MRR, ARR, churn, facturas, reembolsos, disputes e IVA Chile 19%." items={[{ label: "Suscripciones", value: subs ?? 0 }, { label: "Ordenes", value: orders ?? 0 }, { label: "MRR", value: "Stripe" }, { label: "IVA", value: "19%" }]} />; }
