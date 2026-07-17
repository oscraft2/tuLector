"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SHEET_W, SHEET_H, type SheetConfig } from "@/lib/sheet_layout";
import {
  renderSheet, randomValidNationalId, randomAnswers, randomPartialAnswers, safeColumns, allowedColumns,
  paginateQuiz, MIN_QUESTIONS, MAX_QUESTIONS, type Branding, type GroundTruthEntry, type SheetMarks, type QuizPage,
} from "@/lib/sheet_generator";
import { resolveNationalId } from "@/lib/national_id";
import { countryProfiles, resolveCountryProfile } from "@/lib/country_profiles";
import { resolveIdBlock } from "@/lib/country_id_blocks";
import { SHEET_CODE_VERSION, SHEET_COUNTRY_CODES, type SheetCodeData } from "@/lib/sheet_code";
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
  // Pais (decide el bloque de ID nacional a imprimir: RUT/DNI/CPF/CC/Cedula/CI).
  // Manual en el generador libre; heredado del colegio cuando viene de ?quiz=<id>.
  const [countryCode, setCountryCode] = useState("CL");
  const countryProfile = resolveCountryProfile(countryCode);
  const idBlock = resolveIdBlock(countryCode);

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

  // Parsea la lista pegada (acepta "id" o "id,nombre,curso" por línea, salta
  // encabezado). Devuelve IDs válidos (segun el pais elegido) normalizados, sin duplicados.
  const parseRutList = (raw: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const line of raw.split(/\r?\n/)) {
      const first = line.split(",")[0]?.trim() ?? "";
      if (!first || /rut|dni|cpf|cedula|c[eé]dula/i.test(first)) continue; // vacío o encabezado
      const resolved = resolveNationalId(first, countryCode);
      if (!resolved.valid) continue;
      if (seen.has(resolved.normalized)) continue;
      seen.add(resolved.normalized);
      out.push(resolved.normalized);
    }
    return out;
  };
  const parsedRuts = rutMode === "list" ? parseRutList(rutList) : [];
  // Nº de preguntas que quedan auto-marcadas; el resto en blanco (marcado a mano).
  const effectiveMarkUpTo = partialMode ? Math.max(0, Math.min(markUpTo, numQuestions)) : numQuestions;

  // Multipagina (Fase 1, ver docs/plan-multipagina-fase1.md): un ensayo de
  // mas de MAX_QUESTIONS preguntas se reparte en N hojas de tamano fijo, cada
  // una impresa/leida como hoja independiente (motor sin cambios). Con 1 sola
  // pagina (el caso de hoy) `pages` tiene 1 elemento igual al total -> cero
  // cambio de comportamiento.
  const pages: QuizPage[] = paginateQuiz(numQuestions);
  const isMultipage = pages.length > 1;
  const countryIdx = Math.max(0, SHEET_COUNTRY_CODES.indexOf(countryCode as (typeof SHEET_COUNTRY_CODES)[number]));

  // IMPORTANTE: en multipagina, TODAS las paginas usan el mismo grid FIJO
  // (MAX_QUESTIONS) -- incluida la ultima, aunque le sobren filas de burbujas
  // sin usar. /scan lee con una config ESTATICA por ensayo (no sabe que
  // pagina tiene delante de la camara hasta leer el codigo de hoja, que se
  // decodifica DESPUES de aplicar la grilla de lectura) -- si el tamano de
  // grid variara entre paginas, la ultima pagina se leeria mal. Con 1 sola
  // pagina (pages.length===1, el caso de hoy) se usa el tamano real pedido,
  // sin cambio de comportamiento. Ver docs/plan-multipagina-fase1.md.
  const pageGridSize = isMultipage ? MAX_QUESTIONS : numQuestions;
  // Recibe QuizPage por consistencia con marksForPage/brandingForPage (se
  // llaman las 3 juntas por pagina), aunque el grid ya no varia por pagina.
  const cfgForPage = (_p: QuizPage): SheetConfig => ({
    numQuestions: pageGridSize,
    numOptions,
    numColumns: safeColumns(pageGridSize, numColumns),
    idBlock,
  });
  const marksForPage = (p: QuizPage): SheetMarks => ({
    ...(fillRut ? { rut, filled: true } : {}),
    ...(quizInfo && quizInfo.sheetCode != null
      ? { code: { version: SHEET_CODE_VERSION, country: countryIdx, sheetId: quizInfo.sheetCode, page: p.page, pagesTotal: pages.length } as SheetCodeData }
      : {}),
  });
  const brandingForPage = (p: QuizPage): Branding => ({
    title, school, logo,
    ...(isMultipage ? { pageInfo: `Página ${p.page} de ${pages.length} — Preguntas ${p.from}–${p.to}` } : {}),
  });

  // Config/marcas/branding de la PRIMERA pagina: usados por la vista previa,
  // "Descargar PNG" y "Compartir" (solo esas dos exportan una unica imagen;
  // con varias paginas hay que usar "Descargar PDF", que si exporta todas).
  const cfg: SheetConfig = cfgForPage(pages[0] ?? { page: 1, from: 1, to: numQuestions, count: numQuestions });
  const marks: SheetMarks = marksForPage(pages[0] ?? { page: 1, from: 1, to: numQuestions, count: numQuestions });
  const branding: Branding = brandingForPage(pages[0] ?? { page: 1, from: 1, to: numQuestions, count: numQuestions });

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
  }, [numQuestions, numOptions, numColumns, countryCode, title, school, logo, fillRut, rut, quizInfo]);

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
        // Columnas por PAGINA (max MAX_QUESTIONS), no por el total del ensayo
        // -- para un ensayo multipagina, num_columns describe una hoja de
        // 100 preguntas como maximo, no las 250 que pueda tener el total.
        setNumColumns(safeColumns(Math.min(nq, MAX_QUESTIONS), Number(q.num_columns) || 1));
        if (q.title) setTitle(String(q.title));
        if (q.country_code) {
          setCountryCode(String(q.country_code));
          if (fillRut) setRut(randomValidNationalId(String(q.country_code)));
        }
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

  /** Renderiza una hoja a dataURL PNG (2x para nitidez de impresión). Usa la
   *  config/branding de la PAGINA 1 (ver comentario mas arriba). */
  const renderToDataUrl = (m: SheetMarks) => {
    const c = document.createElement("canvas");
    c.width = SHEET_W * 2; c.height = SHEET_H * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    renderSheet(ctx, m, cfg, branding);
    return c.toDataURL("image/png");
  };

  /** Renderiza UNA pagina especifica (multipagina) a dataURL PNG. */
  const renderPageToDataUrl = (p: QuizPage) => {
    const c = document.createElement("canvas");
    c.width = SHEET_W * 2; c.height = SHEET_H * 2;
    const ctx = c.getContext("2d")!;
    ctx.scale(2, 2);
    renderSheet(ctx, marksForPage(p), cfgForPage(p), brandingForPage(p));
    return c.toDataURL("image/png");
  };

  // Multipagina: exporta las N hojas como un solo PDF de N paginas (exportPdf
  // ya soporta multi-pagina, se reusa sin cambios). 1 pagina -> comportamiento
  // identico al de siempre.
  const pdfOne = () => exportPdf(
    pages.map((p) => renderPageToDataUrl(p)),
    fillRut ? `hoja_tulector_${rut}.pdf` : "hoja_tulector.pdf",
  );

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
      alert(`Pega al menos un ${countryProfile.studentIdLabel} válido del curso (una fila por alumno).`);
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
        r = randomValidNationalId(countryCode);
        while (usedRuts.has(r)) r = randomValidNationalId(countryCode);
        usedRuts.add(r);
      }
      const ans = partialMode
        ? randomPartialAnswers(numQuestions, numOptions, effectiveMarkUpTo)
        : randomAnswers(numQuestions, numOptions);
      urls.push(renderToDataUrl({ rut: r, answers: ans, filled: true, ...(marks.code ? { code: marks.code } : {}) }));
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
            <button onClick={downloadPNG} disabled={isMultipage} title={isMultipage ? "PNG solo exporta la pagina 1 — usa Descargar PDF para las N hojas" : undefined}
              className="flex-1 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-semibold hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed">
              Descargar PNG
            </button>
            <button onClick={pdfOne} className="flex-1 py-2 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500">
              Descargar PDF{isMultipage ? ` (${pages.length} hojas)` : ""}
            </button>
            {native && (
              <button onClick={shareNative} disabled={sharing || isMultipage} title={isMultipage ? "Compartir solo envia la pagina 1 — usa Descargar PDF para las N hojas" : undefined}
                className="flex-1 py-2 bg-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed">
                {sharing ? "Compartiendo..." : "Compartir"}
              </button>
            )}
          </div>
          {isMultipage && (
            <p className="text-xs text-amber-400">
              ⚠ Este ensayo tiene {numQuestions} preguntas → se imprime en {pages.length} hojas (cada una con su propio bloque de ID, se pueden escanear en cualquier orden). Usa <strong>Descargar PDF</strong> para obtener las {pages.length} páginas.
            </p>
          )}
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
              <span className="text-zinc-400">País (bloque de ID a imprimir)</span>
              <select value={countryCode} disabled={!!quizInfo}
                onChange={(e) => { setCountryCode(e.target.value); if (fillRut) setRut(randomValidNationalId(e.target.value)); }}
                className={`${inputCls} disabled:opacity-50`}>
                {countryProfiles.map((p) => <option key={p.code} value={p.code}>{p.flag} {p.countryName} ({p.studentIdLabel})</option>)}
              </select>
            </label>
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
                <span className="text-zinc-400">Columnas{isMultipage ? " (por hoja)" : ""}</span>
                <select value={numColumns} disabled={!!quizInfo} onChange={(e) => setNumColumns(+e.target.value)} className={inputCls}>
                  {/* Columnas de UNA hoja (max MAX_QUESTIONS), no del total del ensayo. */}
                  {allowedColumns(Math.min(numQuestions, MAX_QUESTIONS)).map((n) => <option key={n} value={n}>{n} columna{n > 1 ? "s" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Rango validado por hoja: <strong className="text-zinc-300">{MIN_QUESTIONS}–{MAX_QUESTIONS}</strong> preguntas · 1 col ≤40 · 2 col 12–50 · 3 col 18–90 · 4 col 21–100. Toda config aquí lee 100% (guard <code>test:omr</code>).
              {isMultipage && ` Con más de ${MAX_QUESTIONS} preguntas se reparte en varias hojas.`}
            </p>
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

          {/* Hoja patrón ID de referencia */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <label className="flex items-center gap-2 text-white font-semibold">
              <input type="checkbox" checked={fillRut}
                onChange={(e) => { setFillRut(e.target.checked); if (e.target.checked) setRut(randomValidNationalId(countryCode)); }} />
              Rellenar {countryProfile.studentIdLabel} de referencia (válido)
            </label>
            {fillRut && (
              <input value={rut} onChange={(e) => setRut(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder={countryProfile.studentIdExample} />
            )}
            <p className="text-zinc-400 text-xs">Imprime una hoja con el {countryProfile.studentIdLabel} ya marcado para verificar el lector sin marcado a mano.</p>
          </section>

          {/* Beta autollenado -- NO soporta multipagina todavia (ver docs/plan-multipagina-fase1.md) */}
          <section className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">🧪 Beta — pruebas masivas (ideal vs real)</h3>
            {isMultipage ? (
              <p className="text-amber-400 text-xs">⚠ El autollenado masivo todavía no soporta ensayos multipágina. Usa <strong>Descargar PDF</strong> arriba para las hojas reales.</p>
            ) : (
              <p className="text-zinc-400 text-xs">
                Genera hojas autollenadas (RUT + respuestas) + un archivo de
                <strong className="text-white"> verdad-terreno</strong> (JSON). Imprime, escanea y contrasta. Ver <code>docs/plan-pruebas-lector.md</code>.
              </p>
            )}

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

            <button onClick={generateBatch} disabled={busy || isMultipage || (rutMode === "list" && parsedRuts.length === 0)}
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
