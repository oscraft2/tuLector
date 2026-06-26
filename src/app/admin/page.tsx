import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support", "finance", "marketing"]);
  const [{ count: schools }, { count: subscriptions }, { count: tickets }, { count: flags }, { data: recentSchools }] = await Promise.all([
    admin.from("schools").select("id", { count: "exact", head: true }),
    admin.from("subscriptions").select("id", { count: "exact", head: true }).in("status", ["active", "trialing"]),
    admin.from("support_tickets").select("id", { count: "exact", head: true }).neq("status", "closed"),
    admin.from("feature_flags").select("id", { count: "exact", head: true }).eq("enabled", true),
    admin.from("schools").select("id,name,country_code,plan,scans_used,scans_limit,status,created_at").order("created_at", { ascending: false }).limit(8),
  ]);
  return (
    <AdminShell active="/admin" title="Panorama de plataforma" description="God view multi-tenant para negocio, soporte, uso del motor OMR y salud operativa. Acceso restringido a staff TuLector.">
      <div className="space-y-6">
        <KPIGrid><KPI label="Colegios" value={schools ?? 0} /><KPI label="Suscripciones" value={subscriptions ?? 0} /><KPI label="Tickets abiertos" value={tickets ?? 0} /><KPI label="Flags activas" value={flags ?? 0} /></KPIGrid>
        <DataTable columns={["Colegio", "Pais", "Plan", "Lecturas", "Estado"]} rows={recentSchools ?? []} empty="Sin colegios registrados." renderRow={(school) => (
          <tr key={school.id} className="border-b border-[#eef0f3] last:border-0"><td className="px-5 py-4 font-semibold">{school.name}</td><td className="px-5 py-4">{school.country_code}</td><td className="px-5 py-4">{school.plan}</td><td className="px-5 py-4">{school.scans_used}/{school.scans_limit}</td><td className="px-5 py-4">{school.status ?? "active"}</td></tr>
        )} />
      </div>
    </AdminShell>
  );
}
