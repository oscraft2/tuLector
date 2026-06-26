import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function ObservabilityPage() { await requirePlatformContext(["platform_admin", "support"]); return <AdminPlaceholder active="/admin/observability" title="Observabilidad" description="Estado Supabase, Vercel, Sentry, webhooks Stripe y jobs internos." items={[{ label: "Supabase", value: "configurar" }, { label: "Vercel", value: "configurar" }, { label: "Sentry", value: "configurar" }, { label: "Webhooks", value: "pendiente" }]} />; }
