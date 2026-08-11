-- Curso del alumno en el paper + historial de asignacion.
--
-- Problema que resuelve: hoy un paper se cuelga SOLO del quiz. Si un curso rinde
-- con la hoja de otro (caso real: la hoja del 2E usada para todo el nivel), el
-- resultado de un alumno de 2B queda listado dentro del ensayo del 2E y su curso
-- real no queda registrado en ninguna parte. `papers.course_id` guarda el curso
-- del alumno AL MOMENTO de escanear (snapshot: si despues se traslada de curso,
-- el historico no se reescribe).
--
-- `prev_assignment` guarda el estado anterior del paper (alumno, nombre, RUT
-- normalizado, status, curso) antes de una asignacion/reasignacion manual, para
-- poder DESHACER desde la UI sin inventar el estado previo.
--
-- Aplicar A MANO en Supabase -> SQL Editor (Vercel no corre migraciones).
-- Pegar statement por statement: el editor Monaco corrompe pastes largos.

ALTER TABLE papers ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

ALTER TABLE papers ADD COLUMN IF NOT EXISTS prev_assignment JSONB;

-- Listar/contar los papers de un curso (vista de resultados agrupada por curso).
CREATE INDEX IF NOT EXISTS idx_papers_school_course ON papers (school_id, course_id);

NOTIFY pgrst, 'reload schema';
