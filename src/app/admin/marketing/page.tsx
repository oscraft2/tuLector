import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function MarketingPage() { const { admin } = await requirePlatformContext(["platform_admin", "marketing"]); const [{ count: templates }, { count: campaigns }] = await Promise.all([admin.from("email_templates").select("id", { count: "exact", head: true }), admin.from("email_campaigns").select("id", { count: "exact", head: true })]); return <AdminPlaceholder active="/admin/marketing" title="Correo marketing" description="Plantillas, segmentos, doble opt-in, unsubscribe y campanas ES/EN/PT con proveedor propio TuLector." items={[{ label: "Plantillas", value: templates ?? 0 }, { label: "Campanas", value: campaigns ?? 0 }, { label: "Proveedor", value: "Resend/Postmark" }, { label: "Consentimiento", value: "obligatorio" }]} />; }
