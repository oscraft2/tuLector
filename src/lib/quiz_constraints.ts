export const QUIZ_MIN_QUESTIONS = 1;
// Sobre SEGURO validado por test:omr (guard "Config sweep" en test_omr_real.ts):
// 1 col ≤40, 2 col 12-50, 3 col 18-90, 4 col 21-100 (nivel ZipGrade en 1 hoja,
// jul 2026). El nº de columnas real se deriva en dashboard/actions.ts con
// sheet_generator.suggestColumns, no queda fijo en 1.
// QUIZ_MAX_QUESTIONS es el tope de UNA hoja fisica (una pagina). Un ensayo
// puede tener mas preguntas que eso repartidas en varias hojas -- ver
// QUIZ_MAX_PAGES y docs/plan-multipagina-fase1.md (Fase 1, motor sin tocar:
// cada pagina se imprime/lee como hoja independiente de tamano fijo).
export const QUIZ_MAX_QUESTIONS = 100;
export const QUIZ_MAX_PAGES = 4;
export const QUIZ_MAX_QUESTIONS_MULTIPAGE = QUIZ_MAX_QUESTIONS * QUIZ_MAX_PAGES;
export const QUIZ_OPTION_LABELS = "ABCDE";
export const QUIZ_ALLOWED_OPTIONS = [3, 4, 5] as const;

export type QuizOptionCount = (typeof QUIZ_ALLOWED_OPTIONS)[number];

export function normalizeQuestionCount(value: FormDataEntryValue | string | number | null | undefined): number {
  const parsed = Number(value ?? 20);
  if (!Number.isInteger(parsed)) return 20;
  // Tope MULTIPAGE (no QUIZ_MAX_QUESTIONS): un ensayo puede superar 1 pagina.
  return Math.max(QUIZ_MIN_QUESTIONS, Math.min(QUIZ_MAX_QUESTIONS_MULTIPAGE, parsed));
}

export function normalizeQuizOptions(value: FormDataEntryValue | string | number | null | undefined): QuizOptionCount {
  const parsed = Number(value ?? 5);
  return QUIZ_ALLOWED_OPTIONS.includes(parsed as QuizOptionCount) ? (parsed as QuizOptionCount) : 5;
}

export function optionLabelsFor(numOptions: number): string {
  return QUIZ_OPTION_LABELS.slice(0, normalizeQuizOptions(numOptions));
}

export function normalizeAnswerKeyForOptions(input: FormDataEntryValue | string | null | undefined, numOptions: number): string {
  const allowed = new Set(optionLabelsFor(numOptions).split(""));
  return String(input ?? "")
    .toUpperCase()
    .split("")
    .filter((char) => allowed.has(char))
    .join("");
}

/**
 * Igual que normalizeAnswerKeyForOptions, pero preserva la POSICION de cada
 * pregunta usando "-" como placeholder de "todavia sin responder" en vez de
 * descartar caracteres invalidos (lo que colapsaria/correria el resto de la
 * clave). Usado por el flujo "completar la clave mas tarde": el resultado
 * siempre mide exactamente numQuestions caracteres, cada uno una letra
 * valida o "-". Una posicion "-" nunca cuenta como correcta al corregir
 * (ver answerKeyAt/finalizeGrading), es un placeholder seguro.
 */
export function normalizeAnswerKeySlots(
  input: FormDataEntryValue | string | null | undefined,
  numOptions: number,
  numQuestions: number,
): string {
  const allowed = new Set(optionLabelsFor(numOptions).split(""));
  const chars = String(input ?? "")
    .toUpperCase()
    .split("")
    .filter((char) => allowed.has(char) || char === "-")
    .slice(0, numQuestions);
  while (chars.length < numQuestions) chars.push("-");
  return chars.join("");
}

/**
 * Parsea la lista de preguntas de desarrollo (abiertas) tal como la tipea el
 * profesor ("18, 27,33") o como viene de BD (CSV canonico "18,27,33") a
 * numeros de pregunta 1-indexados: unicos, ordenados asc, dentro de
 * 1..numQuestions. Tolerante a separadores/basura arbitraria. Una pregunta
 * abierta se imprime sin burbujas ("resolver al reverso") y queda fuera del
 * puntaje automatico (ver computeQuizScore en grading.ts).
 */
export function parseOpenQuestions(
  value: FormDataEntryValue | string | null | undefined,
  numQuestions: number,
): number[] {
  const nums = String(value ?? "")
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= numQuestions);
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** Serializa a la forma canonica de BD ("18,27,33") o null si no hay abiertas. */
export function serializeOpenQuestions(open: number[]): string | null {
  return open.length > 0 ? open.join(",") : null;
}

/**
 * Cuantas preguntas CERRADAS quedaron sin respuesta en la clave.
 *
 * Una pregunta de desarrollo lleva "-" en la clave por definicion (no tiene
 * alternativa correcta), asi que buscar "-" a secas marcaba como "clave
 * incompleta" a todo ensayo con abiertas aunque estuviera completo -- bug real
 * en el listado de ensayos con los instrumentos DIA. Este es el unico criterio:
 * lo usan el listado y el detalle del ensayo.
 */
