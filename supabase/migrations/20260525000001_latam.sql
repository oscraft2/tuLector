-- TuLector LATAM - Esquema multinacional v3.0
-- Ejecutar en SQL Editor de Supabase

-- ================================================================
-- 1. Paises con configuracion educativa
-- ================================================================
CREATE TABLE IF NOT EXISTS countries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,      -- CL, AR, MX, CO, PE, etc.
    name TEXT NOT NULL,             -- Chile, Argentina, México, etc.
    grade_scale_min DECIMAL DEFAULT 1.0,
    grade_scale_max DECIMAL DEFAULT 7.0,
    passing_grade DECIMAL DEFAULT 4.0,
    id_type TEXT DEFAULT 'alphanumeric',
    id_format_regex TEXT,           -- regex opcional para validar formato
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Datos de pais pre-cargados
INSERT INTO countries (code, name, grade_scale_min, grade_scale_max, passing_grade, id_type, id_format_regex) VALUES
    ('CL', 'Chile', 1.0, 7.0, 4.0, 'rut', '^[0-9]{7,8}-[0-9kK]$'),
    ('AR', 'Argentina', 1, 10, 6, 'dni', '^[0-9]{7,8}$'),
    ('MX', 'Mexico', 0, 100, 60, 'curp', '^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9]{2}$'),
    ('CO', 'Colombia', 0, 100, 60, 'documento', NULL),
    ('PE', 'Peru', 0, 20, 11, 'dni', '^[0-9]{8}$'),
    ('EC', 'Ecuador', 0, 10, 7, 'cedula', NULL),
    ('BO', 'Bolivia', 0, 100, 51, 'documento', NULL),
    ('PY', 'Paraguay', 0, 100, 60, 'documento', NULL),
    ('UY', 'Uruguay', 0, 100, 60, 'documento', NULL)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    grade_scale_min = EXCLUDED.grade_scale_min,
    grade_scale_max = EXCLUDED.grade_scale_max,
    passing_grade = EXCLUDED.passing_grade;

-- ================================================================
-- 3. Colegios con configuracion LATAM
-- ================================================================
ALTER TABLE schools ADD COLUMN IF NOT EXISTS country_code TEXT DEFAULT 'CL' REFERENCES countries(code);
ALTER TABLE schools ADD COLUMN IF NOT EXISTS region TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS grading_scale_min DECIMAL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS grading_scale_max DECIMAL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS passing_grade DECIMAL;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS exigencia DECIMAL DEFAULT 0.60;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ministry_format TEXT DEFAULT 'generic';

-- ================================================================
-- 4. Taxonomia curricular (ejes, habilidades, OAs)
-- ================================================================
CREATE TABLE IF NOT EXISTS curriculum_axes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name, subject)
);

CREATE TABLE IF NOT EXISTS curriculum_skills (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    taxonomy TEXT, -- Ej: Bloom, Marzano, etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

CREATE TABLE IF NOT EXISTS learning_objectives (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    code TEXT NOT NULL,
    description TEXT NOT NULL,
    axis_id UUID REFERENCES curriculum_axes(id),
    grade_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, code)
);

-- ================================================================
-- 5. Questions con taxonomia curricular
-- ================================================================
ALTER TABLE papers ADD COLUMN IF NOT EXISTS question_tags JSONB DEFAULT '[]';

-- Tabla separada para metadata de preguntas
CREATE TABLE IF NOT EXISTS question_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    question_number INT NOT NULL,
    axis UUID REFERENCES curriculum_axes(id),
    skill UUID REFERENCES curriculum_skills(id),
    objective UUID REFERENCES learning_objectives(id),
    difficulty TEXT CHECK (difficulty IN ('basic', 'medium', 'advanced')),
    weight DECIMAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_number)
);

