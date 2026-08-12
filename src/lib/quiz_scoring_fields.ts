/**
 * Lectura de los campos de PUNTAJE y ESCALA de un ensayo desde el formulario
 * (paneles "Puntaje por pregunta" y "Nota y equivalencia" de AnswerKeyEditor).
 *
 * Vive aparte de dashboard/actions.ts porque createQuiz y updateQuiz necesitan
 * exactamente la misma lectura y validacion; duplicarla es como se desincronizan
 * el alta y la edicion.
 *
 * Convencion: un campo que vale lo mismo que el default historico se guarda
 * NULL, no su valor. Asi "sin configurar" y "configurado igual al default" no
 * se confunden, la BD queda limpia, y `hasScoringConfig` puede decidir si una
 * columna faltante es un error real o se puede degradar en silencio.
 */
import {
  parseQuestionPoints, serializeQuestionPoints, normalizeDefaultQuestionPoints,
  QUIZ_MAX_QUESTION_POINTS,
} from "./quiz_constraints";
import { parseGradeTable, serializeGradeTable, parseEquivalentScale } from "./grade_table";

/** Columnas que aporta este modulo, en orden de migracion. Las usa la
 *  degradacion por columna faltante de dashboard/actions.ts. */
export const QUIZ_POINTS_COLUMNS = [
  "default_question_points", "question_points", "score_open_questions",
] as const;
export const QUIZ_GRADE_SCALE_COLUMNS = [
  "passing_grade", "grade_scale_min", "grade_scale_max", "grade_table", "equivalent_scale",
] as const;

export type QuizScoringFields = {
  default_question_points: number | null;
  question_points: string | null;
  score_open_questions: boolean | null;
  passing_grade: number | null;
  grade_scale_min: number | null;
  grade_scale_max: number | null;
  grade_table: string | null;
  equivalent_scale: string | null;
};

/** Numero opcional de un input: vacio/ausente/invalido = null (= "usa el del
 *  colegio"), nunca 0 por accidente. */
function optionalNumber(value: FormDataEntryValue | null, min: number, max: number): number | null {
  if (value === null) return null;
  const text = String(value).trim();
  if (text === "") return null;
  const parsed = Number(text.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

export function readQuizScoringFields(formData: FormData, numQuestions: number): QuizScoringFields {
  const defaultPoints = normalizeDefaultQuestionPoints(formData.get("default_question_points"));
  const questionPoints = parseQuestionPoints(formData.get("question_points"), numQuestions);
  // Solo se guardan los overrides que DIFIEREN del default: si el profesor puso
  // "todas valen 2" y ademas escribio "5:2", la 5 no es un override.
  for (const [q, pts] of Object.entries(questionPoints)) {
    if (pts === defaultPoints) delete questionPoints[Number(q)];
  }

  const gradeTable = parseGradeTable(String(formData.get("grade_table") ?? ""));
  const equivalentScale = parseEquivalentScale(String(formData.get("equivalent_scale") ?? ""));

  return {
    // 1 es el default historico: se guarda NULL para no marcar como
    // "configurado" a un ensayo que no lo esta.
    default_question_points: defaultPoints === 1 ? null : defaultPoints,
    question_points: serializeQuestionPoints(questionPoints),
    score_open_questions: formData.get("score_open_questions") === "on" ? true : null,
    passing_grade: optionalNumber(formData.get("passing_grade"), 0, 100),
    grade_scale_min: optionalNumber(formData.get("grade_scale_min"), 0, 100),
    grade_scale_max: optionalNumber(formData.get("grade_scale_max"), 0, 100),
    grade_table: serializeGradeTable(gradeTable),
    equivalent_scale: equivalentScale ? JSON.stringify(equivalentScale) : null,
  };
}

/** Valida lo que no puede validar un parser suelto: la coherencia entre campos.
 *  Devuelve el mensaje de error, o null si esta todo bien. */
export function quizScoringIssue(fields: QuizScoringFields): string | null {
  const { grade_scale_min: min, grade_scale_max: max, passing_grade: passing } = fields;
  if (min !== null && max !== null && max <= min) {
    return "La nota maxima de la escala debe ser mayor que la minima.";
  }
  if (passing !== null) {
    if (min !== null && passing < min) return "La nota de aprobacion no puede ser menor que la nota minima de la escala.";
    if (max !== null && passing > max) return "La nota de aprobacion no puede ser mayor que la nota maxima de la escala.";
  }
  const defaultPoints = fields.default_question_points;
  if (defaultPoints !== null && (defaultPoints < 0 || defaultPoints > QUIZ_MAX_QUESTION_POINTS)) {
    return `El puntaje por pregunta debe estar entre 0 y ${QUIZ_MAX_QUESTION_POINTS}.`;
  }
  return null;
}

/** true si el profesor configuro ALGO de puntaje/escala. Cuando es false, una
 *  columna faltante en la BD se puede ignorar en silencio; cuando es true, hay
 *  que avisar que falta la migracion en vez de guardar a medias. */
export function hasScoringConfig(fields: QuizScoringFields, columns: readonly (keyof QuizScoringFields)[]): boolean {
  return columns.some((col) => {
    const value = fields[col];
    return value !== null && value !== false;
  });
}
