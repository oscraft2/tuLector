import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminPlaceholder } from "@/components/dashboard/AdminPlaceholder";

export const dynamic = "force-dynamic";
export default async function DatasetPage() { const { admin } = await requirePlatformContext(["platform_admin", "support"]); const { count } = await admin.from("papers").select("id", { count: "exact", head: true }).eq("status", "corrected"); return <AdminPlaceholder active="/admin/dataset" title="Dataset de entrenamiento" description="Ground truth, fotos reales, distribucion de marcas, accuracy por categoria y publicacion de pesos OMR." items={[{ label: "Lecturas corregidas", value: count ?? 0 }, { label: "Modelo", value: "manual baseline" }, { label: "Publicacion", value: "feature flag" }, { label: "Clean-room", value: "obligatorio" }]} />; }
