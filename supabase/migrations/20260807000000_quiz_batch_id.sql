-- Vincula las N filas de `quizzes` creadas en un mismo envio "multi-curso"
-- (ver createQuiz en dashboard/actions.ts): cada curso seleccionado genera su
-- propia fila con su propio sheet_code (necesario para la proteccion "hoja
-- correcta" del lector, indice unico quizzes_school_sheet_code_uk), pero
-- comparten el mismo contenido/clave. batch_id permite que el endpoint de
-- escaneo (api/scan/result) reconozca automaticamente una hoja "hermana" del
-- mismo lote cuando no calza con el ensayo activo, en vez de mandarla siempre
-- a revision manual -- sin debilitar la proteccion contra mezclar ensayos
-- genuinamente distintos (fuera del mismo batch_id).
--
-- Migración ADITIVA, sin backfill: NULL = ensayo no creado en lote multi-curso
-- (todo el comportamiento actual, incluidos los ensayos ya existentes).

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS batch_id UUID;

CREATE INDEX IF NOT EXISTS idx_quizzes_batch_id ON quizzes (school_id, batch_id) WHERE batch_id IS NOT NULL;
