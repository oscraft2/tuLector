import "server-only";

/**
 * Punto de entrada del SERVIDOR para la correccion de un ensayo. La formula
 * vive en src/lib/quiz_score.ts, que es puro (sin "server-only") para poder
 * probarse con node:test + tsx; este archivo solo marca que el calculo no debe
 * arrastrarse a un Client Component y conserva la ruta de import que ya usan
 * el escaneo (api/scan/result/route.ts) y la re-correccion (dashboard/actions.ts).
 */
export {
  answerKeyAt,
  equivalentScore,
  computeQuizScore,
} from "@/lib/quiz_score";

export type {
  ScoreableAnswer,
  ScoreableOpenAnswer,
  ScoreableQuiz,
  ScoreableSchool,
} from "@/lib/quiz_score";
