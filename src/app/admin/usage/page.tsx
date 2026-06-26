import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function UsagePage() { const { admin } = await requirePlatformContext(["platform_admin", "support"]); const [{ count: scans }, { count: failures }] = await Promise.all([admin.from("scan_logs").select("id", { count: "exact", head: true }), admin.from("scan_logs").select("id", { count: "exact", head: true }).eq("log->>type", "scan_fail")]); return <AdminPlaceholder active="/admin/usage" title="Uso del motor OMR" description="Volumen, tasa de fallo, user agents, latencia y accuracy estimada para roadmap de vision." items={[{ label: "Scan logs", value: scans ?? 0 }, { label: "Fallos", value: failures ?? 0 }, { label: "Accuracy", value: "pendiente", detail: "requiere ground truth" }, { label: "Dataset", value: "v2" }]} />; }
