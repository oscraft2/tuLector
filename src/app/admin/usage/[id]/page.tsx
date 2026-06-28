import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformContext, writeAuditLog } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { OMRVisualDebugger } from "@/components/dashboard/OMRVisualDebugger";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function OMRLogDetailPage({ params }: PageProps) {
  const { id } = await params;
  const { admin, user: actorUser, role: actorRole } = await requirePlatformContext(["platform_admin", "support"]);

  // 1. Fetch scan log details
  const { data: scanLog, error: fetchError } = await admin
    .from("scan_logs")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !scanLog) notFound();

  const payload = scanLog.log as any;
  const date = new Date(scanLog.created_at).toLocaleString("es-CL");
  const isSuccess = payload.type === "scan";

  // Log auditing
  await writeAuditLog({
    actorUserId: actorUser.id,
    actorRole: actorRole,
    targetType: "scan_log",
    targetId: id,
    action: "scan_log.view_audit",
    reason: `Auditoría de escaneo OMR para ID ${id}`,
  });

  // Safe parsing of answers and variables
  const answers = payload.answers || [];
  const corners = payload.corners || null;
  const diag = payload.diag || {};

  return (
    <AdminShell
      active="/admin/usage"
      title={`Auditoría OMR: ${id.slice(0, 8)}`}
      description={`Diagnóstico de procesamiento visual del escaneo realizado el ${date}.`}
    >
      <div className="space-y-6">
        {/* Breadcrumbs */}
        <div className="text-sm font-semibold text-[#6b7280]">
          <Link href="/admin/usage" className="hover:text-[#111827]">Motor OMR</Link> &gt; <span className="text-[#111827]">Auditoría {id.slice(0, 8)}</span>
        </div>

        {/* Warning Alert */}
        <section className="rounded-md border border-[#f59e0b] bg-[#fffbeb] p-4 text-sm text-[#92400e]">
          Acceso a datos de escaneo del usuario por personal autorizado. Esta sesión de depuración visual se ha registrado en el log de auditoría global.
        </section>

        {/* Diagnostic KPIs */}
        <KPIGrid>
          <KPI
            label="Estado de Escaneo"
            value={isSuccess ? "VÁLIDO" : "FALLÓ"}
            detail={payload.result?.reason || "Procesado correctamente"}
          />
          <KPI
            label="Timing Track"
            value={diag.usedTiming ? "Interp. Regresión" : "Offset Global"}
            detail={`${diag.timingRows ?? 0} marcas de tiempo leídas`}
          />
          <KPI
            label="Alineación Local"
            value={`dx: ${diag.gridDx ?? 0}px / dy: ${diag.gridDy ?? 0}px`}
            detail="Búsqueda cuadrícula local"
          />
          <KPI
            label="Identificador RUT"
            value={payload.rut || "Sin RUT"}
            detail={payload.rut ? (payload.dvOk ? "Dígito Verificador OK" : "Dígito Verificador inválido") : "No aplica"}
          />
        </KPIGrid>

        {/* Interactive canvas debugger */}
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#111827]">Visor de Imagen & Overlays Ópticos</h2>
            <p className="text-sm text-[#5b6472]">
              Selecciona entre la foto original para ver cómo la cámara detectó las 4 esquinas del marco OMR, o el plano proyectado (warped) para verificar la precisión del muestreo de burbujas (A-E) y el RUT.
            </p>
            <OMRVisualDebugger
              photo={payload.photo}
              warp={payload.warp}
              corners={corners}
              answers={answers}
              rut={payload.rut}
            />
          </div>

          {/* Table of answers read */}
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-4">
            <h2 className="text-base font-semibold text-[#111827]">Datos de Lectura OMR</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-[#4b5563]">
                <thead className="bg-[#f8fafc] text-xs font-semibold uppercase tracking-wider text-[#6b7280] border-b border-[#eef0f3]">
                  <tr>
                    <th className="px-4 py-3">Preg.</th>
                    <th className="px-4 py-3">Leída</th>
                    <th className="px-4 py-3">Scores A-E (Oscuridad)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef0f3]">
                  {answers.map((ans: any) => {
                    const scores = ans.s || [];
                    const isBlank = ans.a === "-" || ans.a === "?";
                    return (
                      <tr key={ans.q} className="hover:bg-[#f9fafb] transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-[#07305f]">Q{ans.q}</td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                              isBlank
                                ? "bg-gray-100 text-gray-500 border border-gray-200"
                                : "bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0]"
                            }`}
                          >
                            {ans.a}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-[#6b7280]">
                          [{scores.map((s: number) => s.toFixed(2)).join(", ")}]
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
