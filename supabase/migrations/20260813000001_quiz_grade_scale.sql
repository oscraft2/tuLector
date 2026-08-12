-- Escala de NOTA y de EQUIVALENCIA por ensayo (docs/plan-puntaje-y-exportacion.md,
-- Fase 2). Hasta ahora el ensayo solo podia ajustar `exigencia`: la nota minima
-- de aprobacion y la escala (1.0-7.0) vivian unicamente a nivel de colegio
-- (schools.passing_grade / grading_scale_min / grading_scale_max), y un colegio
-- con su propia tabla oficial puntaje->nota no tenia donde cargarla.
--
-- Todas NULL = "usa lo del colegio, y si el colegio tampoco lo define, lo del
-- perfil de pais" (ver la cadena de resolucion en src/lib/quiz_score.ts). Por
-- eso la migracion no necesita backfill: un ensayo existente no cambia nada.
--
-- quizzes.grade_table: JSON-string con la tabla del colegio, ej.
--   {"mode":"points","rows":[{"from":0,"grade":1.0},{"from":12,"grade":4.0},
--                            {"from":20,"grade":7.0}]}
--   `mode` = "points" (tramos por puntaje) o "percent" (por porcentaje de
--   logro). Si esta presente y es valida, REEMPLAZA a la formula de exigencia.
--   Parseo tolerante en src/lib/grade_table.ts (JSON invalido -> se ignora y se
--   cae a la formula de siempre; nunca deja una hoja sin nota).
--
-- quizzes.equivalent_scale: JSON-string {"min":150,"max":850} para instrumentos
--   con puntaje equivalente propio. PAES (100-1000) y SIMCE (100-400) siguen
--   siendo casos cerrados por evaluation_type y tienen precedencia: son formulas
--   oficiales, no configurables.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS passing_grade NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_scale_min NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_scale_max NUMERIC;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS grade_table TEXT;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS equivalent_scale TEXT;

NOTIFY pgrst, 'reload schema';