-- ================================================================
-- 6. Export formats por pais
-- ================================================================
CREATE TABLE IF NOT EXISTS export_formats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code TEXT REFERENCES countries(code) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    delimiter TEXT DEFAULT ',',
    encoding TEXT DEFAULT 'UTF-8',
    header_template JSONB,
    column_mapping JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO export_formats (country_code, name, description, column_mapping) VALUES
    ('CL', 'agencia_calidad', 'Agencia de Calidad de la Educacion Chile',
     '{"student_id":"RUN","student_name":"Nombre","score":"Puntaje","grade":"Nota","subject":"Asignatura","axis":"Eje","skill":"Habilidad","date":"Fecha"}'),
    ('CO', 'icfes', 'ICFES Colombia - Pruebas Saber',
     '{"student_id":"ID","student_name":"Estudiante","score":"Puntaje","grade":"Calificacion","axis":"Competencia","objective":"DBA"}'),
    ('MX', 'planea', 'PLANEA Mexico',
     '{"student_id":"CURP","student_name":"Alumno","score":"Aciertos","grade":"Calificacion","axis":"Eje","skill":"Habilidad"}'),
    ('generic', 'generic_csv', 'Formato CSV generico',
     '{"student_id":"ID","student_name":"Nombre","score":"Puntaje","grade":"Nota","total":"Total","percentage":"Porcentaje"}')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 7. Student grades history (registro historico de notas)
-- ================================================================
CREATE TABLE IF NOT EXISTS grade_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    student_code TEXT NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
    raw_score INT,
    total_questions INT,
    calculated_grade DECIMAL,
    passing BOOLEAN,
    graded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_code, quiz_id)
);

-- ================================================================
-- 8. Indices y RLS
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_schools_country ON schools(country_code);
CREATE INDEX IF NOT EXISTS idx_grade_records_student ON grade_records(student_code);
CREATE INDEX IF NOT EXISTS idx_question_metadata_quiz ON question_metadata(quiz_id);

ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_records ENABLE ROW LEVEL SECURITY;

-- RLS: miembros del colegio
CREATE POLICY "school_curriculum_axes" ON curriculum_axes FOR ALL USING (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()));
CREATE POLICY "school_curriculum_skills" ON curriculum_skills FOR ALL USING (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()));
CREATE POLICY "school_learning_objectives" ON learning_objectives FOR ALL USING (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()));
CREATE POLICY "school_question_metadata" ON question_metadata FOR ALL USING (quiz_id IN (SELECT id FROM quizzes WHERE school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())));
CREATE POLICY "school_grade_records" ON grade_records FOR ALL USING (school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid()));

-- ================================================================
-- 9. Funcion: calcular nota segun pais
-- ================================================================
CREATE OR REPLACE FUNCTION calculate_grade(
    raw_score INT,
    total_questions INT,
    grade_min DECIMAL DEFAULT 1.0,
    grade_max DECIMAL DEFAULT 7.0,
    passing_grade DECIMAL DEFAULT 4.0,
    exigencia DECIMAL DEFAULT 0.60
) RETURNS TABLE(grade DECIMAL, passing BOOLEAN, percentage DECIMAL) AS $$
DECLARE
    pct DECIMAL;
    calc_grade DECIMAL;
BEGIN
    IF total_questions <= 0 THEN
        RETURN QUERY SELECT 0::DECIMAL, false, 0::DECIMAL;
        RETURN;
    END IF;

    pct := raw_score::DECIMAL / total_questions::DECIMAL;
    
    -- Formula: (score/total) * (max - min) + min
    -- Con exigencia: la nota minima aprobatoria corresponde a la exigencia
    IF pct >= exigencia THEN
        calc_grade := ((pct - exigencia) / (1.0 - exigencia)) * (grade_max - passing_grade) + passing_grade;
    ELSE
        calc_grade := (pct / exigencia) * (passing_grade - grade_min) + grade_min;
    END IF;

    IF calc_grade > grade_max THEN calc_grade := grade_max; END IF;
    IF calc_grade < grade_min THEN calc_grade := grade_min; END IF;

    RETURN QUERY SELECT ROUND(calc_grade::DECIMAL, 1), pct >= exigencia, ROUND(pct * 100, 1);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
