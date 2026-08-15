"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as C from "@/tulector/compact_layout";
import { CompactBlockPreview } from "@/components/CompactBlockPreview";
import {
  compactBlockPngBlob, compactBlockPdfBlob, downloadBlob, BLOCK_MM, type CompactBlockOptions,
} from "@/lib/compact_block_generator";
import { SHEET_CODE_VERSION, SHEET_COUNTRY_CODES, type SheetCodeData } from "@/lib/sheet_code";
import { parseSheetMode, compactModeIssue, type SheetMode } from "@/lib/sheet_mode";
import { SheetFormatSwitch } from "@/components/SheetFormatSwitch";

/**
 * Generador del BLOQUE OMR COMPACTO (Fase 3 de
 * docs/plan-bloque-omr-compacto-ejecucion.md).
 *
 * Hermano de /sheet, pero para el otro formato: en vez de imprimir la hoja de
 * respuestas de TuLector, entrega una IMAGEN de 98 x 76 mm que el profesor pega
 * dentro de su propia prueba de Word/Canva. Con ?quiz=<id> hereda formato y
 * codigo de hoja del ensayo real (igual que /sheet), asi el lector puede
 * verificar que la hoja escaneada es la del ensayo activo.
 *
 * Lo unico delicado del flujo es el TAMAÑO: si Word reescala el bloque, el
 * lector deja de reconocerlo. Por eso el PNG sale con 300 DPI declarados
 * (chunk pHYs) y la vista previa lleva regla en milimetros.
 */

type QuizInfo = {
  id: string;
  title: string;
  sheetCode: number | null;
  sheetMode: SheetMode;
  numQuestions: number;
  numOptions: number;
};

