export const QUIZ_MIN_QUESTIONS = 1;
// Sobre SEGURO validado por test:omr (guard "Config sweep" en test_omr_real.ts):
// 1 col ≤40, 2 col 12-50, 3 col 18-90, 4 col 21-100 (nivel ZipGrade en 1 hoja,
// jul 2026). El nº de columnas real se deriva en dashboard/actions.ts con
// sheet_generator.suggestColumns, no queda fijo en 1.
export const QUIZ_MAX_QUESTIONS = 100;
export const QUIZ_OPTION_LABELS = "ABCDE";
export const QUIZ_ALLOWED_OPTIONS = [3, 4, 5] as const;

export type QuizOptionCount = (typeof QUIZ_ALLOWED_OPTIONS)[number];

export function normalizeQuestionCount(value: FormDataEntryValue | string | number | null | undefined): number {
  const parsed = Number(value ?? 20);
  if (!Number.isInteger(parsed)) return 20;
  return Math.max(QUIZ_MIN_QUESTIONS, Math.min(QUIZ_MAX_QUESTIONS, parsed));
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
