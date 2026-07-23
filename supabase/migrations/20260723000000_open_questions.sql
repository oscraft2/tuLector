-- Preguntas de desarrollo (abiertas) por ensayo, pensado para pruebas DIA que
-- mezclan alternativas con respuesta construida. Lista CSV canónica de números
-- de pregunta 1-indexados, ej "18,27,33". NULL o '' = ensayo 100% de
-- alternativas (todo el comportamiento actual). La canonicalización (dedupe,
-- orden, rango 1..num_questions) vive en parseOpenQuestions/serializeOpenQuestions
-- de src/lib/quiz_constraints.ts, igual que answer_key.
-- Migración ADITIVA, sin backfill: NULL ya es el default correcto.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS open_questions TEXT;
