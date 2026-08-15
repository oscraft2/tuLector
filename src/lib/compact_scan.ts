/**
 * Pipeline de lectura del BLOQUE COMPACTO, compartido por las dos pantallas que
 * lo escanean: /scan/compacto (con ensayo, guarda nota) y /scan/rapido
 * (correccion sin alumnos, solo pantalla).
 *
 * Lo importante aca es el ORDEN. Antes se calificaba y despues se leia el codigo
 * impreso, que quedaba como aviso decorativo; ahora el codigo se lee PRIMERO,
 * porque en el layout v3 (ver compact_layout.compactCodeFor) el papel declara su
 * propia grilla — preguntas, opciones y columnas. Esa declaracion manda sobre lo
 * que crea la pantalla: un bloque impreso en 2 columnas leido con la grilla de 1
 * devuelve todas las respuestas corridas y sin ningun sintoma visible.
 */
import * as C from "@/tulector/compact_layout";
import {
  detectCompactBlock, warpCompactBlock, readCompactCode, gradeCompactBlock,
} from "@/tulector/compact_block";
import type { BubbleResult } from "@/tulector/omr";
import type { SheetCodeData } from "@/tulector/sheet_code";

export interface CompactScanOk {
  ok: true;
  results: BubbleResult[];
  /** Config con la que se leyo de verdad (del papel si es v3, si no la de respaldo). */
  cfg: C.CompactConfig;
  /** true = la grilla la declaro el propio bloque; false = se asumio la de respaldo. */
  selfDescribed: boolean;
  code: SheetCodeData | null;
  warp: ImageData;
  usedTiming: boolean;
}

export interface CompactScanFail {
  ok: false;
  /** Mensaje listo para mostrar. */
  reason: string;
  kind: "not_found" | "unreadable";
}

export type CompactScanResult = CompactScanOk | CompactScanFail;

/** Detecta, rectifica, lee el codigo y califica un cuadro (camara o archivo). */
export function readCompactFrame(frame: ImageData, fallbackCfg: C.CompactConfig): CompactScanResult {
  const detection = detectCompactBlock(frame);
  if (!detection) {
    return {
      ok: false,
      kind: "not_found",
      reason: "No se encontró un bloque de TuLector en la foto. Acerca la cámara y cuida que las 4 marcas de las esquinas se vean completas.",
    };
  }

  const warp = warpCompactBlock(frame, detection.corners);
  const code = readCompactCode(warp);
  const fromPaper = C.compactConfigFromCode(code);
  const cfg = fromPaper ?? fallbackCfg;

  const report = gradeCompactBlock(warp, cfg);
  if (!report.valid) {
    return {
      ok: false,
      kind: "unreadable",
      reason: `No se pudo leer el bloque: ${report.reason ?? "lectura inválida"}. Repite la foto con mejor luz y sin sombras.`,
    };
  }

  return {
    ok: true,
    results: report.results,
    cfg,
    selfDescribed: fromPaper !== null,
    code,
    warp,
    usedTiming: report.usedTiming,
  };
}

/** true si las dos configuraciones dibujan la MISMA grilla. */
export function sameCompactGrid(a: C.CompactConfig, b: C.CompactConfig): boolean {
  const la = C.compactQuestionLayout(a), lb = C.compactQuestionLayout(b);
  return la.numQuestions === lb.numQuestions
    && la.numOptions === lb.numOptions
    && la.numColumns === lb.numColumns;
}

/** Descripcion corta de una grilla, para los mensajes de desajuste. */
export function describeCompactCfg(cfg: C.CompactConfig): string {
  const ql = C.compactQuestionLayout(cfg);
  return `${ql.numQuestions} preguntas · ${ql.numOptions} opciones · ${ql.numColumns} columna${ql.numColumns > 1 ? "s" : ""}`;
}

// ─── Comparacion contra la pauta ───────────────────────────────

export type AnswerState = "correct" | "wrong" | "blank" | "doubt" | "unknown";

export interface CheckedAnswer {
  q: number;
  /** Lo que marco el alumno: letra, "-" (en blanco), "?" (reflejo) o varias letras. */
  marked: string;
  /** Letra correcta, o null si no hay pauta para esa pregunta. */
  expected: string | null;
  state: AnswerState;
  /** Aviso del clasificador (marca debil, multi-marca, brillo). */
  note?: string;
}

/**
 * Cruza la lectura con la pauta. `key` es la clave por pregunta ("A", "B", …);
 * una posicion vacia significa "esta pregunta no se puntua".
 *
 * Un "?" o una multi-marca NO se cuentan como correctas aunque incluyan la letra
 * buena: el motor esta diciendo que no esta seguro de lo que hay en el papel, y
 * dar por buena una lectura dudosa es peor que pedir una segunda foto.
 */
export function checkAgainstKey(results: BubbleResult[], key: string[]): CheckedAnswer[] {
  return results.map((r) => {
    const expected = (key[r.question - 1] || "").toUpperCase() || null;
    const marked = r.answer;
    let state: AnswerState;
    if (marked === "-") state = "blank";
    else if (marked === "?" || marked.length > 1) state = "doubt";
    else if (!expected) state = "unknown";
    else state = marked === expected ? "correct" : "wrong";
    return {
      q: r.question,
      marked,
      expected,
      state,
      // Solo "revisar" es un aviso util: "blanco" ya se ve en el estado y
      // repetirlo como nota llena la pantalla de ruido.
      ...(r.flag === "revisar" ? { note: r.flagReason ?? "revisar" } : {}),
    };
  });
}

/** Correctas / puntuables, a partir de lo ya cruzado con la pauta. */
export function tallyChecked(checked: CheckedAnswer[]): { correct: number; total: number } {
  let correct = 0, total = 0;
  for (const c of checked) {
    if (!c.expected) continue;
    total++;
    if (c.state === "correct") correct++;
  }
  return { correct, total };
}