export function countMissingKeySlots(quiz: {
  answer_key?: string | null;
  num_questions?: number | null;
  open_questions?: string | null;
}): number {
  const total = Number(quiz.num_questions ?? 0);
  if (total <= 0) return 0;
  const open = new Set(parseOpenQuestions(quiz.open_questions ?? "", total));
  const key = String(quiz.answer_key ?? "");
  let missing = 0;
  for (let q = 1; q <= total; q++) {
    if (open.has(q)) continue;
    const slot = key[q - 1] ?? "-";
    if (slot === "-" || slot.trim() === "") missing++;
  }
  return missing;
}

/** true si a la clave le falta al menos una respuesta CERRADA. */
export function isAnswerKeyIncomplete(quiz: {
  answer_key?: string | null;
  num_questions?: number | null;
  open_questions?: string | null;
}): boolean {
  return countMissingKeySlots(quiz) > 0;
}

/**
 * Preguntas de seleccion MULTIPLE ("marca todas las correctas": varias
 * burbujas marcadas son una respuesta valida, a diferencia de seleccion
 * unica). Mismo formato/semantica que openQuestions (lista de nº de pregunta
 * 1-indexados, unica, ordenada, CSV "20,29") -- se reusan las MISMAS
 * funciones a proposito, no hace falta duplicar el parser.
 */
export const parseMultiSelectQuestions = parseOpenQuestions;
export const serializeMultiSelectQuestions = serializeOpenQuestions;

/**
 * Parsea overrides de nº de opciones por pregunta puntual ("20:3,29:6" o como
 * lo tipee el profesor) a un mapa {pregunta: nOpciones}, 1-indexado. Sirve
 * para replicar instrumentos de terceros con nº de opciones variable por
 * pregunta (ej. una hoja DIA con una pregunta A-B-C en vez de A-B-C-D, u otra
 * de seleccion multiple con 6 casillas). Tolerante a separadores/basura;
 * descarta pares fuera de rango en vez de fallar.
 */
export function parseOptionOverrides(
  value: FormDataEntryValue | string | null | undefined,
  numQuestions: number,
): Record<number, number> {
  const out: Record<number, number> = {};
  const pairs = String(value ?? "").split(/[,;\s]+/).filter(Boolean);
  for (const pair of pairs) {
    const m = pair.match(/^(\d+)\s*[:=]\s*(\d+)$/);
    if (!m) continue;
    const q = Number(m[1]), n = Number(m[2]);
    // 2..9 opciones: el motor soporta hasta 9 vía MULTI_SELECT_LABELS/OPTION_LABELS.
    if (q >= 1 && q <= numQuestions && n >= 2 && n <= 9) out[q] = n;
  }
  return out;
}

/** Serializa a la forma canonica de BD ("20:3,29:6") o null si no hay overrides. */
export function serializeOptionOverrides(overrides: Record<number, number>): string | null {
  const entries = Object.entries(overrides).map(([q, n]) => [Number(q), n] as const);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => a[0] - b[0]).map(([q, n]) => `${q}:${n}`).join(",");
}

/** Puntaje maximo aceptado para una sola pregunta (tope de cordura, no de motor). */
export const QUIZ_MAX_QUESTION_POINTS = 100;

/**
 * Parsea el puntaje por pregunta puntual ("3:2,7:0.5" o como lo tipee el
 * profesor) a un mapa {pregunta: puntos}, 1-indexado. Mismo formato y misma
 * tolerancia que parseOptionOverrides -- se escribe aparte y no se reusa
 * porque aca el VALOR admite decimales (media pregunta, 0.5 pts) con coma o
 * punto, mientras que las opciones son enteros por definicion.
 *
 * Solo se guardan las preguntas que DIFIEREN de default_question_points; una
 * pregunta ausente vale el default (ver pointsForQuestion en quiz_score.ts).
 *
 * La coma cumple DOS papeles en castellano ("3:2,7:3" separa pares; "4:0,5" es
 * media unidad), asi que separa pares SOLO cuando lo que sigue es otro par
 * (digitos y luego ":"). Sin esa distincion, "4:0,5" se partia en "4:0" y "5"
 * y la pregunta terminaba valiendo 0 puntos en silencio.
 */
export function parseQuestionPoints(
  value: FormDataEntryValue | string | null | undefined,
  numQuestions: number,
): Record<number, number> {
  const out: Record<number, number> = {};
  const pairs = String(value ?? "").split(/[;\s]+|,(?=\s*\d+\s*[:=])/).filter(Boolean);
  for (const pair of pairs) {
    const m = pair.match(/^(\d+)\s*[:=]\s*(\d+(?:[.,]\d+)?)$/);
    if (!m) continue;
    const q = Number(m[1]);
    const pts = Number(m[2].replace(",", "."));
    if (!Number.isInteger(q) || q < 1 || q > numQuestions) continue;
    if (!Number.isFinite(pts) || pts < 0 || pts > QUIZ_MAX_QUESTION_POINTS) continue;
    out[q] = pts;
  }
  return out;
}

