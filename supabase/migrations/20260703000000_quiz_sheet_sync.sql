-- Fase 1 — Sincronización ensayo ↔ hoja ↔ lector.
-- El ensayo pasa a guardar su nº de columnas y un código numérico de hoja
-- (sheet_code, cabe en los 20 bits del código de hoja del motor) para (a) atar la
-- hoja impresa a su ensayo y (b) permitir verificar "hoja correcta" en el lector.
-- Migración ADITIVA y no destructiva: solo agrega columnas + backfill. El código
-- que las usa se despliega DESPUÉS, así que agregarlas no cambia nada existente.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS num_columns INT NOT NULL DEFAULT 1;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS sheet_code INT;

-- Backfill del nº de columnas con la MISMA heurística que ya usaba el lector
-- (>30 preguntas → 2 columnas), para no alterar el comportamiento de ensayos viejos.
UPDATE quizzes
SET num_columns = CASE WHEN COALESCE(num_questions, 20) > 30 THEN 2 ELSE 1 END
WHERE sheet_code IS NULL;

-- Backfill del código: correlativo por colegio (1,2,3…), estable por fecha de creación.
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY school_id ORDER BY created_at, id) AS rn
  FROM quizzes
)
UPDATE quizzes q
SET sheet_code = n.rn
FROM numbered n
WHERE q.id = n.id AND q.sheet_code IS NULL;

-- Unicidad del código por colegio (índice parcial: tolera NULL por robustez).
CREATE UNIQUE INDEX IF NOT EXISTS quizzes_school_sheet_code_uk
  ON quizzes (school_id, sheet_code)
  WHERE sheet_code IS NOT NULL;
