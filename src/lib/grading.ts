import "server-only";
import { calculateGrade } from "@/lib/latam";

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

export function equivalentScore(evaluationType: string | null | undefined, score: number, total: number): number | null {
  if (total <= 0) return null;
  const pct = score / total;
  if (evaluationType === "paes") return Math.round(100 + pct * 900);
  if (evaluationType === "simce") return Math.round(100 + pct * 300);
  return Math.round(pct * 100);
}

export type ScoreableAnswer = { q: number; a: string };

export type ScoreableQuiz = {
  answer_key: string | null;
  num_questions: number | null;
  evaluation_type?: string | null;
  exigencia?: number | null;
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
 */
export function computeQuizScore(
  quiz: ScoreableQuiz,
  answers: ScoreableAnswer[],
  school: ScoreableSchool,
  countryCode: string,
) {
  const total = Number(quiz.num_questions ?? answers.length);
  const score = answers.reduce((sum, answer) => {
    const expected = answerKeyAt(String(quiz.answer_key ?? ""), answer.q - 1);
    return sum + (answer.a !== "-" && answer.a === expected ? 1 : 0);
  }, 0);
  const gradeResult = calculateGrade(score, total, countryCode, {
    gradeScale: {
      min: school.grading_scale_min ?? 1.0,
      max: school.grading_scale_max ?? 7.0,
    },
    passingGrade: school.passing_grade ?? 4.0,
    exigencia: quiz.exigencia ?? school.exigencia ?? 0.6,
  });
  const eqScore = equivalentScore(quiz.evaluation_type, score, total);
  return { score, total, grade: gradeResult.grade, passing: gradeResult.passing, equivalentScore: eqScore };
}
