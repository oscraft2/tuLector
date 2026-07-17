import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { reviewExportRequest } from "@/app/admin/actions";

export const dynamic = "force-dynamic";

const REQUEST_TYPE_LABELS: Record<string, string> = {
  access: "Acceso a datos",
  delete: "Eliminación",
  export: "Exportación",
  rectify: "Rectificación",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
  completed: "Completada",
};

export default async function LegalPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);
  const [{ count: pendingCount }, { data: requests }] = await Promise.all([
    admin.from("export_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin
      .from("export_requests")
      .select("id, request_type, status, reason, created_at, reviewed_at, schools(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  return (
    <AdminShell
      active="/admin/legal"
      title="Moderación y legal"
      description="Solicitudes Ley 21.719/LGPD, consentimientos y exportaciones/borrado de datos de alumnos."
    >
      <div className="space-y-6">
        <KPIGrid>
          <KPI label="Solicitudes pendientes" value={pendingCount ?? 0} />
          <KPI label="Acceso a fotos" value="Auditado" />
          <KPI label="Retención" value="Por definir" />
        </KPIGrid>

        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="mb-4 text-base font-semibold">Solicitudes de datos personales</h2>
          <DataTable
            columns={["Colegio", "Tipo", "Motivo", "Fecha", "Estado", "Acciones"]}
            rows={requests ?? []}
            empty="Sin solicitudes registradas."
            renderRow={(req) => {
              const schoolName = (req.schools as unknown as { name: string } | null)?.name ?? "Colegio eliminado";
              const isPending = req.status === "pending";
              return (
                <tr key={req.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                  <td className="px-5 py-4 font-semibold">{schoolName}</td>
                  <td className="px-5 py-4">{REQUEST_TYPE_LABELS[req.request_type] ?? req.request_type}</td>
                  <td className="px-5 py-4 text-xs text-[#5b6472]">{req.reason ?? "-"}</td>
                  <td className="px-5 py-4 text-xs text-[#6b7280]">{new Date(req.created_at).toLocaleDateString("es-CL")}</td>
                  <td className="px-5 py-4">{STATUS_LABELS[req.status] ?? req.status}</td>
                  <td className="px-5 py-4">
                    {isPending ? (
                      <div className="flex flex-wrap gap-2">
                        <form action={reviewExportRequest}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="decision" value="approved" />
                          <button className="rounded bg-green-50 border border-green-200 px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-100">Aprobar</button>
                        </form>
                        <form action={reviewExportRequest}>
                          <input type="hidden" name="request_id" value={req.id} />
                          <input type="hidden" name="decision" value="rejected" />
                          <button className="rounded bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-100">Rechazar</button>
                        </form>
                      </div>
                    ) : req.status === "approved" ? (
                      <form action={reviewExportRequest}>
                        <input type="hidden" name="request_id" value={req.id} />
                        <input type="hidden" name="decision" value="completed" />
                        <button className="rounded bg-blue-50 border border-blue-200 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">Marcar completada</button>
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
