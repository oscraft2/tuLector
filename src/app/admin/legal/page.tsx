import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function LegalPage() { const { admin } = await requirePlatformContext(["platform_admin", "support"]); const { count } = await admin.from("export_requests").select("id", { count: "exact", head: true }).eq("status", "pending"); return <AdminPlaceholder active="/admin/legal" title="Moderacion y legal" description="Solicitudes Ley 21.719/LGPD, accesos sensibles, consentimientos y exportaciones/borrado de alumnos." items={[{ label: "Solicitudes pendientes", value: count ?? 0 }, { label: "Acceso fotos", value: "auditado" }, { label: "Watermark", value: "staff id" }, { label: "Retencion", value: "por definir" }]} />; }
