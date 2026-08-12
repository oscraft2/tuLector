/**
 * Formula de puntaje/nota de un ensayo. Modulo PURO a proposito: sin
 * "server-only" y sin imports de alias, para que se pueda probar con
 * `node:test` + tsx (src/lib/quiz_score.test.ts) igual que rut.ts o
 * dia_curso.ts. El punto de entrada del servidor sigue siendo
 * src/lib/grading.ts, que reexporta todo esto.
 */
import { calculateGrade } from "./latam";
import {
  parseOpenQuestions, parseMultiSelectQuestions, parseQuestionPoints,
  normalizeDefaultQuestionPoints, parseOpenQuestionRubrics,
} from "./quiz_constraints";
import { parseGradeTable, gradeFromTable, parseEquivalentScale } from "./grade_table";

/**
 * Lee la letra esperada de una clave en una posicion dada. Preserva "-"
 * (pregunta todavia sin responder, ver normalizeAnswerKeySlots en
 * quiz_constraints.ts) en vez de descartarlo -- descartarlo correria el
 * indice de todo lo que viene despues de un hueco. Una posicion "-" nunca
 * cuenta como correcta (comparada contra answer.a !== "-" en computeQuizScore).
 */
export function answerKeyAt(answerKey: string, index: number): string {
  return answerKey.replace(/[^A-Za-z-]/g, "").toUpperCase()[index] ?? "";
}

/**
 * Puntaje equivalente del ensayo.
 *
 * PAES (100-1000) y SIMCE (100-400) van PRIMERO y no se pueden sobrescribir:
 * son formulas oficiales, no una preferencia del colegio. Recien despues entra
 * la escala propia del ensayo (quizzes.equivalent_scale) y, si no hay ninguna,
 * el porcentaje simple de siempre.
 */
export function equivalentScore(
  evaluationType: string | null | undefined,
  score: number,
  total: number,
  equivalentScaleJson?: string | null,
): number | null {
  if (total <= 0) return null;
  const pct = score / total;
  if (evaluationType === "paes") return Math.round(100 + pct * 900);
  if (evaluationType === "simce") return Math.round(100 + pct * 300);
  const scale = parseEquivalentScale(equivalentScaleJson);
  if (scale) return Math.round(scale.min + pct * (scale.max - scale.min));
  return Math.round(pct * 100);
}

export type ScoreableAnswer = { q: number; a: string };

/**
 * Respuesta de desarrollo YA CONFIRMADA por el profesor (open_answers). Solo
 * `confirmed_points` cuenta: el `puntaje` sugerido por la IA nunca entra a la
 * nota sin confirmar (principio de docs/plan-correccion-ia-abiertas.md).
 */
export type ScoreableOpenAnswer = { question: number; confirmed_points: number | null };

export type ScoreableQuiz = {
  answer_key: string | null;
  num_questions: number | null;
  /** CSV canonico "18,27,33" de preguntas de desarrollo (ver parseOpenQuestions):
   *  quedan FUERA del puntaje automatico (numerador y denominador) salvo que
   *  `score_open_questions` este activo. */
  open_questions?: string | null;
  /** CSV canonico de preguntas de seleccion MULTIPLE (ver
   *  parseMultiSelectQuestions): un letra-esperada-unica no representa "que
   *  subconjunto es correcto", asi que quedan FUERA del puntaje automatico
   *  igual que las abiertas (numerador y denominador). El motor SI las lee
   *  (ver src/tulector/omr.ts) -- solo el auto-grading las excluye. */
  multi_select_questions?: string | null;
  evaluation_type?: string | null;
  exigencia?: number | null;
  /** Puntaje de una pregunta sin override. NULL = 1 (comportamiento historico). */
  default_question_points?: number | string | null;
  /** CSV "3:2,7:0.5" con SOLO las preguntas que difieren del default. */
  question_points?: string | null;
  /** Si TRUE, las abiertas suman su max_points al denominador y sus
   *  confirmed_points al numerador. NULL/false = quedan fuera, como siempre. */
  score_open_questions?: boolean | null;
  /** JSON-string de rubricas por pregunta abierta: de aca sale el max_points. */
  open_question_rubrics?: string | null;
  /** Escala de nota propia del ensayo (migracion quiz_grade_scale). Cada campo
   *  NULL cae al valor del colegio y despues al del perfil de pais. */
  passing_grade?: number | null;
  grade_scale_min?: number | null;
  grade_scale_max?: number | null;
  /** JSON-string de la tabla puntaje->nota; si es valida REEMPLAZA la formula. */
  grade_table?: string | null;
  /** JSON-string {"min","max"} del puntaje equivalente propio. */
  equivalent_scale?: string | null;
};

export type ScoreableSchool = {
  grading_scale_min?: number | null;
  grading_scale_max?: number | null;
  passing_grade?: number | null;
  exigencia?: number | null;
};

/**
 * Formula de puntaje/nota compartida entre el camino de escaneo en vivo
 * (finalizeGrading en api/scan/result/route.ts) y la re-correccion masiva al
 * editar la clave de un ensayo que ya tiene hojas escaneadas (updateQuiz en
 * dashboard/actions.ts) -- una sola fuente de verdad para el calculo.
 *
 * Devuelve DOS medidas a proposito:
 *  - `score`/`total`: respuestas CORRECTAS / preguntas cerradas. Es lo que
 *    siempre significaron y lo que muestra toda la UI ("Respuestas Correctas").
 *  - `points`/`pointsTotal`: el puntaje PONDERADO, del que salen la nota y el
 *    puntaje equivalente. Sin ponderacion configurada son identicos a los de
 *    arriba, asi que un ensayo existente no cambia ni un decimal.
 */
