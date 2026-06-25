"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchScanLogs, type ScanLogRow } from "@/lib/scan_log";

export default function LogsPage() {
  const [rows, setRows] = useState<ScanLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "scan" | "scan_fail">("all");

  const load = async () => {
    setLoading(true);
    setRows(await fetchScanLogs(200));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const scans = rows.filter((r) => r.log?.type === "scan" || r.log?.type === "scan_fail");
  const ok = scans.filter((r) => r.log?.result?.valid).length;
  const failed = scans.filter((r) => r.log?.type === "scan_fail").length;
  const usedTiming = scans.filter((r) => (r.log?.diag as { usedTiming?: boolean })?.usedTiming).length;
  const successRate = scans.length ? Math.round((ok / scans.length) * 100) : 0;
  const timingRate = scans.length ? Math.round((usedTiming / scans.length) * 100) : 0;

  // Razones de fallo mas comunes
  const reasonCounts: Record<string, number> = {};
  for (const r of scans) {
    if (r.log?.type === "scan_fail") {
      const reason = (r.log?.result?.reason ?? "desconocido").replace(/\(.*?\)/g, "").trim();
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    }
  }
  const topReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const shown = filter === "all" ? scans : scans.filter((r) => r.log?.type === filter);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 sticky top-0 bg-zinc-950/90 backdrop-blur z-10">
        <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Análisis de escaneos</h1>
        <button onClick={load} className="text-xs font-bold text-green-400 px-2 py-1">Recargar</button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <Stat label="Escaneos" value={String(scans.length)} />
          <Stat label="Válidos %" value={`${successRate}%`} accent="text-green-400" />
          <Stat label="Fallidos" value={String(failed)} accent="text-red-400" />
          <Stat label="Timing %" value={`${timingRate}%`} accent="text-blue-400" />
        </div>

        {topReasons.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <h3 className="text-xs font-bold text-zinc-400 mb-2 uppercase tracking-wide">Causas de fallo</h3>
            <div className="space-y-1">
              {topReasons.map(([reason, count]) => (
                <div key={reason} className="flex justify-between text-xs">
                  <span className="text-zinc-300">{reason}</span>
                  <span className="text-red-400 font-bold">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtro */}
        <div className="flex gap-2 text-xs">
          {(["all", "scan", "scan_fail"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-bold ${filter === f ? "bg-green-600 text-white" : "bg-zinc-900 text-zinc-400 border border-zinc-800"}`}>
              {f === "all" ? "Todos" : f === "scan" ? "Válidos" : "Fallidos"}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-zinc-500 text-sm py-10">Cargando...</p>}
        {!loading && shown.length === 0 && (
          <p className="text-center text-zinc-600 text-sm py-10">
            Sin escaneos todavía. Escanea o sube una foto en <Link href="/scan" className="text-green-400 underline">/scan</Link>.
          </p>
        )}

        {/* Lista */}
        <div className="space-y-3">
          {shown.map((r) => <ScanCard key={r.id} row={r} />)}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 text-center">
      <div className={`text-xl font-black ${accent ?? "text-white"}`}>{value}</div>
      <div className="text-[9px] text-zinc-500 uppercase tracking-wide font-bold">{label}</div>
    </div>
  );
}

function ScanCard({ row }: { row: ScanLogRow }) {
  const [open, setOpen] = useState(false);
  const log = row.log;
  const diag = log?.diag as { usedTiming?: boolean; timingRows?: number; gridDx?: number } | undefined;
  const valid = log?.result?.valid;
  const date = new Date(row.created_at).toLocaleString("es-CL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-3 text-left">
        {log?.photo && <img src={log.photo} alt="foto" className="w-12 h-16 object-cover rounded border border-zinc-700" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${valid ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
              {valid ? "VÁLIDO" : "FALLÓ"}
            </span>
            <span className="text-[10px] text-zinc-500 font-bold uppercase">{log?.source ?? "?"}</span>
            <span className="text-[10px] text-zinc-600">{date}</span>
          </div>
          <p className="text-xs text-zinc-400 mt-1 truncate">
            {valid ? log?.answers?.filter((a) => a.a !== "-" && a.a !== "?").map((a) => a.a).join("") : log?.result?.reason}
          </p>
          {diag && (
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {diag.usedTiming ? `timing ${diag.timingRows}✓` : "offset sw"} · dx={diag.gridDx}
            </p>
          )}
        </div>
        <span className="text-zinc-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-zinc-800 pt-3">
          <div className="flex gap-3">
            {log?.photo && (
              <div>
                <p className="text-[9px] text-zinc-500 mb-1 font-bold">FOTO</p>
                <img src={log.photo} alt="foto" className="w-28 rounded border border-zinc-700" />
              </div>
            )}
            {log?.warp && (
              <div>
                <p className="text-[9px] text-zinc-500 mb-1 font-bold">WARP</p>
                <img src={log.warp} alt="warp" className="w-28 rounded border border-zinc-700" />
              </div>
            )}
          </div>

          {log?.id && log.id.length > 0 && (
            <p className="text-[10px] text-zinc-400 font-mono">ID: {log.id.join(" ")}</p>
          )}

          {log?.answers && log.answers.length > 0 && (
            <div className="grid grid-cols-10 gap-1">
              {log.answers.map((a) => {
                const top = Math.max(...(a.s ?? [0]));
                return (
                  <div key={a.q} className="text-center bg-zinc-800 rounded p-1" title={`scores: ${a.s?.join(", ")}`}>
                    <div className="text-[8px] text-zinc-500">{a.q}</div>
                    <div className="text-[11px] font-bold font-mono text-zinc-200">{a.a}</div>
                    <div className="text-[7px] text-zinc-600">{top.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
