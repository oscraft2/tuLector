/**
 * Comparador "ideal vs real" (herramienta #4 del plan de pruebas).
 * Cruza la verdad-terreno del generador (por RUT) con los scan_logs reales y
 * calcula las métricas de exactitud. Solo lectura — no toca el motor.
 * Ver docs/plan-pruebas-lector.md.
 */
import { type GroundTruthEntry } from "@/lib/sheet_generator";
import { type ScanLogRow, type ScanLogPayload } from "@/lib/scan_log";

export interface SheetResult {
  index: number;
  rut: string;
  matched: boolean;   // se encontró un escaneo con ese RUT (RUT leído OK)
  correct: number;
  total: number;
  wrong: number[];    // nº de pregunta erradas
  reason?: string;                              // motivo del fallo, si no matched
  readAnswers?: { q: number; a: string }[];      // lo que se alcanzó a leer, si no matched
}

export interface TestReport {
  sheets: SheetResult[];
  bubbleAcc: number;  // burbujas correctas / total (solo hojas emparejadas)
  sheetAcc: number;   // hojas 100% correctas / emparejadas
  rutAcc: number;     // hojas emparejadas / total (proxy de exactitud del RUT)
  matched: number;
  total: number;
  correctBubbles: number;
  totalBubbles: number;
}

/** Normaliza un RUT para emparejar (sin puntos/guiones, mayúscula). */
function normRut(r: string): string {
  return r.replace(/[.\-\s]/g, "").toUpperCase();
}

export function buildReport(truth: GroundTruthEntry[], logs: ScanLogRow[]): TestReport {
  // Índice del escaneo MÁS RECIENTE por RUT (logs vienen desc por fecha).
  const byRut = new Map<string, ScanLogPayload>();
  // Hojas que fallaron: por RUT (si se alcanzó a leer) y por índice de la
  // verdad-terreno (análisis headless, id = "headless-<index>", RUT vacío
  // cuando ni siquiera se detectaron las esquinas). Sin esto, una hoja que no
  // matchea no deja ningún rastro de por qué -- justo lo que se pidió mostrar.
  const failByRut = new Map<string, ScanLogPayload>();
  const failByIndex = new Map<number, ScanLogPayload>();
  for (const row of logs) {
    const p = row.log;
    if (p?.type === "scan" && p.rut) {
      const key = normRut(p.rut);
      if (!byRut.has(key)) byRut.set(key, p);
    } else if (p?.type === "scan_fail") {
      if (p.rut) failByRut.set(normRut(p.rut), p);
      const m = /^headless-(\d+)$/.exec(row.id);
      if (m) failByIndex.set(Number(m[1]), p);
    }
  }

  let correctBubbles = 0, totalBubbles = 0, perfect = 0, matched = 0;
  const sheets: SheetResult[] = truth.map((t) => {
    const scan = byRut.get(normRut(t.rut));
    if (!scan) {
      const fail = failByIndex.get(t.index) ?? failByRut.get(normRut(t.rut));
      return {
        index: t.index, rut: t.rut, matched: false, correct: 0, total: t.answers.length, wrong: [],
        reason: fail?.result?.reason,
        readAnswers: fail?.answers?.map((a) => ({ q: a.q, a: a.a })),
      };
    }
    matched++;
    const ansMap = new Map((scan.answers ?? []).map((a) => [a.q, a.a]));
    const wrong: number[] = [];
    t.answers.forEach((expected, i) => {
      const got = ansMap.get(i + 1) ?? "-";
      if (got !== expected) wrong.push(i + 1);
    });
    const correct = t.answers.length - wrong.length;
    correctBubbles += correct; totalBubbles += t.answers.length;
    if (wrong.length === 0) perfect++;
    return { index: t.index, rut: t.rut, matched: true, correct, total: t.answers.length, wrong };
  });

  return {
    sheets,
    bubbleAcc: totalBubbles ? correctBubbles / totalBubbles : 0,
    sheetAcc: matched ? perfect / matched : 0,
    rutAcc: truth.length ? matched / truth.length : 0,
    matched, total: truth.length,
    correctBubbles, totalBubbles,
  };
}
