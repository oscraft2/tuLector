-- Puntaje POR PREGUNTA por ensayo (ver docs/plan-puntaje-y-exportacion.md, Fase 1).
-- Hasta ahora toda pregunta cerrada valia exactamente 1 punto en computeQuizScore
-- (src/lib/grading.ts) y no habia forma de decir "la 7 vale 3".
--
-- quizzes.default_question_points: cuanto vale una pregunta que no tenga override.
--   NULL = 1 (todo el comportamiento actual).
-- quizzes.question_points: CSV canonico "pregunta:puntos" SOLO de las que difieren
--   del default, ej "3:2,7:0.5". Mismo formato/criterio que option_overrides, pero
--   acepta decimales. Parseo en src/lib/quiz_constraints.ts (parseQuestionPoints).
-- quizzes.score_open_questions: si TRUE, las preguntas de desarrollo entran al
--   puntaje con su max_points de open_question_rubrics (numerador = solo
--   confirmed_points de open_answers -- la IA sugiere, el profesor decide).
--   NULL/FALSE = quedan fuera del numerador Y del denominador, como hoy.
--
-- papers.points / points_total: el puntaje PONDERADO. `score`/`total` NO cambian
--   de significado (siguen siendo correctas / preguntas cerradas) para no romper
--   toda la UI que dice "Respuestas Correctas". Sin ponderacion ni abiertas
--   puntuadas, points === score y points_total === total.
--   La nota y el puntaje equivalente se calculan SIEMPRE desde points/points_total.
--
-- grade_records.raw_score/total_questions pasan a NUMERIC porque ahora guardan
--   PUNTOS (su nombre ya era "puntaje bruto"); con ponderacion ausente el valor
--   es identico al de hoy.
--
-- Migracion ADITIVA, sin backfill: NULL ya es el default correcto.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS default_question_points NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS question_points TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS score_open_questions BOOLEAN;

ALTER TABLE papers ADD COLUMN IF NOT EXISTS points NUMERIC;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS points_total NUMERIC;

ALTER TABLE grade_records ALTER COLUMN raw_score TYPE NUMERIC;
ALTER TABLE grade_records ALTER COLUMN total_questions TYPE NUMERIC;

NOTIFY pgrst, 'reload schema';