export function computeQuizScore(
  quiz: ScoreableQuiz,
  answers: ScoreableAnswer[],
  school: ScoreableSchool,
  countryCode: string,
  /** Respuestas de desarrollo del paper; solo se usan si `score_open_questions`.
   *  El escaneo en vivo pasa [] (recien leida, nada confirmado todavia). */
  openAnswers: ScoreableOpenAnswer[] = [],
) {
  const numQ = Number(quiz.num_questions ?? answers.length);
  // Las preguntas de desarrollo (abiertas) y de seleccion multiple no se
  // corrigen automaticamente: la nota es correctas / preguntas-de-alternativas.
  const open = new Set(parseOpenQuestions(quiz.open_questions ?? "", numQ));
  const multi = new Set(parseMultiSelectQuestions(quiz.multi_select_questions ?? "", numQ));
  const total = Math.max(1, numQ - open.size - multi.size);

  const defaultPoints = normalizeDefaultQuestionPoints(quiz.default_question_points);
  const overrides = parseQuestionPoints(quiz.question_points ?? "", numQ);
  const pointsForQuestion = (q: number) => overrides[q] ?? defaultPoints;

  // Denominador ponderado: TODA pregunta cerrada aporta su puntaje, se haya
  // respondido o no (a diferencia del numerador, que recorre las respuestas
  // leidas). Por eso se itera 1..numQ y no `answers`.
  let pointsTotal = 0;
  for (let q = 1; q <= numQ; q++) {
    if (open.has(q) || multi.has(q)) continue;
    pointsTotal += pointsForQuestion(q);
  }

  let score = 0;
  let points = 0;
  for (const answer of answers) {
    if (open.has(answer.q) || multi.has(answer.q)) continue;
    const expected = answerKeyAt(String(quiz.answer_key ?? ""), answer.q - 1);
    if (answer.a !== "-" && answer.a === expected) {
      score += 1;
      points += pointsForQuestion(answer.q);
    }
  }

  // Preguntas de desarrollo: entran al puntaje SOLO si el ensayo lo pidio.
  // El denominador suma el max_points de la rubrica aunque el profesor no haya
  // confirmado todavia -- hasta que confirme, la nota queda deprimida a
  // proposito (la UI del ensayo lo advierte).
  if (quiz.score_open_questions && open.size > 0) {
    const rubrics = parseOpenQuestionRubrics(quiz.open_question_rubrics ?? "");
    const confirmedByQuestion = new Map<number, number>();
    for (const oa of openAnswers) {
      if (oa.confirmed_points != null && Number.isFinite(Number(oa.confirmed_points))) {
        confirmedByQuestion.set(Number(oa.question), Number(oa.confirmed_points));
      }
    }
    for (const q of open) {
      const max = Number(rubrics[q]?.max_points ?? 0);
      if (!Number.isFinite(max) || max <= 0) continue;
      pointsTotal += max;
      // Se recorta al maximo de la rubrica: un confirmed_points mayor (dato
      // viejo o rubrica editada a la baja) no puede inflar la nota sobre 100%.
      points += Math.min(confirmedByQuestion.get(q) ?? 0, max);
    }
  }

  // Sin puntaje ponderado utilizable (todo vale 0, o un ensayo sin preguntas
  // cerradas ni abiertas puntuadas) se cae al conteo de correctas: mas vale una
  // nota calculada como siempre que una division por cero.
  const weighted = pointsTotal > 0;
  const finalPoints = round2(weighted ? points : score);
  const finalPointsTotal = round2(weighted ? pointsTotal : total);

  // Escala de nota: cada valor lo aporta el primer eslabon que lo tenga
  // definido -- ensayo, colegio, y por ultimo el default historico (que es el
  // de Chile; calculateGrade ya resuelve el perfil real del pais si el colegio
  // tampoco lo define).
  const gradeMin = quiz.grade_scale_min ?? school.grading_scale_min ?? 1.0;
  const gradeMax = quiz.grade_scale_max ?? school.grading_scale_max ?? 7.0;
  const passingGrade = quiz.passing_grade ?? school.passing_grade ?? 4.0;

  const gradeResult = calculateGrade(finalPoints, finalPointsTotal, countryCode, {
    gradeScale: { min: gradeMin, max: gradeMax },
    passingGrade,
    exigencia: quiz.exigencia ?? school.exigencia ?? 0.6,
  });

  // La tabla del colegio, si existe y es valida, REEMPLAZA a la formula de
  // exigencia. `passing` se recalcula contra la nota de aprobacion resuelta:
  // con tabla propia, aprobar es "llegar a la nota", no "llegar al porcentaje".
  const table = parseGradeTable(quiz.grade_table);
  const tableGrade = table ? gradeFromTable(table, finalPoints, finalPointsTotal) : null;
  const grade = tableGrade ?? gradeResult.grade;
  const passing = tableGrade != null ? tableGrade >= passingGrade : gradeResult.passing;

  const eqScore = equivalentScore(quiz.evaluation_type, finalPoints, finalPointsTotal, quiz.equivalent_scale);
  return {
    score,
    total,
    points: finalPoints,
    pointsTotal: finalPointsTotal,
    grade,
    passing,
    equivalentScore: eqScore,
  };
}

/** Corta el arrastre binario de sumar decimales (0.1+0.2). Dos decimales es
 *  mas resolucion de la que cualquier rubrica escolar necesita. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
