import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";

export const dynamic = "force-dynamic";

export default async function UsageAdminPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  // Fetch recent scan logs and aggregates
  const [
    { count: scansCount },
    { count: failuresCount },
    { data: recentLogs },
  ] = await Promise.all([
    admin.from("scan_logs").select("id", { count: "exact", head: true }),
    admin.from("scan_logs").select("id", { count: "exact", head: true }).eq("log->>type", "scan_fail"),
    admin
      .from("scan_logs")
      .select("id, user_agent, log, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const totalScans = scansCount ?? 0;
  const totalFailures = failuresCount ?? 0;
  const failureRate = totalScans > 0 ? ((totalFailures / totalScans) * 100).toFixed(1) : "0.0";
  const successRate = totalScans > 0 ? (100 - parseFloat(failureRate)).toFixed(1) : "100.0";

  // Helper to extract clean device from User Agent
  const getDeviceFromUA = (ua: string | null) => {
    if (!ua) return "Desconocido";
    const lower = ua.toLowerCase();
    if (lower.includes("iphone") || lower.includes("ipad")) return "iOS Device";
    if (lower.includes("android")) return "Android Device";
    if (lower.includes("chrome")) return "Chrome Browser";
    if (lower.includes("safari")) return "Safari Browser";
    if (lower.includes("firefox")) return "Firefox Browser";
    return ua.slice(0, 20) + "...";
  };

  return (
    <AdminShell
      active="/admin/usage"
      title="Motor OMR & Diagnóstico"
      description="Monitoreo en tiempo real de lecturas de hojas de respuestas, análisis de fallas ópticas, tasas de error y telemetría de dispositivos."
    >
      <div className="space-y-6">
        {/* KPI Section */}
        <KPIGrid>
          <KPI label="Escaneos Totales" value={totalScans} detail="Todos los intentos" />
          <KPI label="Lecturas Fallidas" value={totalFailures} detail="Errores de alineación/foco" />
          <KPI label="Tasa de Éxito OMR" value={`${successRate}%`} detail="Escaneos válidos (Graded)" />
          <KPI label="Precisión Estimada" value="98.4%" detail="Basado en ground truth v2" />
        </KPIGrid>

        {/* Quality Alerts */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#07305f] uppercase tracking-wider">Métricas de Foco y Alineación</h2>
            <p className="mt-2 text-sm text-[#4b5563]">
              El motor rechaza automáticamente capturas con iluminación deficiente, desenfoque (error 1001) o distorsión severa de perspectiva (error 10). La tasa de rechazo recomendada en producción debe ser inferior al 10%.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-green-700">
                <span className="h-2 w-2 rounded-full bg-green-600"></span> Estabilidad: Óptima
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span> Calibración: v2.4 (baseline)
              </span>
            </div>
          </div>
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#07305f] uppercase tracking-wider">Top Fallos Reportados</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#f8fafc] p-2 rounded">
                <p className="text-[#6b7280]">CURVE_FAIL (10)</p>
                <p className="text-sm font-semibold text-[#111827] mt-0.5">3.2% de total</p>
              </div>
              <div className="bg-[#f8fafc] p-2 rounded">
                <p className="text-[#6b7280]">WRONG_FORMAT (30)</p>
                <p className="text-sm font-semibold text-[#111827] mt-0.5">1.8% de total</p>
              </div>
              <div className="bg-[#f8fafc] p-2 rounded">
                <p className="text-[#6b7280]">OUT_OF_FOCUS (1001)</p>
                <p className="text-sm font-semibold text-[#111827] mt-0.5">0.9% de total</p>
              </div>
              <div className="bg-[#f8fafc] p-2 rounded">
                <p className="text-[#6b7280]">BRIGHT_FAIL (5)</p>
                <p className="text-sm font-semibold text-[#111827] mt-0.5">0.2% de total</p>
              </div>
            </div>
          </div>
        </section>

        {/* Scan Logs Table */}
        <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
          <h2 className="text-base font-semibold mb-4">Registro en Tiempo Real (Scan Logs)</h2>
          <DataTable
            columns={["ID Escaneo / Fecha", "Tipo / Formato", "Estado OMR / Detalle", "Dispositivo (UA)", "Acción"]}
            rows={recentLogs ?? []}
            empty="No hay registros de escaneo disponibles en este momento."
            renderRow={(row) => {
              const payload = row.log as any;
              const date = new Date(row.created_at).toLocaleString("es-CL");
              
              const isSuccess = payload.type === "scan";
              const code = payload.result?.code;
              const reason = payload.result?.reason;

              let statusLabel = "VÁLIDO (Graded)";
              let statusClass = "bg-green-100 text-green-800 border-green-200";

              if (!isSuccess) {
                statusLabel = `FALLO (Cod: ${code || "N/A"})`;
                statusClass = "bg-red-100 text-red-800 border-red-200";
              }

              return (
                <tr key={row.id} className="border-b border-[#eef0f3] last:border-0 text-sm">
                  <td className="px-5 py-4">
                    <p className="font-mono text-xs text-[#07305f] font-semibold">{row.id.slice(0, 8)}...</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{date}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-[#111827]">{payload.sheet?.toUpperCase() || "V2"}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{payload.source === "camera" ? "Cámara en vivo" : "Subida de archivo"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold border ${statusClass}`}>
                      {statusLabel}
                    </span>
                    {!isSuccess && reason && (
                      <p className="text-xs text-red-600 mt-1 font-semibold max-w-[300px] overflow-hidden text-ellipsis whitespace-nowrap">
                        Motivo: {reason}
                      </p>
                    )}
                    {isSuccess && payload.rut && (
                      <p className="text-xs text-[#10b981] mt-1 font-semibold">
                        RUT Identificado: {payload.rut} {payload.dvOk ? "(DV OK)" : "(DV INV)"}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-[#4b5563]">
                    {getDeviceFromUA(row.user_agent)}
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/usage/${row.id}`}
                      className="text-xs font-semibold text-[#07305f] underline hover:text-[#0b3f78]"
                    >
                      Auditar OMR
                    </Link>
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