export default function BloqueCompactoPage() {
  const [numQuestions, setNumQuestions] = useState(20);
  const [numOptions, setNumOptions] = useState(5);
  // 0 = automatico (el minimo de columnas en que caben las preguntas).
  const [numColumns, setNumColumns] = useState(0);
  const [label, setLabel] = useState("");
  const [caption, setCaption] = useState(true);
  const [preview, setPreview] = useState(false);
  const [countryCode, setCountryCode] = useState("CL");
  const [quizInfo, setQuizInfo] = useState<QuizInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Aviso cuando descargar el bloque cambia el formato guardado del ensayo (y
  // por lo tanto a que lector manda "Abrir lector").
  const [formatNote, setFormatNote] = useState("");
  const [backLink, setBackLink] = useState({ href: "/", label: "← Inicio" });

  const cfg: C.CompactConfig = {
    numQuestions,
    numOptions,
    ...(numColumns > 0 ? { numColumns } : {}),
  };
  // El layout es la unica fuente de verdad de cuantas columnas se usan de
  // verdad: si las pedidas no alcanzan, sube solas (compactQuestionLayout).
  const ql = C.compactQuestionLayout(cfg);
  const countryIdx = Math.max(0, SHEET_COUNTRY_CODES.indexOf(countryCode as (typeof SHEET_COUNTRY_CODES)[number]));
  // El bloque SIEMPRE lleva codigo, tenga ensayo o no: en el layout v3 el codigo
  // es lo que hace al papel autodescriptivo (preguntas/opciones/columnas), asi el
  // lector no depende de que el ensayo activo o el localStorage coincidan con lo
  // impreso. sheetId 0 = bloque libre.
  const codeV3 = C.compactCodeFor(cfg, { sheetId: quizInfo?.sheetCode ?? 0, country: countryIdx });
  // Degradacion (sheetId por encima de los 15 bits de v3): se vuelve al codigo v2
  // de siempre, que ata el bloque al ensayo pero no describe la grilla.
  const code: SheetCodeData | undefined = codeV3 ?? (quizInfo?.sheetCode != null
    ? { version: SHEET_CODE_VERSION, country: countryIdx, sheetId: quizInfo.sheetCode, page: 1, pagesTotal: 1 }
    : undefined);

  // Respuestas de muestra SOLO para la vista previa (nunca se exportan): sirven
  // para que el profesor vea como se ve una burbuja marcada antes de imprimir.
  const sampleAnswers = Array.from({ length: numQuestions }, (_, i) => i % numOptions);
  const opts: CompactBlockOptions = {
    cfg,
    ...(code ? { code } : {}),
    ...(label.trim() ? { label: label.trim() } : {}),
    caption,
    ...(preview ? { marks: { answers: sampleAnswers, filled: true } } : {}),
  };
  // Lo que se descarga NUNCA lleva las marcas de muestra.
  const exportOpts: CompactBlockOptions = { ...opts, marks: undefined };

  // Config para el lector en modo libre (sin ensayo): /scan/compacto la lee de
  // localStorage, igual que /sheet hace con tulector_scan_config.
  useEffect(() => {
    try {
      localStorage.setItem("tulector_compact_config", JSON.stringify({
        numQuestions: ql.numQuestions,
        numOptions: ql.numOptions,
        numColumns: ql.numColumns,
      }));
    } catch { /* sin storage */ }
  }, [ql.numQuestions, ql.numOptions, ql.numColumns]);

  // Ensayo heredado via /bloque?quiz=<id>: el bloque toma su formato + codigo.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("quiz");
    if (!id) return;
    (async () => {
      setBackLink({ href: `/dashboard/quizzes/${id}`, label: "← Volver al ensayo" });
      try {
        const res = await fetch(`/api/quiz/${id}`, { credentials: "include", cache: "no-store" });
        if (!res.ok) return;
        const q = await res.json();
        const nq = Number(q.num_questions) || 20;
        const no = Number(q.options_per_question) || 5;
        setNumQuestions(Math.min(C.COMPACT_MAX_QUESTIONS, Math.max(1, nq)));
        setNumOptions(Math.min(5, Math.max(2, no)));
        if (q.country_code) setCountryCode(String(q.country_code));
        if (q.title) setLabel(String(q.title).slice(0, 20));
        setQuizInfo({
          id: String(q.id),
          title: String(q.title ?? ""),
          sheetCode: typeof q.sheet_code === "number" ? q.sheet_code : null,
          sheetMode: parseSheetMode(q.sheet_mode),
          numQuestions: nq,
          numOptions: no,
        });
      } catch { /* sin ensayo -> generador libre */ }
    })();
  }, []);

  // Motivo por el que ESTE ensayo no cabe en un bloque compacto (o null). Se
  // calcula sobre los valores REALES del ensayo, no sobre los recortados al
  // cargarlo: un ensayo de 40 preguntas no se imprime como bloque de 30.
  const quizIssue = quizInfo ? compactModeIssue(quizInfo.numQuestions, quizInfo.numOptions) : null;

  /**
   * Deja anotado en el ensayo que se va a imprimir como BLOQUE COMPACTO.
   *
   * Espejo de rememberFullFormat() en /sheet: el formato se elige aca, al
   * generar, y descargar es el momento en que la eleccion se vuelve real. Sin
   * esto, "Abrir lector" seguiria abriendo el lector de hoja completa y la
   * lectura fallaria sin explicacion.
   */
  const rememberCompactFormat = async () => {
    if (!quizInfo || quizInfo.sheetMode === "compact") return;
    try {
      const res = await fetch(`/api/quiz/${quizInfo.id}/sheet-mode`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "compact" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) { setFormatNote(String(payload?.error ?? "No se pudo guardar el formato del ensayo.")); return; }
      setQuizInfo((prev) => (prev ? { ...prev, sheetMode: "compact" } : prev));
      setFormatNote(payload?.stored === false
        ? "El bloque se descargó, pero el ensayo no quedó marcado como compacto (falta aplicar la migración sheet_mode): “Abrir lector” abrirá el lector de hoja."
        : "Este ensayo quedó configurado como bloque compacto: “Abrir lector” usará el lector de bloque.");
    } catch { /* sin red: el bloque se descarga igual */ }
  };

  const download = async (kind: "png" | "pdf") => {
    setBusy(true);
    setError("");
    try {
      void rememberCompactFormat();
      const base = quizInfo ? `bloque_${quizInfo.title || "ensayo"}` : `bloque_${ql.numQuestions}p`;
      const name = base.replace(/[^\w\-]+/g, "_").slice(0, 60);
      if (kind === "png") {
        downloadBlob(await compactBlockPngBlob(exportOpts), `${name}.png`);
      } else {
        downloadBlob(await compactBlockPdfBlob(exportOpts), `${name}.pdf`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el archivo.");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <Link href={backLink.href} className="text-sm text-zinc-400 hover:text-white">{backLink.label}</Link>
        <h1 className="text-lg font-bold">Bloque compacto</h1>
        <button onClick={() => download("png")} disabled={busy}
          className="px-3 py-1.5 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
          Descargar PNG
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
        {/* Vista previa con regla en mm */}
        <div className="space-y-3">
          <div className="bg-white rounded-xl p-3 shadow-2xl overflow-x-auto">
            <CompactBlockPreview {...opts} maxWidth={620} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => download("png")} disabled={busy}
              className="flex-1 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm font-semibold hover:bg-zinc-700 disabled:opacity-40">
              {busy ? "Generando…" : "Descargar PNG (300 DPI)"}
            </button>
            <button onClick={() => download("pdf")} disabled={busy}
              className="flex-1 py-2 bg-green-600 rounded-lg text-sm font-semibold hover:bg-green-500 disabled:opacity-40">
              Descargar PDF
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300 space-y-1.5">
            <p className="font-bold text-white">Cómo pegarlo en tu prueba</p>
            <p>1. Descarga el <strong>PNG</strong> e insértalo en tu documento (Word: Insertar → Imagen → Este dispositivo).</p>
            <p>2. <strong>No cambies su tamaño.</strong> Debe quedar de {BLOCK_MM.w.toFixed(0)} × {BLOCK_MM.h.toFixed(0)} mm — el PNG ya trae los 300 DPI declarados, así que Word lo inserta en su tamaño correcto solo.</p>
            <p>3. Imprime al <strong>100%</strong> (sin &ldquo;ajustar a página&rdquo;) y comprueba con una regla que mida {BLOCK_MM.w.toFixed(0)} mm de ancho.</p>
            <p>4. Escanea con <Link href="/scan/compacto" className="underline">el lector de bloque compacto</Link>.</p>
          </div>
        </div>

        {/* Controles */}
        <div className="space-y-5 text-sm">
          {/* Mismo selector de formato que /sheet, en el mismo lugar: las dos
              pantallas son dos caras de "generar la hoja". */}
          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Formato</h3>
            <SheetFormatSwitch mode="compact" quizId={quizInfo?.id ?? null} />
            {formatNote && <p className="text-[11px] text-emerald-300">{formatNote}</p>}
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white">Configuración</h3>

            {quizInfo && (
              <div className="rounded-lg border border-emerald-800/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
                📋 Bloque del ensayo: <strong className="text-white">{quizInfo.title || "sin título"}</strong>
                {quizInfo.sheetCode != null && <span className="text-emerald-300"> · código #{quizInfo.sheetCode}</span>}
                <span className="block text-emerald-400/80">Formato heredado del ensayo (bloqueado). <Link href="/bloque" className="underline">Generar bloque libre</Link></span>
              </div>
            )}

            {quizIssue && (
              <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                ⛔ {quizIssue} Este bloque no serviría para escanear ese ensayo.
              </p>
            )}

            {quizInfo && !quizIssue && quizInfo.sheetMode !== "compact" && (
              <p className="rounded-lg border border-amber-900/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
                ⚠ Hoy este ensayo está guardado como <strong>hoja completa</strong>. Al descargar el bloque pasa a
                compacto, y &ldquo;Abrir lector&rdquo; usará el lector de bloque.
              </p>
            )}

            <label className="block">
              <span className="text-zinc-400">N° de preguntas: <strong className="text-white">{numQuestions}</strong> (máx. {C.COMPACT_MAX_QUESTIONS})</span>
              <input type="range" min={1} max={C.COMPACT_MAX_QUESTIONS} value={numQuestions} disabled={!!quizInfo}
                onChange={(e) => setNumQuestions(+e.target.value)}
                className="w-full disabled:opacity-50" />
            </label>

            <div className="flex gap-3">
              <label className="flex-1">
                <span className="text-zinc-400">Opciones</span>
                <select value={numOptions} disabled={!!quizInfo} onChange={(e) => setNumOptions(+e.target.value)} className={inputCls}>
                  {[2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} ({C.OPTION_LABELS.slice(0, n)})</option>)}
                </select>
              </label>
              <label className="flex-1">
                <span className="text-zinc-400">Columnas</span>
                <select value={numColumns} onChange={(e) => setNumColumns(+e.target.value)} className={inputCls}>
                  <option value={0}>Automático ({ql.numColumns})</option>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n} disabled={n < C.minColumnsFor(numQuestions)}>
                      {n} columna{n > 1 ? "s" : ""}{n < C.minColumnsFor(numQuestions) ? ` — no caben ${numQuestions}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs text-zinc-500">
              {ql.rowsPerCol} fila{ql.rowsPerCol === 1 ? "" : "s"} por columna (límite físico: {C.MAX_ROWS}).
              Con {ql.numColumns} columna{ql.numColumns > 1 ? "s" : ""} caben hasta {C.maxQuestionsFor(ql.numColumns)} preguntas.
            </p>

            <label className="block">
              <span className="text-zinc-400">Etiqueta impresa (opcional)</span>
              <input value={label} maxLength={20} disabled={!!quizInfo} onChange={(e) => setLabel(e.target.value)}
                placeholder="Ej: 8°A Matemática" className={`${inputCls} disabled:opacity-50`} />
            </label>

            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={caption} onChange={(e) => setCaption(e.target.checked)} />
              Imprimir la guía &ldquo;pegar al 100%&rdquo; bajo el bloque
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-300">
              <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} />
              Ver marcas de ejemplo (solo vista previa — no se descargan)
            </label>
          </section>

          <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2 text-xs text-zinc-300">
            <h3 className="font-bold text-white text-sm">Qué trae el bloque</h3>
            <p>• Tres marcas de localización tipo QR + una de alineación: el lector lo encuentra dentro de tu hoja aunque tenga texto, tablas o logos alrededor.</p>
            <p>• {codeV3
              ? <>Código impreso arriba con el <strong className="text-white">formato del bloque</strong> ({ql.numQuestions} preguntas · {ql.numOptions} opciones · {ql.numColumns} columna{ql.numColumns > 1 ? "s" : ""}): el lector se configura solo desde el papel, aunque lo pegues en otra prueba.{quizInfo?.sheetCode != null && <> Además lleva el código del ensayo <strong className="text-white">#{quizInfo.sheetCode}</strong> y avisa si escaneas la prueba equivocada.</>}</>
              : <>Código del ensayo <strong className="text-white">#{quizInfo?.sheetCode}</strong> impreso arriba: el lector avisa si escaneas la prueba equivocada, pero no puede verificar la grilla.</>}</p>
            <p>• <strong>No incluye identificación del alumno.</strong> Con un ensayo activo el resultado queda como &ldquo;Sin RUT&rdquo; y lo asignas después desde el panel; para corregir sin alumnos usa la <Link href="/scan/rapido" className="underline">corrección rápida</Link>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
