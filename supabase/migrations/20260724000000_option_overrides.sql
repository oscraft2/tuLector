-- Nº de opciones por pregunta puntual y preguntas de seleccion MULTIPLE,
-- pensado para replicar instrumentos de terceros (ej. hoja DIA) como una hoja
-- propia de tuLector en vez de leer su PDF crudo -- ver
-- docs/dia-motor-beta-progreso.md.
--
-- option_overrides: CSV canonico "pregunta:nOpciones,..." (ej "20:3,29:6"),
--   1-indexado. NULL/'' = todas las preguntas usan num_options global (100%
--   del comportamiento actual). Canonicalizacion (rango, 2..9 opciones) en
--   parseOptionOverrides/serializeOptionOverrides de src/lib/quiz_constraints.ts.
-- multi_select_questions: CSV canonico de nº de pregunta 1-indexados (ej
--   "29"), MISMO formato que open_questions -- una fila "marca todas las
--   correctas" donde varias burbujas marcadas son una respuesta valida.
--   Canonicalizacion en parseMultiSelectQuestions/serializeMultiSelectQuestions
--   (alias de parseOpenQuestions/serializeOpenQuestions).
--
-- Migración ADITIVA, sin backfill: NULL ya es el default correcto (ningún
-- ensayo existente cambia de comportamiento).

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS option_overrides TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS multi_select_questions TEXT;