/** Serializa a la forma canonica de BD ("3:2,7:0.5") o null si no hay puntajes
 *  distintos del default. El separador decimal canonico es el PUNTO (la coma es
 *  el separador de pares), aunque el profesor pueda tipear coma. */
export function serializeQuestionPoints(points: Record<number, number>): string | null {
  const entries = Object.entries(points).map(([q, pts]) => [Number(q), pts] as const);
  if (entries.length === 0) return null;
  return entries.sort((a, b) => a[0] - b[0]).map(([q, pts]) => `${q}:${pts}`).join(",");
}

/** Normaliza el puntaje por defecto de una pregunta. NULL/vacio/invalido = 1
 *  (el comportamiento historico: toda pregunta cerrada vale 1 punto). */
export function normalizeDefaultQuestionPoints(
  value: FormDataEntryValue | string | number | null | undefined,
): number {
  if (value === null || value === undefined || value === "") return 1;
  const parsed = Number(String(value).replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > QUIZ_MAX_QUESTION_POINTS) return 1;
  return parsed;
}

/**
 * Fuerza "-" en los slots de preguntas abiertas de una clave ya normalizada
 * por slots (normalizeAnswerKeySlots): una abierta nunca tiene letra correcta.
 */
export function applyOpenSlots(answerKeySlots: string, open: number[]): string {
  if (open.length === 0) return answerKeySlots;
  const chars = answerKeySlots.split("");
  for (const q of open) {
    if (q >= 1 && q <= chars.length) chars[q - 1] = "-";
  }
  return chars.join("");
}

/**
 * Extrae, en orden, todas las letras validas (segun numOptions) que
 * aparezcan en un texto libre -- usado para poblar la clave desde un
 * archivo CSV/TXT pegado o subido, o desde el volcado celda-por-celda de un
 * archivo Excel. Tokeniza por separadores (coma/espacio/salto de linea/etc)
 * en vez de escanear letra por letra: un token de un solo caracter valido
 * se toma tal cual; un token numerico (nro de pregunta) se ignora; un token
 * compuesto ENTERO por letras validas sin separador (ej "ABCD" pegado) se
 * expande caracter a caracter; cualquier otro token (ej encabezados como
 * "Pregunta"/"Respuesta", que tienen letras fuera del set) se descarta
 * completo -- evita que una "A" suelta dentro de una palabra de encabezado
 * contamine la clave (bug real encontrado probando con headers CSV/XLSX).
 */
export function extractAnswerLetters(text: string, numOptions: number): string {
  const allowed = new Set(optionLabelsFor(numOptions).split(""));
  const tokens = text.toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const letters: string[] = [];
  for (const token of tokens) {
    if (token.length === 1) {
      if (allowed.has(token)) letters.push(token);
    } else if (/^[0-9]+$/.test(token)) {
      continue;
    } else if (token.split("").every((char) => allowed.has(char))) {
      letters.push(...token.split(""));
    }
  }
  return letters.join("");
}

/** Subtipo de pregunta abierta (docs/dia-instrumentos-monitoreo-2026.md):
 *  decide que tipo de dato le pide el prompt de la IA de correccion que
 *  transcriba, y mas adelante que campo del payload de DIA usar
 *  (respuestaAbierta vs respuestaEscalar) -- ver dia-bot/docs/FINDINGS.md
 *  §11.4 (ABIERTA_SIMPLE/ABIERTA_PAR_ORDENADO/ABIERTA_ENTERO_DECIMAL). */
export type OpenQuestionSubtype = "simple" | "par_ordenado" | "entero_decimal";

export interface OpenQuestionRubric {
  rubric: string;
  max_points: number;
  subtipo: OpenQuestionSubtype;
}

/** Parsea quizzes.open_question_rubrics (JSON-string) a un mapa {pregunta:
 *  rubrica}, 1-indexado, tolerante a JSON invalido/vacio (devuelve {}). */
export function parseOpenQuestionRubrics(value: string | null | undefined): Record<number, OpenQuestionRubric> {
  if (!value) return {};
  try {
    const raw = JSON.parse(value) as Record<string, Partial<OpenQuestionRubric>>;
    const out: Record<number, OpenQuestionRubric> = {};
    for (const [key, v] of Object.entries(raw)) {
      const q = Number(key);
      if (!Number.isInteger(q) || q < 1) continue;
      const subtipo: OpenQuestionSubtype = v.subtipo === "par_ordenado" || v.subtipo === "entero_decimal" ? v.subtipo : "simple";
      out[q] = { rubric: String(v.rubric ?? ""), max_points: Number(v.max_points) || 0, subtipo };
    }
    return out;
  } catch {
    return {};
  }
}

/** Serializa a la forma canonica de BD (JSON-string) o null si esta vacio. */
export function serializeOpenQuestionRubrics(rubrics: Record<number, OpenQuestionRubric>): string | null {
  const entries = Object.entries(rubrics).filter(([, r]) => r.rubric.trim().length > 0);
  if (entries.length === 0) return null;
  return JSON.stringify(Object.fromEntries(entries));
}
