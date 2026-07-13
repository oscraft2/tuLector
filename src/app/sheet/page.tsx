"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SHEET_W, SHEET_H, type SheetConfig } from "@/lib/sheet_layout";
import {
  renderSheet, randomValidRut, randomAnswers, randomPartialAnswers, safeColumns, allowedColumns,
  MIN_QUESTIONS, MAX_QUESTIONS, type Branding, type GroundTruthEntry, type SheetMarks,
} from "@/lib/sheet_generator";
import { validateRut, normalizeRut } from "@/lib/rut";
import { SHEET_CODE_VERSION, type SheetCodeData } from "@/lib/sheet_code";
import { isNativeApp, shareNativeImage } from "@/lib/native/capacitor";

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
  const [native, setNative] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Origen de RUTs del beta: "random" (aleatorios) o "list" (roster de un curso).
  const [rutMode, setRutMode] = useState<"random" | "list">("random");
  const [rutList, setRutList] = useState("");

  // Premarcado parcial: primeras N preguntas auto-marcadas (Fase A), resto en
  // blanco para marcar a mano (Fase B) en la MISMA hoja. Off por defecto (modo
  // actual: todo premarcado, sin cambios de comportamiento).
  const [partialMode, setPartialMode] = useState(false);
  const [markUpTo, setMarkUpTo] = useState(10);

  // Ensayo heredado via /sheet?quiz=<id>: la hoja toma su formato + clave + codigo.
  const [quizInfo, setQuizInfo] = useState<{ id: string; title: string; sheetCode: number | null; answerKey: string } | null>(null);

  // Parsea la lista pegada (acepta "rut" o "rut,nombre,curso" por línea, salta
  // encabezado). Devuelve RUTs válidos normalizados, sin duplicados.
  const parseRutList = (raw: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const line of raw.split(/\r?\n/)) {
      const first = line.split(",")[0]?.trim() ?? "";
      if (!first || /rut/i.test(first)) continue; // vacío o encabezado
      if (!validateRut(first)) continue;
      const r = normalizeRut(first);
      if (seen.has(r)) continue;
      seen.add(r);
      out.push(r);
    }
    return out;
  };
  const parsedRuts = rutMode === "list" ? parseRutList(rutList) : [];
  // Nº de preguntas que quedan auto-marcadas; el resto en blanco (marcado a mano).
  const effectiveMarkUpTo = partialMode ? Math.max(0, Math.min(markUpTo, numQuestions)) : numQuestions;

  const cfg: SheetConfig = { numQuestions, numOptions, numColumns };
  const branding: Branding = { title, school, logo };
  // Codigo de hoja: si viene de un ensayo, lleva su sheet_code (ata la hoja al
  // ensayo y habilita verificar "hoja correcta" al escanear).
  const sheetCode: SheetCodeData | undefined =
    quizInfo && quizInfo.sheetCode != null
      ? { version: SHEET_CODE_VERSION, sheetId: quizInfo.sheetCode, page: 1, pagesTotal: 1 }
      : undefined;
  const marks: SheetMarks = { ...(fillRut ? { rut, filled: true } : {}), ...(sheetCode ? { code: sheetCode } : {}) };

  // Sincroniza la config con el escáner: /scan la lee de localStorage para leer
  // la hoja con el MISMO nº de preguntas/opciones/columnas que se imprimió.
  useEffect(() => {
    try {
      localStorage.setItem("tulector_scan_config", JSON.stringify({ numQuestions, numOptions, numColumns }));
    } catch { /* sin storage */ }
  }, [numQuestions, numOptions, numColumns]);

  // Detecta si corremos en el APK (para mostrar botón "Compartir" nativo).
  useEffect(() => {
    let a = true;
    Promise.resolve().then(() => { if (a) setNative(isNativeApp()); });
    return () => { a = false; };
  }, []);

  // Vista previa (mismo render que la salida)
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext("2d");
    if (ctx) renderSheet(ctx, marks, cfg, branding);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numQuestions, numOptions, numColumns, title, school, logo, fillRut, rut, quizInfo]);

  // Carga el ensayo desde ?quiz=<id> y hace que la hoja HEREDE su formato + codigo.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("quiz");
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/quiz/${id}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const q = await res.json();
        const nq = Number(q.num_questions) || 20;
        const no = Number(q.options_per_question) || 5;
        setNumQuestions(nq);
        setNumOptions(no);
        setNumColumns(safeColumns(nq, Number(q.num_columns) || 1));
        if (q.title) setTitle(String(q.title));
        setQuizInfo({ id: String(q.id), title: String(q.title ?? ""), sheetCode: q.sheet_code ?? null, answerKey: String(q.answer_key ?? "") });
      } catch { /* sin ensayo -> generador manual */ }
    })();
  }, []);

  const onLogo = (file: File | undefined) => {
    if (!file) { setLogo(null); return; }
    const img = new Image();
    img.onload = () => setLogo(img);
    img.src = URL.createObjectURL(file);
  };

  /** Renderiza una hoja a dataURL PNG (2x para nitidez de impresión). */
  const renderToDataUrl = (m: SheetMarks) => {
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

  /** Comparte un PNG de la hoja via share sheet nativo (Android/iOS). */
  const shareNative = async () => {
    setSharing(true);
    const dataUrl = renderToDataUrl(marks);
    const shareTitle = title.trim() || (fillRut ? `Hoja ${rut}` : "Hoja TuLector");
    await shareNativeImage(dataUrl, shareTitle);
    setSharing(false);
  };

  /** Beta: N hojas autollenadas (RUT+respuestas aleatorias) + verdad-terreno.
   *  Modo "random": RUTs aleatorios válidos. Modo "list": usa el roster pegado
   *  (RUTs reales de un curso) → cada hoja calza con un alumno existente. */
  const generateBatch = async () => {
    // En modo lista, los RUTs vienen del roster; en aleatorio, se generan.
    const ruts = rutMode === "list" ? parsedRuts : null;
    if (rutMode === "list" && (!ruts || ruts.length === 0)) {
      alert("Pega al menos un RUT válido del curso (una fila por alumno).");
      return;
    }
    const count = ruts ? ruts.length : batchN;
    setBusy(true);
    await new Promise((r) => setTimeout(r, 30)); // deja pintar el "Generando…"
    const urls: string[] = [];
    const truth: GroundTruthEntry[] = [];
    const usedRuts = new Set<string>();
    for (let i = 1; i <= count; i++) {
      let r: string;
      if (ruts) {
        r = ruts[i - 1];
      } else {
        r = randomValidRut();
        while (usedRuts.has(r)) r = randomValidRut();
        usedRuts.add(r);
      }
      const ans = partialMode
        ? randomPartialAnswers(numQuestions, numOptions, effectiveMarkUpTo)
        : randomAnswers(numQuestions, numOptions);
      urls.push(renderToDataUrl({ rut: r, answers: ans, filled: true, ...(sheetCode ? { code: sheetCode } : {}) }));
      // La verdad-terreno solo cubre lo AUTO-marcado (1..markedUpTo); lo demás se
      // marca a mano y se evalua contra la clave real del ensayo, no contra este JSON.
      truth.push({ index: i, rut: r, answers: ans.slice(0, effectiveMarkUpTo).map((a) => LABELS[a]) });
    }
    const meta = {
      generadoEn: new Date().toISOString(),
      origen: rutMode === "list" ? "roster-curso" : "aleatorio",
      config: { numQuestions, numOptions, numColumns },
      markedUpTo: effectiveMarkUpTo,
      total: count,
      hojas: truth,
    };
    const suffix = partialMode && effectiveMarkUpTo < numQuestions
      ? `parcial_1-${effectiveMarkUpTo}_de_${numQuestions}_${count}_hojas`
      : `${count}_hojas`;
    downloadBlob(JSON.stringify(meta, null, 2), `verdad_terreno_${suffix}.json`, "application/json");
    await exportPdf(urls, `hojas_prueba_${suffix}.pdf`);
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
            {native && (
              <button onClick={shareNative} disabled={sharing}
                className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50">
                {sharing ? "Compartiendo..." : "Compartir"}
              </button>
            )}
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-5 text-sm">
          {/* Config del lector */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Configuración</h3>
            {quizInfo && (
              <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                📋 Hoja del ensayo: <strong className="text-white">{quizInfo.title || "sin título"}</strong>
                {quizInfo.sheetCode != null && <span className="text-emerald-300"> · código #{quizInfo.sheetCode}</span>}
                <span className="block text-emerald-400/80">Formato heredado del ensayo (bloqueado). <a href="/sheet" className="underline">Generar hoja libre</a></span>
              </div>
            )}
            <label className="block">
              <span className="text-zinc-400">N° de preguntas: <strong className="text-white">{numQuestions}</strong></span>
              <input type="range" min={MIN_QUESTIONS} max={MAX_QUESTIONS} value={numQuestions} disabled={!!quizInfo}
                onChange={(e) => { const n = +e.target.value; setNumQuestions(n); setNumColumns(safeColumns(n, numColumns)); }}
                className="w-full disabled:opacity-50" />
            </label>
            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-zinc-400">Opciones</span>
                <select value={numOptions} disabled={!!quizInfo} onChange={(e) => setNumOptions(+e.target.value)} className={inputCls}>
                  {[3, 4, 5].map((n) => <option key={n} value={n}>{n} ({LABELS.slice(0, n)})</option>)}
                </select>
              </label>
              <label className="flex-1">
                <span className="text-zinc-400">Columnas</span>
                <select value={numColumns} disabled={!!quizInfo} onChange={(e) => setNumColumns(+e.target.value)} className={inputCls}>
                  {allowedColumns(numQuestions).map((n) => <option key={n} value={n}>{n} columna{n > 1 ? "s" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-zinc-500">Rango validado: <strong className="text-zinc-300">{MIN_QUESTIONS}–{MAX_QUESTIONS}</strong> preguntas · 1 col ≤40 · 2 col 12–50 · 3 col 18–90 · 4 col 21–100. Toda config aquí lee 100% (guard <code>test:omr</code>).</p>
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
              Genera hojas autollenadas (RUT + respuestas) + un archivo de
              <strong className="text-white"> verdad-terreno</strong> (JSON). Imprime, escanea y contrasta. Ver <code>docs/plan-pruebas-lector.md</code>.
            </p>

            {/* Origen de los RUTs */}
            <div className="flex gap-2 text-xs">
              <button type="button" onClick={() => setRutMode("random")}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${rutMode === "random" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>
                RUTs aleatorios
              </button>
              <button type="button" onClick={() => setRutMode("list")}
                className={`flex-1 py-1.5 rounded-lg font-semibold ${rutMode === "list" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-300"}`}>
                RUTs de un curso
              </button>
            </div>

            {rutMode === "random" ? (
              <label className="block">
                <span className="text-zinc-400">Cantidad de hojas: <strong className="text-white">{batchN}</strong></span>
                <input type="range" min={1} max={40} value={batchN} onChange={(e) => setBatchN(+e.target.value)} className="w-full" />
              </label>
            ) : (
              <label className="block">
                <span className="text-zinc-400">Pega los RUTs del curso (uno por línea; acepta el CSV <code>rut,nombre,curso</code>)</span>
                <textarea value={rutList} onChange={(e) => setRutList(e.target.value)} rows={5}
                  className={`${inputCls} font-mono text-xs mt-1`} placeholder={"23582062-5\n24505369-K\n…"} />
                <span className="text-indigo-300 text-xs">{parsedRuts.length} RUTs válidos detectados → {parsedRuts.length} hojas</span>
              </label>
            )}

            {/* Premarcado parcial: combina Fase A (auto) + Fase B (a mano) en la misma hoja */}
            <label className="flex items-center gap-2 text-white font-semibold">
              <input type="checkbox" checked={partialMode} onChange={(e) => setPartialMode(e.target.checked)} />
              Premarcado parcial (dejar preguntas en blanco para marcar a mano)
            </label>
            {partialMode && (
              <label className="block">
                <span className="text-zinc-400">
                  Auto-marcar hasta la pregunta <strong className="text-white">{effectiveMarkUpTo}</strong> de {numQuestions}
                  <span className="text-zinc-500"> · quedan {numQuestions - effectiveMarkUpTo} en blanco</span>
                </span>
                <input type="range" min={0} max={numQuestions} value={effectiveMarkUpTo}
                  onChange={(e) => setMarkUpTo(+e.target.value)} className="w-full" />
              </label>
            )}

            <button onClick={generateBatch} disabled={busy || (rutMode === "list" && parsedRuts.length === 0)}
              className="w-full py-2.5 bg-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-500 disabled:opacity-50">
              {busy
                ? "Generando PDF…"
                : partialMode && effectiveMarkUpTo < numQuestions
                  ? `Generar ${rutMode === "list" ? parsedRuts.length : batchN} hojas (1–${effectiveMarkUpTo} auto, ${effectiveMarkUpTo + 1}–${numQuestions} en blanco) + verdad-terreno`
                  : `Generar ${rutMode === "list" ? parsedRuts.length : batchN} hojas (PDF) + verdad-terreno`}
            </button>
          </section>
        </div>
      </main>
    </div>
  );
}
