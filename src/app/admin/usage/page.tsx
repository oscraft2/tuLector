import Link from "next/link";
import { requirePlatformContext } from "@/lib/supabaseAdmin";
import { AdminShell } from "@/components/dashboard/AdminShell";
import { KPI, KPIGrid } from "@/components/dashboard/KPI";
import { DataTable } from "@/components/dashboard/DataTable";
import { SCAN_CODES, SCAN_MESSAGES } from "@/tulector/scanner_config";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

type UsageSearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined): string => (Array.isArray(v) ? v[0] ?? "" : v ?? "");

/** Arma un href preservando los filtros actuales y aplicando un parche (un
 *  chip a la vez, sin JS -- mismo patron que TeacherScopeFilter/teacherScopeHref). */
function hrefWith(sp: UsageSearchParams, patch: Record<string, string>): string {
  const qs = new URLSearchParams();
  const merged = { q: first(sp.q), estado: first(sp.estado), motivo: first(sp.motivo), fuente: first(sp.fuente), ...patch };
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const s = qs.toString();
  return s ? `/admin/usage?${s}` : "/admin/usage";
}

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

export default async function UsageAdminPage({ searchParams }: { searchParams?: Promise<UsageSearchParams> }) {
  const { admin } = await requirePlatformContext(["platform_admin", "support"]);
  const sp = (await searchParams) ?? {};
  const q = first(sp.q).trim().slice(0, 100).replace(/[,()]/g, ""); // fuera comas/parentesis: rompen el filtro .or() de PostgREST
  const estado = first(sp.estado); // "" | "valid" | "failed"
  const motivo = first(sp.motivo); // codigo SCAN_CODES como string, o ""
  const fuente = first(sp.fuente); // "" | "camera" | "upload"

  // Fetch recent scan logs and aggregates. `log` es JSONB y trae foto/warp/
  // recorte de nombre en base64 (hasta ~250KB C/U, ver MAX_IMG_CHARS en
  // scan_log.ts) -- pedir la columna completa en consultas de hasta 2000 filas
  // significaba traer cientos de MB solo para leer un booleano o un motivo de
  // fallo. Se selecciona por path JSON (`log->campo`) para traer SOLO el dato
  // que se usa; esto era el cuello de botella real detrás de "/admin muy lento".
  const [
    { count: scansCount },
    { count: failuresCount },
    { data: validRutLogs },
    { data: failureLogs },
  ] = await Promise.all([
    admin.from("scan_logs").select("id", { count: "exact", head: true }),
    admin.from("scan_logs").select("id", { count: "exact", head: true }).eq("log->>type", "scan_fail"),
    // Universo para "precisión estimada": escaneos válidos que trajeron un RUT
    // (proxy real y medible hoy — cuántos de esos el DV verifica). No es lo
    // mismo que acertar las respuestas (eso requiere el dataset etiquetado de
    // /admin/dataset), así que se rotula explícitamente como identidad.
    admin
      .from("scan_logs")
      .select("dvOk:log->dvOk")
      .eq("log->>type", "scan")
      .not("log->>rut", "is", null)
      .neq("log->>rut", "")
      .limit(2000),
    // Para el desglose real de causas de fallo.
    admin
      .from("scan_logs")
      .select("code:log->result->>code, reason:log->result->>reason")
      .eq("log->>type", "scan_fail")
      .limit(2000),
  ]);

  let logsQuery = admin
    .from("scan_logs")
    .select("id, user_agent, created_at, type:log->>type, source:log->>source, sheet:log->>sheet, rut:log->>rut, dvOk:log->dvOk, code:log->result->>code, reason:log->result->>reason")
    .order("created_at", { ascending: false })
    .limit(50);
  if (estado === "valid") logsQuery = logsQuery.eq("log->>type", "scan");
  else if (estado === "failed") logsQuery = logsQuery.eq("log->>type", "scan_fail");
  if (fuente === "camera" || fuente === "upload") logsQuery = logsQuery.eq("log->>source", fuente);
  if (motivo) logsQuery = logsQuery.eq("log->result->>code", motivo);
  // Solo por RUT: "id" es uuid en Postgres y el operador ilike no aplica sobre
  // ese tipo (rompería la consulta en vez de simplemente no matchear).
  if (q) logsQuery = logsQuery.ilike("log->>rut", `%${q}%`);
  const { data: recentLogs } = await logsQuery;

  const totalScans = scansCount ?? 0;
  const totalFailures = failuresCount ?? 0;
  const failureRate = totalScans > 0 ? ((totalFailures / totalScans) * 100).toFixed(1) : "0.0";
  const successRate = totalScans > 0 ? (100 - parseFloat(failureRate)).toFixed(1) : "100.0";

  const rutRows = (validRutLogs ?? []) as { dvOk: boolean | null }[];
  const dvOkRate = rutRows.length > 0
    ? ((rutRows.filter((r) => r.dvOk === true).length / rutRows.length) * 100).toFixed(1)
    : "—";

  const failureCounts = new Map<string, number>();
  const failureCodesByLabel = new Map<string, string>();
  for (const row of (failureLogs ?? []) as { code: string | null; reason: string | null }[]) {
    const codeNum = row.code != null ? Number(row.code) : undefined;
    const label = failureLabel(codeNum, row.reason ?? undefined);
    failureCounts.set(label, (failureCounts.get(label) ?? 0) + 1);
    if (row.code) failureCodesByLabel.set(label, row.code);
  }
  const topFailures = [...failureCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([label, count]) => ({
      label,
      count,
      pct: totalScans > 0 ? ((count / totalScans) * 100).toFixed(1) : "0.0",
      code: failureCodesByLabel.get(label),
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

          {/* Buscador + filtros: para maximizar la deteccion de errores hay que
              poder aislar "solo fallidos", "solo este motivo" o buscar un RUT
              puntual, en vez de scrollear las ultimas 50 filas a ojo. Todo va
              a la URL (form GET + chips-Link, sin JS) para poder compartir/
              volver atras/recargar sin perder el filtro -- mismo patron que
              TeacherScopeFilter en /dashboard/papers. */}
          <div className="mb-4 space-y-3">
            <form method="GET" className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="estado" value={estado} />
              <input type="hidden" name="motivo" value={motivo} />
              <input type="hidden" name="fuente" value={fuente} />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Buscar por RUT…"
                className="w-64 max-w-full rounded-md border border-[#d7dbe1] px-3 py-1.5 text-sm focus:border-[#07305f] focus:outline-none"
              />
              <button type="submit" className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white">
                Buscar
              </button>
              {(q || estado || motivo || fuente) && (
                <Link href="/admin/usage" className="text-xs font-semibold text-[#6b7280] underline">
                  Limpiar filtros
                </Link>
              )}
            </form>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-[#6b7280]">Estado</span>
              {[["", "Todos"], ["valid", "Válidos"], ["failed", "Fallidos"]].map(([val, label]) => (
                <Link key={val} href={hrefWith(sp, { estado: val, motivo: val === "valid" ? "" : motivo })}
                  className={`rounded-full px-3 py-1 font-semibold ${estado === val ? "bg-[#07305f] text-white" : "bg-[#eef1f5] text-[#5b6472] hover:bg-[#e2e8f0]"}`}>
                  {label}
                </Link>
              ))}
              <span className="ml-2 font-semibold uppercase tracking-wide text-[#6b7280]">Fuente</span>
              {[["", "Todas"], ["camera", "Cámara"], ["upload", "Subida"]].map(([val, label]) => (
                <Link key={val} href={hrefWith(sp, { fuente: val })}
                  className={`rounded-full px-3 py-1 font-semibold ${fuente === val ? "bg-[#07305f] text-white" : "bg-[#eef1f5] text-[#5b6472] hover:bg-[#e2e8f0]"}`}>
                  {label}
                </Link>
              ))}
            </div>
            {topFailures.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold uppercase tracking-wide text-[#6b7280]">Motivo de fallo</span>
                <Link href={hrefWith(sp, { motivo: "" })}
                  className={`rounded-full px-3 py-1 font-semibold ${!motivo ? "bg-[#07305f] text-white" : "bg-[#eef1f5] text-[#5b6472] hover:bg-[#e2e8f0]"}`}>
                  Todos
                </Link>
                {topFailures.filter((f) => f.code).map((f) => (
                  <Link key={f.label} href={hrefWith(sp, { motivo: f.code!, estado: "failed" })}
                    className={`rounded-full px-3 py-1 font-semibold ${motivo === f.code ? "bg-[#07305f] text-white" : "bg-[#eef1f5] text-[#5b6472] hover:bg-[#e2e8f0]"}`}>
                    {f.label} ({f.count})
                  </Link>
                ))}
              </div>
            )}
          </div>

          <DataTable
            columns={["ID Escaneo / Fecha", "Tipo / Formato", "Estado OMR / Detalle", "Dispositivo (UA)", "Acción"]}
            rows={recentLogs ?? []}
            empty="No hay registros de escaneo disponibles en este momento."
            renderRow={(row) => {
              const date = new Date(row.created_at).toLocaleString("es-CL");

              const isSuccess = row.type === "scan";
              const code = row.code != null ? Number(row.code) : undefined;
              const reason = failureLabel(code, row.reason ?? undefined);

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
                    <p className="font-medium text-[#111827]">{row.sheet?.toUpperCase() || "V2"}</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">{row.source === "camera" ? "Cámara en vivo" : "Subida de archivo"}</p>
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
                    {isSuccess && row.rut && (
                      <p className="text-xs text-[#10b981] mt-1 font-semibold">
                        RUT Identificado: {row.rut} {row.dvOk ? "(DV OK)" : "(DV INV)"}
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
