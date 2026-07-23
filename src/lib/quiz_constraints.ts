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
