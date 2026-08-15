import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { SCAN_CODES, SCAN_MESSAGES } from "@/tulector/scanner_config";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

// Nombre legible por código de fallo (SCAN_CODES); usado cuando el log no trae
// `result.reason` (BLANK_SHEET/OUT_OF_FOCUS/CURVE_FAIL rara vez lo traen, solo
// WRONG_FORMAT lo hace hoy).
const FAILURE_LABELS: Record<number, string> = {
  [SCAN_CODES.BLANK_SHEET]: "Hoja en blanco",
  [SCAN_CODES.OUT_OF_FOCUS]: "Sin respuestas legibles",
  [SCAN_CODES.CURVE_FAIL]: "Respuestas repetidas (papel curvado)",
  [SCAN_CODES.WRONG_FORMAT]: "Formato de hoja incorrecto",
  [SCAN_CODES.BRIGHT]: SCAN_MESSAGES[SCAN_CODES.BRIGHT] ?? "Brillo/reflejo",
};

function failureLabel(code: number | undefined, reason: string | undefined): string {
  if (reason) return reason;
  if (code != null && FAILURE_LABELS[code]) return FAILURE_LABELS[code];
  if (code != null && SCAN_MESSAGES[code]) return SCAN_MESSAGES[code];
  return "Motivo no registrado";
}

export default async function UsageAdminPage() {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);

  // Fetch recent scan logs and aggregates
  const [
    { count: scansCount },
    { count: failuresCount },
    { data: validRutLogs },
    { data: failureLogs },
    { data: recentLogs },
  ] = await Promise.all([
    admin.from("scan_logs").select("id", { count: "exact", head: true }),
    admin.from("scan_logs").select("id", { count: "exact", head: true }).eq("log->>type", "scan_fail"),
    // Universo para "precisión estimada": escaneos válidos que trajeron un RUT
    // (proxy real y medible hoy — cuántos de esos el DV verifica). No es lo
    // mismo que acertar las respuestas (eso requiere el dataset etiquetado de
    // /admin/dataset), así que se rotula explícitamente como identidad.
    admin
      .from("scan_logs")
      .select("log")
      .eq("log->>type", "scan")
      .not("log->>rut", "is", null)
      .neq("log->>rut", "")
      .limit(2000),
    // Para el desglose real de causas de fallo.
    admin.from("scan_logs").select("log").eq("log->>type", "scan_fail").limit(2000),
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

  const rutRows = (validRutLogs ?? []) as { log: { dvOk?: boolean } }[];
  const dvOkRate = rutRows.length > 0
    ? ((rutRows.filter((r) => r.log?.dvOk === true).length / rutRows.length) * 100).toFixed(1)
    : "—";

  const failureCounts = new Map<string, number>();
  for (const row of (failureLogs ?? []) as { log: { result?: { code?: number; reason?: string } } }[]) {
    const label = failureLabel(row.log?.result?.code, row.log?.result?.reason);
    failureCounts.set(label, (failureCounts.get(label) ?? 0) + 1);
  }
  const topFailures = [...failureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      pct: totalScans > 0 ? ((count / totalScans) * 100).toFixed(1) : "0.0",
    }));

  const rejectionOk = parseFloat(failureRate) < 10;

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
          <KPI label="RUT con DV Verificado" value={typeof dvOkRate === "string" && dvOkRate !== "—" ? `${dvOkRate}%` : "—"} detail="Identidad, no precisión de respuestas" />
        </KPIGrid>

        {/* Quality Alerts */}
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#07305f] uppercase tracking-wider">Métricas de Foco y Alineación</h2>
            <p className="mt-2 text-sm text-[#4b5563]">
              El motor rechaza automáticamente capturas con iluminación deficiente, desenfoque (error 1001) o distorsión severa de perspectiva (error 10). La tasa de rechazo recomendada en producción debe ser inferior al 10%.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${rejectionOk ? "text-green-700" : "text-red-700"}`}>
                <span className={`h-2 w-2 rounded-full ${rejectionOk ? "bg-green-600" : "bg-red-600"}`}></span>
                Estabilidad: {rejectionOk ? "Óptima" : "Revisar"} ({failureRate}% rechazo)
              </span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <span className="h-2 w-2 rounded-full bg-amber-500"></span> Build: {APP_VERSION}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-[#e5e7eb] bg-white p-5">
            <h2 className="text-sm font-semibold text-[#07305f] uppercase tracking-wider">Top Fallos Reportados</h2>
            {topFailures.length === 0 ? (
              <p className="mt-3 text-xs text-[#6b7280]">Sin fallas registradas todavía.</p>
            ) : (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                {topFailures.map((f) => (
                  <div key={f.label} className="bg-[#f8fafc] p-2 rounded">
                    <p className="text-[#6b7280]">{f.label}</p>
                    <p className="text-sm font-semibold text-[#111827] mt-0.5">{f.count} · {f.pct}% de total</p>
                  </div>
                ))}
              </div>
            )}
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
              const reason = failureLabel(code, payload.result?.reason);

              let statusLabel = "VÁLIDO (Graded)";
              let statusClass = "bg-green-100 text-green-800 border-green-200";

              if (!isSuccess) {
                statusLabel = code != null ? `FALLO (Cod: ${code})` : "FALLO";
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
