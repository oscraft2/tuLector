-- Plantillas de exportacion por establecimiento (docs/plan-puntaje-y-exportacion.md,
-- Fase 4). Hasta ahora el CSV de resultados tenia 8 columnas fijas y separador
-- coma: un colegio que pide "RUN" en vez de "rut", punto y coma, o el detalle
-- pregunta por pregunta, no tenia como obtenerlo.
--
-- columns: ids del catalogo de src/lib/export_columns.ts, EN ORDEN.
--   ej. ["student_name","rut","points","grade"]
-- header_labels: encabezados a medida, {"rut":"RUN"}. Lo que no este aca usa
--   el label por defecto de la columna.
-- per_question: bloques que se expanden a p1..pN, ej. ["answers"] o
--   ["answers","points"].
-- is_default: la plantilla del establecimiento. El panel la preselecciona para
--   todos los docentes; solo un admin puede crearla o cambiarla (la ruta de
--   exportacion ya exige isAdmin).
--
-- No se toca `export_formats` (los presets institucionales por pais, ya
-- sembrados con Agencia de Calidad / ICFES / PLANEA): eso es dato de
-- referencia compartido y se lee tal cual desde src/lib/export_presets.ts.

-- Los nombres de columna van ENTRECOMILLADOS: "columns" y "format" chocan con
-- palabras clave del parser de Postgres y la creacion fallaba con
-- `syntax error at or near "created_at"` (el error aparece en la linea
-- SIGUIENTE a la que lo causa, que es lo que lo hace dificil de leer).
-- Entrecomillado en minusculas el nombre real es identico al no entrecomillado,
-- asi que PostgREST y el codigo los siguen viendo como `columns` y `format`.
CREATE TABLE IF NOT EXISTS export_templates (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "school_id" UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    "name" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "header_labels" JSONB,
    "per_question" JSONB,
    "separator" TEXT DEFAULT ',',
    "format" TEXT DEFAULT 'csv',
    "is_default" BOOLEAN DEFAULT false,
    "created_by" UUID REFERENCES auth.users(id),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE("school_id", "name")
);

CREATE INDEX IF NOT EXISTS idx_export_templates_school ON export_templates(school_id);

ALTER TABLE export_templates ENABLE ROW LEVEL SECURITY;

-- LECTURA: todo el colegio. A diferencia de quizzes/papers NO se aisla por
-- docente a proposito: una plantilla de exportacion es configuracion del
-- establecimiento, no dato de alumnos, y el punto es justamente que todos
-- exporten con el mismo formato.
DROP POLICY IF EXISTS "school_export_templates" ON export_templates;
DROP POLICY IF EXISTS "school_export_templates_read" ON export_templates;
CREATE POLICY "school_export_templates_read" ON export_templates FOR SELECT USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

-- ESCRITURA: solo un admin del colegio. La ruta POST /api/export/templates ya
-- lo exige, pero la restriccion no puede vivir SOLO en la aplicacion: cambiar
-- la plantilla del establecimiento afecta a todos los docentes.
DROP POLICY IF EXISTS "school_export_templates_write" ON export_templates;
CREATE POLICY "school_export_templates_write" ON export_templates FOR ALL USING (
    EXISTS (
        SELECT 1 FROM school_members sm
        WHERE sm.user_id = auth.uid() AND sm.role = 'admin' AND sm.school_id = export_templates.school_id
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM school_members sm
        WHERE sm.user_id = auth.uid() AND sm.role = 'admin' AND sm.school_id = export_templates.school_id
    )
);

NOTIFY pgrst, 'reload schema';
