-- Modo de hoja del ensayo: hoja completa de TuLector ('full', lo de siempre) o
-- BLOQUE COMPACTO embebido en la prueba que el profesor arma en Word/Canva
-- ('compact', sub-motor de src/tulector/compact_block.ts).
--
-- Por que una columna propia y NO evaluation_type: evaluation_type define la
-- ESCALA DE PUNTAJE (custom=%, paes=100-1000, simce=100-400), alimenta el
-- trigger calculate_paper_results y tiene un CHECK cerrado
-- (20260627000000_paes_simce.sql). El bloque compacto no cambia la escala
-- (sigue siendo la del ensayo), cambia COMO SE GENERA Y SE LOCALIZA la hoja.
-- Ver docs/plan-bloque-omr-compacto-ejecucion.md, correccion 3.
--
-- Migración ADITIVA con DEFAULT 'full': todo ensayo existente sigue
-- imprimiendose y leyendose exactamente igual que hoy.

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS sheet_mode TEXT NOT NULL DEFAULT 'full';

-- Sin bloque DO ni dollar-quoting a proposito: este SQL se pega A MANO en el
-- editor de Supabase (Vercel no corre migraciones) y el dollar-quoting se
-- corrompe al pegar. DROP+ADD deja la migracion igual de idempotente.
ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_sheet_mode_check;
ALTER TABLE quizzes ADD CONSTRAINT quizzes_sheet_mode_check CHECK (sheet_mode IN ('full', 'compact'));

NOTIFY pgrst, 'reload schema';
