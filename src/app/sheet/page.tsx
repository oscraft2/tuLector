"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SHEET_W, SHEET_H, type SheetConfig } from "@/lib/sheet_layout";
import {
  renderSheet, randomValidRut, randomAnswers, safeColumns, allowedColumns,
  MIN_QUESTIONS, MAX_QUESTIONS, type Branding, type GroundTruthEntry,
} from "@/lib/sheet_generator";

const DEFAULT_TEST_RUT = "12345678-5";
const LABELS = "ABCDE";

/** Exporta una o varias hojas a un PDF (una por página), ajustadas a Carta sin
 * distorsión (preserva la proporción 1200×1650 → la geometría no se desconfigura). */
async function exportPdf(dataUrls: string[], filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const PW = 612, PH = 792, ratio = SHEET_W / SHEET_H;
  let w = PW, h = PW / ratio;
  if (h > PH) { h = PH; w = PH * ratio; }
  const x = (PW - w) / 2, y = (PH - h) / 2;
  dataUrls.forEach((url, i) => {
    if (i > 0) doc.addPage("letter", "portrait");
    doc.addImage(url, "PNG", x, y, w, h);
  });
  doc.save(filename);
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function SheetPage() {
  const previewRef = useRef<HTMLCanvasElement>(null);

  // Config del lector
  const [numQuestions, setNumQuestions] = useState(20);
  const [numOptions, setNumOptions] = useState(5);
  const [numColumns, setNumColumns] = useState(1);

  // Branding
  const [title, setTitle] = useState("");
  const [school, setSchool] = useState("");
  const [logo, setLogo] = useState<HTMLImageElement | null>(null);

  // Hoja patrón (RUT de referencia)
  const [fillRut, setFillRut] = useState(false);
  const [rut, setRut] = useState(DEFAULT_TEST_RUT);

  // Beta
  const [batchN, setBatchN] = useState(40);
  const [busy, setBusy] = useState(false);

  const cfg: SheetConfig = { numQuestions, numOptions, numColumns };
  const branding: Branding = { title, school, logo };
  const marks = fillRut ? { rut, filled: true } : {};

  // Sincroniza la config con el escáner: /scan la lee de localStorage para leer
  // la hoja con el MISMO nº de preguntas/opciones/columnas que se imprimió.
  useEffect(() => {
    try {
      localStorage.setItem("tulector_scan_config", JSON.stringify({ numQuestions, numOptions, numColumns }));
    } catch { /* sin storage */ }
  }, [numQuestions, numOptions, numColumns]);

  // Vista previa (mismo render que la salida)
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext("2d");
    if (ctx) renderSheet(ctx, marks, cfg, branding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numQuestions, numOptions, numColumns, title, school, logo, fillRut, rut]);

  const onLogo = (file: File | undefined) => {
    if (!file) { setLogo(null); return; }
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = URL.createObjectURL(file);
  };

  /** Renderiza una hoja a dataURL PNG (2x para nitidez de impresión). */
  const renderToDataUrl = (m: { answers?: number[]; rut?: string; filled?: boolean }) => {
    const c = document.createElement("canvas");
    c.width = SHEET_W * 2; c.height = SHEET_H * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    renderSheet(ctx, m, cfg, branding);
    return c.toDataURL("image/png");
  };

  const pdfOne = () => exportPdf([renderToDataUrl(marks)], fillRut ? `hoja_tulector_${rut}.pdf` : "hoja_tulector.pdf");

  const downloadPNG = () => {
    const a = document.createElement("a");
    a.href = renderToDataUrl(marks);
    a.download = fillRut ? `hoja_tulector_${rut}.png` : "hoja_tulector.png";
    a.click();
  };

  /** Beta: N hojas autollenadas (RUT+respuestas aleatorias) + verdad-terreno. */
  const generateBatch = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // deja pintar el "Generando…"
    const urls: string[] = [];
    const truth: GroundTruthEntry[] = [];
    const usedRuts = new Set<string>();
    for (let i = 1; i <= batchN; i++) {
      let r = randomValidRut();
      while (usedRuts.has(r)) r = randomValidRut();
      usedRuts.add(r);
      const ans = randomAnswers(numQuestions, numOptions);
      urls.push(renderToDataUrl({ rut: r, answers: ans, filled: true }));
      truth.push({ index: i, rut: r, answers: ans.map((a) => LABELS[a]) });
    }
    const meta = {
      generadoEn: new Date().toISOString(),
      config: { numQuestions, numOptions, numColumns },
      total: batchN,
      hojas: truth,
    };
    downloadBlob(JSON.stringify(meta, null, 2), `verdad_terreno_${batchN}_hojas.json`, "application/json");
    await exportPdf(urls, `hojas_prueba_${batchN}.pdf`);
    setBusy(false);
  };

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href="/" className="text-sm text-zinc-400 hover:text-white">&larr; Inicio</Link>
        <h1 className="text-lg font-bold">Generador de hojas</h1>
        <button onClick={pdfOne} className="px-3 py-1.5 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
          Descargar PDF
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
        {/* Vista previa */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl overflow-hidden shadow-2xl">
            <canvas ref={previewRef} className="w-full h-auto block" style={{ aspectRatio: `${SHEET_W}/${SHEET_H}` }} />
          </div>
          <div className="flex gap-2">
            <button onClick={downloadPNG} className="flex-1 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-semibold hover:bg-zinc-700">
              Descargar PNG
            </button>
            <button onClick={pdfOne} className="flex-1 py-2 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
              Descargar PDF
            </button>
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-5 text-sm">
          {/* Config del lector */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Configuración</h3>
            <label className="block">
              <span className="text-zinc-400">N° de preguntas: <strong className="text-white">{numQuestions}</strong></span>
              <input type="range" min={MIN_QUESTIONS} max={MAX_QUESTIONS} value={numQuestions}
                onChange={(e) => { const n = +e.target.value; setNumQuestions(n); setNumColumns(safeColumns(n, numColumns)); }}
                className="w-full" />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-zinc-400">Opciones</span>
                <select value={numOptions} onChange={(e) => setNumOptions(+e.target.value)} className={inputCls}>
                  {[3, 4, 5].map((n) => <option key={n} value={n}>{n} ({LABELS.slice(0, n)})</option>)}
                </select>
              </label>
              <label className="flex-1">
                <span className="text-zinc-400">Columnas</span>
                <select value={numColumns} onChange={(e) => setNumColumns(+e.target.value)} className={inputCls}>
                  {allowedColumns(numQuestions).map((n) => <option key={n} value={n}>{n} columna{n > 1 ? "s" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-zinc-500">Rango validado: <strong className="text-zinc-300">{MIN_QUESTIONS}–{MAX_QUESTIONS}</strong> preguntas · 1 col ≤40 · 2 col ≥12. Toda config aquí lee 100% (guard <code>test:omr</code>).</p>
          </section>

          {/* Branding */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Encabezado (colegio)</h3>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del ensayo (ej. Ensayo SIMCE Matemática)" className={inputCls} />
            <input value={school} onChange={(e) => setSchool(e.target.value)} placeholder="Nombre del colegio" className={inputCls} />
            <label className="block">
              <span className="text-zinc-400">Logo (opcional)</span>
              <input type="file" accept="image/*" onChange={(e) => onLogo(e.target.files?.[0])} className="w-full text-xs text-zinc-400 mt-1" />
            </label>
            {logo && <button onClick={() => setLogo(null)} className="text-xs text-red-400 hover:text-red-300">Quitar logo</button>}
          </section>

          {/* Hoja patrón RUT */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 text-white font-semibold">
              <input type="checkbox" checked={fillRut} onChange={(e) => setFillRut(e.target.checked)} />
              Rellenar RUT de referencia (DV válido)
            </label>
            {fillRut && (
              <input value={rut} onChange={(e) => setRut(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder="12345678-5" />
            )}
            <p className="text-zinc-400 text-xs">Imprime una hoja con el RUT ya marcado para verificar el lector sin marcado a mano.</p>
          </section>

          {/* Beta autollenado */}
          <section className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">🧪 Beta — pruebas masivas (ideal vs real)</h3>
            <p className="text-zinc-400 text-xs">
              Genera <strong className="text-white">{batchN} hojas</strong> autollenadas con RUT y respuestas aleatorias + un archivo de
              <strong className="text-white"> verdad-terreno</strong> (JSON). Imprime, escanea y contrasta. Ver <code>docs/plan-pruebas-lector.md</code>.
            </p>
            <label className="block">
              <span className="text-zinc-400">Cantidad de hojas: <strong className="text-white">{batchN}</strong></span>
              <input type="range" min={1} max={40} value={batchN} onChange={(e) => setBatchN(+e.target.value)} className="w-full" />
            </label>
            <button onClick={generateBatch} disabled={busy}
              className="w-full py-2.5 bg-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-500 disabled:opacity-50">
              {busy ? "Generando PDF…" : `Generar ${batchN} hojas (PDF) + verdad-terreno`}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
