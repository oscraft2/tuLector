"use client";

import { useState } from "react";
import Link from "next/link";
import { fetchScanLogs } from "@/lib/scan_log";
import { type GroundTruthEntry } from "@/lib/sheet_generator";
import { buildReport, type TestReport } from "@/lib/test_report";
import { analyzeTruthHeadless } from "@/lib/headless_analyze";
import { type SheetConfig } from "@/lib/sheet_layout";

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const tone = (x: number) => (x >= 0.99 ? "text-green-400" : x >= 0.95 ? "text-amber-400" : "text-red-400");

export default function PruebasPage() {
  const [truth, setTruth] = useState<GroundTruthEntry[]>([]);
  const [truthName, setTruthName] = useState("");
  const [cfg, setCfg] = useState<SheetConfig | null>(null);
  const [report, setReport] = useState<TestReport | null>(null);
  const [source, setSource] = useState<"headless" | "scans" | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(""); setReport(null); setSource(null);
    try {
      const data = JSON.parse(await file.text());
      const hojas: GroundTruthEntry[] = data.hojas ?? data;
      if (!Array.isArray(hojas) || !hojas[0]?.rut) throw new Error("JSON sin 'hojas' válidas");
      // Config de la hoja: viene en el JSON del generador. Si falta (archivo viejo),
      // se infiere del nº de respuestas (necesaria para re-renderizar en el motor).
      const c = data.config ?? {};
      const numQuestions = Number(c.numQuestions) || hojas[0].answers.length;
      const numOptions = Number(c.numOptions) || 5;
      const numColumns = Number(c.numColumns) || (numQuestions <= 40 ? 1 : 2);
      const openQuestions = Array.isArray(c.openQuestions)
        ? c.openQuestions.map(Number).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= numQuestions)
        : [];
      setCfg({ numQuestions, numOptions, numColumns, ...(openQuestions.length > 0 ? { openQuestions } : {}) });
      setTruth(hojas); setTruthName(file.name);
    } catch (e) {
      setError(`No se pudo leer el JSON: ${(e as Error).message}`);
    }
  };

  const compare = async () => {
    if (truth.length === 0) { setError("Carga primero el JSON de verdad-terreno."); return; }
    setBusy(true); setError(""); setReport(null);
    try {
      const logs = await fetchScanLogs(500);
      setReport(buildReport(truth, logs)); setSource("scans");
    } catch (e) {
      setError(`Error al traer escaneos: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  // Fase A automática: re-renderiza cada hoja y la corre por el motor (sin imprimir
  // ni escanear). Mide el piso ideal del sistema — geometría render↔lectura.
  const analyzeInMotor = async () => {
    if (truth.length === 0) { setError("Carga primero el JSON de verdad-terreno."); return; }
    if (!cfg) { setError("El JSON no trae la config de la hoja."); return; }
    setBusy(true); setError(""); setReport(null); setProgress({ done: 0, total: truth.length });
    try {
      const rows = await analyzeTruthHeadless(truth, cfg, {}, (done, total) => setProgress({ done, total }));
      setReport(buildReport(truth, rows)); setSource("headless");
    } catch (e) {
      setError(`Error al analizar en el motor: ${(e as Error).message}`);
    }
    setProgress(null); setBusy(false);
  };

  const downloadReport = () => {
    if (!report) return;
    const rows = [
      "indice,rut,emparejado,correctas,total,erradas",
      ...report.sheets.map((s) => `${s.index},${s.rut},${s.matched ? "si" : "no"},${s.correct},${s.total},"${s.wrong.join(" ")}"`),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "reporte_pruebas.csv"; a.click();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Pruebas — ideal vs real</h1>
        <Link href="/sheet" className="text-sm text-zinc-400 hover:text-white">Generador &rarr;</Link>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3 text-sm">
          <h3 className="font-bold text-white">1. Carga la verdad-terreno</h3>
          <p className="text-zinc-400 text-xs">El JSON que descargó el generador al crear las hojas (<code>verdad_terreno_N_hojas.json</code>).</p>
          <input type="file" accept="application/json" onChange={(e) => onFile(e.target.files?.[0])} className="w-full text-xs text-zinc-400" />
          {truthName && (
            <p className="text-green-400 text-xs">
              ✓ {truthName} — {truth.length} hojas
              {cfg && <span className="text-zinc-500"> · {cfg.numQuestions}p/{cfg.numOptions}o/{cfg.numColumns}c</span>}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            {/* Opción rápida: sin imprimir, corre el motor sobre la hoja re-renderizada */}
            <div className="space-y-1">
              <button onClick={analyzeInMotor} disabled={busy || truth.length === 0}
                className="w-full py-2.5 bg-emerald-600 rounded-lg font-bold hover:bg-emerald-500 disabled:opacity-50">
                {busy && source !== "scans" ? (progress ? `Analizando ${progress.done}/${progress.total}…` : "Analizando…") : "🔬 Analizar en el motor"}
              </button>
              <p className="text-[10px] text-zinc-500 text-center">Sin imprimir · piso ideal del sistema</p>
            </div>
            {/* Opción física: cruza con lo escaneado de verdad (scan_logs) */}
            <div className="space-y-1">
              <button onClick={compare} disabled={busy || truth.length === 0}
                className="w-full py-2.5 bg-indigo-600 rounded-lg font-bold hover:bg-indigo-500 disabled:opacity-50">
                {busy && source === "scans" ? "Comparando…" : "📷 Traer escaneos"}
              </button>
              <p className="text-[10px] text-zinc-500 text-center">Requiere imprimir + escanear</p>
            </div>
          </div>

          {progress && (
            <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
            </div>
          )}
          {error && <p className="text-red-400 text-xs">{error}</p>}
        </section>

        {report && (
          <>
            <div className="flex items-center gap-2 text-xs">
              {source === "headless" ? (
                <span className="rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 px-2.5 py-1 font-semibold">🔬 Motor (sin imprimir) — piso ideal del sistema</span>
              ) : (
                <span className="rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 px-2.5 py-1 font-semibold">📷 Escaneos reales (scan_logs)</span>
              )}
            </div>
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Exac. burbuja", val: pct(report.bubbleAcc), tone: tone(report.bubbleAcc), sub: `${report.correctBubbles}/${report.totalBubbles}` },
                { label: "Hojas perfectas", val: pct(report.sheetAcc), tone: tone(report.sheetAcc), sub: `de ${report.matched}` },
                { label: "RUT leído", val: pct(report.rutAcc), tone: tone(report.rutAcc), sub: `${report.matched}/${report.total}` },
                { label: "Emparejadas", val: `${report.matched}/${report.total}`, tone: "text-white", sub: "halladas por RUT" },
              ].map((c) => (
                <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">{c.label}</div>
                  <div className={`text-2xl font-black ${c.tone}`}>{c.val}</div>
                  <div className="text-[10px] text-zinc-500">{c.sub}</div>
                </div>
              ))}
            </section>

            <div className="flex justify-end">
              <button onClick={downloadReport} className="text-xs px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700">
                Descargar reporte (CSV)
              </button>
            </div>

            <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden text-sm">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase tracking-wide text-zinc-500 border-b border-zinc-800">
                  <tr><th className="px-3 py-2">#</th><th className="px-3 py-2">RUT</th><th className="px-3 py-2">Estado</th><th className="px-3 py-2">Correctas</th><th className="px-3 py-2">Erradas</th></tr>
                </thead>
                <tbody>
                  {report.sheets.map((s) => (
                    <tr key={s.index} className="border-b border-zinc-800/50">
                      <td className="px-3 py-2 text-zinc-500">{s.index}</td>
                      <td className="px-3 py-2 font-mono text-xs">{s.rut}</td>
                      <td className="px-3 py-2">
                        {!s.matched ? <span className="text-red-400">no escaneada / RUT mal</span>
                          : s.wrong.length === 0 ? <span className="text-green-400">✓ perfecta</span>
                          : <span className="text-amber-400">{s.wrong.length} errada(s)</span>}
                      </td>
                      <td className="px-3 py-2">{s.matched ? `${s.correct}/${s.total}` : "—"}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{s.wrong.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
