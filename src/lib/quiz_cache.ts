/**
 * Cache local del ensayo activo, para poder corregir SIN RED.
 *
 * El motor OMR siempre corrio en el cliente, asi que leer una hoja nunca
 * necesito internet. Lo que si venia del servidor era la PAUTA y el formato
 * (`/api/scan/active-quiz`). Sin conexion esa llamada falla, y hasta ahora el
 * escaner se quedaba con una clave de demo hardcodeada: el profesor veia un
 * puntaje que no significaba nada. Guardando el ensayo aca, offline se corrige
 * contra la pauta REAL.
 *
 * Solo se guarda informacion del ensayo (pauta y formato), no datos de alumnos.
 * Las lecturas, que si llevan RUT, siguen yendo a la cola cifrada de
 * offline_queue.ts (Android Keystore / iOS Keychain).
 */

import { QUIZ_MAX_QUESTIONS, parseOpenQuestions, parseOptionOverrides, parseMultiSelectQuestions } from "@/lib/quiz_constraints";
import { safeColumns, LEGACY_OPEN_BOXES_PER_PAGE } from "@/lib/sheet_generator";

export interface CachedScanConfig {
  numQuestions: number;
  numOptions: number;
  numColumns: number;
  optionLabels: string;
  openQuestions: number[];
  optionOverrides: Record<number, number>;
  multiSelectQuestions: number[];
  openBoxesPerPage: number;
}

export interface CachedQuiz {
  quizId: string;
  /** Clave real del ensayo, ya normalizada a letras. */
  answerKey: string[];
  sheetCode: number | null;
  countryCode: string;
  cfg: CachedScanConfig;
  title?: string;
  savedAt: number;
}

/** Guarda el ensayo activo. Silencioso ante fallos: es una optimizacion, no un requisito. */
export function saveQuizPack(key: string, pack: CachedQuiz): void {
  try {
    localStorage.setItem(key, JSON.stringify(pack));
  } catch {
    // sin storage disponible (modo privado, cuota): se sigue sin cache
  }
}

/** Recupera el ensayo cacheado, o null si no hay o esta corrupto. */
export function loadQuizPack(key: string): CachedQuiz | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedQuiz;
    // Validacion minima: sin id o sin config no sirve para corregir.
    if (!parsed?.quizId || !parsed?.cfg?.numQuestions) return null;
    return parsed;
  } catch {
    return null;
  }
}

// ─── Biblioteca de ensayos descargados ─────────────────────────
// Ademas del ensayo activo, se guardan TODOS los del colegio para poder
// cambiar de uno a otro sin red: la pantalla que hoy permite elegir
// (/app/scan) es de servidor y sin conexion no responde.

const LIBRARY_KEY = "tulector_quiz_library";

export interface QuizLibrary {
  quizzes: CachedQuiz[];
  savedAt: number;
}

export function saveQuizLibrary(quizzes: CachedQuiz[]): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ quizzes, savedAt: Date.now() } satisfies QuizLibrary));
  } catch {
    // Cuota llena: se sigue con el ensayo activo, que es lo minimo indispensable.
  }
}

export function loadQuizLibrary(): CachedQuiz[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizLibrary;
    return Array.isArray(parsed?.quizzes) ? parsed.quizzes.filter((q) => q?.quizId && q?.cfg?.numQuestions) : [];
  } catch {
    return [];
  }
}

/** Datos crudos tal como los entrega el endpoint (uno o en lote). */
export interface RawQuizPack {
  id: string;
  title?: string | null;
  answer_key?: string | null;
  num_questions?: number | null;
  options_per_question?: number | null;
  option_labels?: string | null;
  num_columns?: number | null;
  sheet_code?: number | null;
  open_questions?: string | null;
  option_overrides?: string | null;
  multi_select_questions?: string | null;
  open_boxes_per_page?: number | null;
}

export function parseAnswerKey(raw: string): string[] {
  return raw.toUpperCase().split("").filter((c) => "ABCDE".includes(c));
}

/**
 * Traduce un ensayo del servidor a la config que consume el motor.
 *
 * Vive aca (y no en la pantalla de escaneo) para que la carga de UN ensayo y la
 * descarga en lote produzcan exactamente lo mismo. Si divergieran, un ensayo
 * elegido offline podria leerse con una grilla distinta a la del mismo ensayo
 * elegido con red.
 *
 * Multipagina: la grilla de lectura es SIEMPRE de una pagina (maximo
 * QUIZ_MAX_QUESTIONS). Las abiertas, los overrides y la seleccion multiple solo
 * se aplican si el ensayo cabe en una hoja, porque su numeracion local por
 * pagina no se conoce hasta decodificar el codigo de hoja — que se lee DESPUES
 * de aplicar la grilla. Ver docs/plan-multipagina-fase1.md.
 */
export function normalizeQuizPack(raw: RawQuizPack, countryCode: string): CachedQuiz {
  const totalQuestions = Number(raw.num_questions || 20);
  const numQuestions = Math.min(totalQuestions, QUIZ_MAX_QUESTIONS);
  const numOptions = Number(raw.options_per_question || 5);
  const numColumns = safeColumns(numQuestions, Number(raw.num_columns) || (numQuestions > 30 ? 2 : 1));
  const labels = (String(raw.option_labels || "ABCDE").toUpperCase().replace(/[^A-Z]/g, "") || "ABCDE").slice(0, numOptions);
  const fitsOnePage = totalQuestions <= QUIZ_MAX_QUESTIONS;

  return {
    quizId: String(raw.id),
    answerKey: raw.answer_key ? parseAnswerKey(String(raw.answer_key)) : [],
    sheetCode: typeof raw.sheet_code === "number" ? raw.sheet_code : null,
    countryCode: countryCode || "CL",
    title: raw.title ?? undefined,
    savedAt: Date.now(),
    cfg: {
      numQuestions,
      numOptions,
      numColumns,
      optionLabels: labels,
      openQuestions: fitsOnePage ? parseOpenQuestions(raw.open_questions ?? "", numQuestions) : [],
      optionOverrides: fitsOnePage ? parseOptionOverrides(raw.option_overrides ?? "", numQuestions) : {},
      multiSelectQuestions: fitsOnePage ? parseMultiSelectQuestions(raw.multi_select_questions ?? "", numQuestions) : [],
      openBoxesPerPage: typeof raw.open_boxes_per_page === "number" ? raw.open_boxes_per_page : LEGACY_OPEN_BOXES_PER_PAGE,
    },
  };
}
