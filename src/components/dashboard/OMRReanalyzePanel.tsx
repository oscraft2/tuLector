"use client";

import { useState } from "react";
import { findCorners, warpSheet, gradeBubbles, readRut, DEFAULT_CONFIG, type OMRConfig, type BubbleResult } from "@/lib/omr";
import { diagnoseFrame, summarizeFrameDiag, type FrameDiag } from "@/lib/omr_diagnostics";
import { allowedColumns, safeColumns } from "@/lib/sheet_generator";

type SavedAnswer = { q: number; a: string; s: number[] };

interface Props {
  photo: string | null;
  savedAnswers: SavedAnswer[];
  savedRut?: string;
}

/**
 * "Re-analizar con el motor actual": corre el motor de HOY sobre la foto
 * guardada de un scan_log, en el navegador (mismo motor client-side que usa
 * /scan). Dos pasos porque scan_logs no guarda la config de la hoja
 * (numQuestions/numOptions/numColumns) -- ver plan en docs, seccion
 * "Auditoria OMR": el diagnostico de esquinas/nitidez no depende de esa
 * config (geometria pura) y siempre esta disponible; calificar burbujas si
 * necesita que el staff confirme la config, con una estimacion precargada.
 */
export function OMRReanalyzePanel({ photo, savedAnswers, savedRut }: Props) {
  const [diag, setDiag] = useState<FrameDiag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [numQuestions, setNumQuestions] = useState(savedAnswers.length || 20);
  const [numOptions, setNumOptions] = useState(5);
  const [numColumns, setNumColumns] = useState(1);

  const [freshAnswers, setFreshAnswers] = useState<BubbleResult[] | null>(null);
  const [freshRut, setFreshRut] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);

  const loadImageData = (): Promise<ImageData> =>
    new Promise((resolve, reject) => {
      if (!photo) { reject(new Error("Este log no tiene foto guardada.")); return; }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("No se pudo crear el canvas.")); return; }
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.onerror = () => reject(new Error("No se pudo cargar la foto."));
      img.src = photo;
    });

  const reanalyze = async () => {
    setBusy(true);
    setError(null);
    setFreshAnswers(null);
    setFreshRut(null);
    try {
      const frame = await loadImageData();
      const result = diagnoseFrame(frame);
      setDiag(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const gradeWithConfig = async () => {
    setGrading(true);
    setError(null);
    try {
      const frame = await loadImageData();
      const corners = findCorners(frame);
      if (!corners) { setError("Las esquinas ya no se detectan -- no se puede calificar."); return; }
      const config: OMRConfig = {
        ...DEFAULT_CONFIG,
        numQuestions,
        numOptions,
        optionLabels: "ABCDE".slice(0, numOptions),
        numColumns,
      };
      const warped = warpSheet(frame, corners, config);
      const report = gradeBubbles(warped, config, corners);
      const rutR = readRut(warped, config);
      setFreshAnswers(report.results ?? []);
      setFreshRut(rutR.rut || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGrading(false);
    }
  };

  const savedByQ = new Map(savedAnswers.map((a) => [a.q, a.a]));
  const freshByQ = new Map((freshAnswers ?? []).map((r) => [r.question, r.answer]));
  const contrastRows = freshAnswers
    ? Array.from({ length: numQuestions }, (_, i) => i + 1).map((q) => ({
        q, then: savedByQ.get(q) ?? "-", now: freshByQ.get(q) ?? "-",
      }))
    : [];
  const mismatches = contrastRows.filter((r) => r.then !== r.now).length;

  return (
    <div className="rounded-md border border-[#e5e7eb] bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-[#111827]">Re-analizar con el motor actual</h2>
        <button
          onClick={reanalyze}
          disabled={busy || !photo}
          className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Analizando…" : "Re-analizar"}
        </button>
      </div>
      {!photo && <p className="text-xs text-[#9ca3af]">Este log no tiene foto original guardada -- no se puede re-analizar.</p>}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

      {diag && (
        <div className="space-y-3">
          <div className={`rounded-md border p-3 text-sm ${diag.cornersFound && diag.sharpPassed ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {summarizeFrameDiag(diag)}
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="rounded bg-[#f8fafc] p-2">
              <p className="text-[#6b7280]">Esquinas</p>
              <p className="font-semibold text-[#111827]">{diag.cornersFound ? "Detectadas" : "No detectadas"}</p>
            </div>
            <div className="rounded bg-[#f8fafc] p-2">
              <p className="text-[#6b7280]">Nitidez</p>
              <p className="font-semibold text-[#111827]">{Math.round(diag.sharpScore)} <span className="font-normal text-[#9ca3af]">(min 40)</span></p>
            </div>
            <div className="rounded bg-[#f8fafc] p-2">
              <p className="text-[#6b7280]">% píxeles oscuros</p>
              <p className="font-semibold text-[#111827]">{(diag.darkRatio * 100).toFixed(1)}%</p>
            </div>
          </div>

          {diag.cornersFound && (
            <div className="rounded-md border border-[#e5e7eb] p-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Calificar con esta config (no guardada en el log original)</p>
              <div className="flex flex-wrap gap-2">
                <select value={numQuestions} onChange={(e) => setNumQuestions(+e.target.value)} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                  {[10, 15, 20, 25, 30, 40, 50].map((n) => <option key={n} value={n}>{n} preg</option>)}
                </select>
                <select value={numOptions} onChange={(e) => setNumOptions(+e.target.value)} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                  {[3, 4, 5].map((n) => <option key={n} value={n}>{n} opc</option>)}
                </select>
                <select value={numColumns} onChange={(e) => setNumColumns(+e.target.value)} className="rounded border border-[#cfd6df] px-2 py-1 text-xs">
                  {allowedColumns(numQuestions).map((n) => <option key={n} value={n}>{n} col</option>)}
                </select>
                <button
                  onClick={() => { setNumColumns((c) => safeColumns(numQuestions, c)); gradeWithConfig(); }}
                  disabled={grading}
                  className="rounded-md bg-[#07305f] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {grading ? "Calificando…" : "Calificar con esta config"}
                </button>
              </div>

              {freshRut && (
                <p className="text-xs">
                  <span className="text-[#6b7280]">RUT ahora: </span>
                  <span className="font-semibold text-[#111827]">{freshRut}</span>
                  {savedRut && savedRut !== freshRut && <span className="ml-2 font-semibold text-red-600">(antes: {savedRut})</span>}
                </p>
              )}

              {freshAnswers && (
                <div>
                  <p className="mb-1 text-xs font-semibold text-[#111827]">
                    {mismatches === 0 ? "Coincide en todas las preguntas." : `${mismatches} pregunta(s) con lectura distinta a la guardada.`}
                  </p>
                  <div className="grid grid-cols-10 gap-1">
                    {contrastRows.map((r) => (
                      <div key={r.q} className={`rounded p-1 text-center text-[10px] ${r.then !== r.now ? "border border-red-300 bg-red-50" : "bg-[#f8fafc]"}`} title={`Q${r.q}: entonces=${r.then} ahora=${r.now}`}>
                        <div className="text-[#9ca3af]">{r.q}</div>
                        <div className="font-mono font-semibold text-[#111827]">{r.now}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
