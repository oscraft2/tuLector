-- TuLector LATAM v4 - Sistema completo de evaluaciones estandarizadas
-- Soporta: SIMCE/DIA (CL), Aprender (AR), PLANEA (MX), Saber/ICFES (CO)
-- Ejecutar en SQL Editor de Supabase

-- ================================================================
-- 1. PAISES - Datos oficiales de sistemas educativos
-- ================================================================
CREATE TABLE IF NOT EXISTS countries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    grade_scale_min DECIMAL DEFAULT 1.0,
    grade_scale_max DECIMAL DEFAULT 7.0,
    passing_grade DECIMAL DEFAULT 4.0,
    exigencia DECIMAL DEFAULT 0.60,
    id_type TEXT DEFAULT 'alphanumeric',
    id_format_regex TEXT,
    education_system TEXT,
    evaluation_agency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO countries (code, name, grade_scale_min, grade_scale_max, passing_grade, exigencia, id_type, evaluation_agency, education_system) VALUES
    ('CL', 'Chile', 1.0, 7.0, 4.0, 0.60, 'rut', 'Agencia de Calidad de la Educacion', 'SIMCE / DIA'),
    ('AR', 'Argentina', 1, 10, 6, 0.60, 'dni', 'Secretaria de Evaluacion Educativa', 'Aprender'),
    ('MX', 'Mexico', 200, 800, 500, 0.50, 'curp', 'INEE / MEJOREDU', 'PLANEA'),
    ('CO', 'Colombia', 0, 500, 300, 0.50, 'documento', 'ICFES', 'Pruebas Saber')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    evaluation_agency = EXCLUDED.evaluation_agency,
    education_system = EXCLUDED.education_system;

-- ================================================================
-- 2. SISTEMAS DE EVALUACION por pais (tests estandarizados)
-- ================================================================
CREATE TABLE IF NOT EXISTS evaluation_systems (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code TEXT REFERENCES countries(code) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    grade_levels JSONB,
    subjects JSONB,
    score_scale_min DECIMAL,
    score_scale_max DECIMAL,
    frequency TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(country_code, name)
);

INSERT INTO evaluation_systems (country_code, name, description, grade_levels, subjects, score_scale_min, score_scale_max, frequency) VALUES
    ('CL', 'SIMCE', 'Sistema de Medicion de la Calidad de la Educacion',
     '["4° Basico","8° Basico","II Medio"]',
     '["Lenguaje","Matematicas","Ciencias Naturales","Historia"]',
     100, 400, 'anual_alternado'),
    ('CL', 'DIA', 'Diagnostico Integral de Aprendizajes',
     '["1° Basico","2° Basico","3° Basico","4° Basico","5° Basico","6° Basico","7° Basico","8° Basico","I Medio","II Medio"]',
     '["Lectura","Matematicas","Escritura"]',
     0, 100, 'trimestral'),
    ('AR', 'Aprender', 'Evaluacion Nacional Aprender',
     '["6° Grado Primaria","5°/6° Año Secundaria"]',
     '["Lengua","Matematica","Ciencias Naturales","Ciencias Sociales"]',
     0, 100, 'anual'),
    ('MX', 'PLANEA', 'Plan Nacional para la Evaluacion de los Aprendizajes',
     '["3° Primaria","6° Primaria","3° Secundaria","Media Superior"]',
     '["Lenguaje y Comunicacion","Matematicas"]',
     200, 800, 'anual'),
    ('CO', 'Saber', 'Pruebas Saber ICFES',
     '["3°","5°","9°","11°"]',
     '["Lectura Critica","Matematicas","Ciencias Naturales","Sociales y Ciudadanas","Ingles"]',
     0, 500, 'anual')
ON CONFLICT (country_code, name) DO UPDATE SET
    description = EXCLUDED.description,
    grade_levels = EXCLUDED.grade_levels,
    subjects = EXCLUDED.subjects;

-- ================================================================
-- 3. TAXONOMIA CURRICULAR OFICIAL por pais
-- ================================================================
CREATE TABLE IF NOT EXISTS curriculum_taxonomy (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code TEXT REFERENCES countries(code) NOT NULL,
    subject TEXT NOT NULL,
    axis_code TEXT NOT NULL,
    axis_name TEXT NOT NULL,
    skill_name TEXT,
    learning_objective TEXT,
    grade_level TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chile: Ejes y Habilidades SIMCE
INSERT INTO curriculum_taxonomy (country_code, subject, axis_code, axis_name, skill_name, grade_level) VALUES
    ('CL','Lenguaje','LEC','Lectura','Localizar','4° Basico'),
    ('CL','Lenguaje','LEC','Lectura','Interpretar y Relacionar','4° Basico'),
    ('CL','Lenguaje','LEC','Lectura','Reflexionar','4° Basico'),
    ('CL','Matematicas','NUM','Numeros y Operaciones','Conocer','4° Basico'),
    ('CL','Matematicas','NUM','Numeros y Operaciones','Aplicar','4° Basico'),
    ('CL','Matematicas','NUM','Numeros y Operaciones','Razonar','4° Basico'),
    ('CL','Matematicas','GEO','Geometria','Conocer','4° Basico'),
    ('CL','Matematicas','GEO','Geometria','Aplicar','4° Basico'),
    ('CL','Matematicas','GEO','Geometria','Razonar','4° Basico'),
    ('CL','Matematicas','DAT','Datos y Probabilidades','Conocer','4° Basico'),
    ('CL','Matematicas','DAT','Datos y Probabilidades','Aplicar','4° Basico'),
    ('CL','Matematicas','DAT','Datos y Probabilidades','Razonar','4° Basico'),
    ('CL','Ciencias','BIO','Biologia','Conocimiento Cientifico','4° Basico'),
    ('CL','Ciencias','BIO','Biologia','Pensamiento Cientifico','4° Basico'),
    ('CL','Ciencias','FIS','Fisica','Conocimiento Cientifico','4° Basico'),
    ('CL','Ciencias','FIS','Fisica','Pensamiento Cientifico','4° Basico');

-- Mexico: Unidades de Analisis PLANEA
INSERT INTO curriculum_taxonomy (country_code, subject, axis_code, axis_name, skill_name, grade_level) VALUES
    ('MX','Lenguaje y Comunicacion','COMP','Comprension Lectora','Extraccion de Informacion','3° Primaria'),
    ('MX','Lenguaje y Comunicacion','COMP','Comprension Lectora','Interpretacion','3° Primaria'),
    ('MX','Lenguaje y Comunicacion','COMP','Comprension Lectora','Reflexion Semantica','3° Primaria'),
    ('MX','Lenguaje y Comunicacion','COMP','Comprension Lectora','Reflexion Sintactica','3° Primaria'),
    ('MX','Matematicas','NUM','Sentido Numerico','Comprension Conceptual','3° Primaria'),
    ('MX','Matematicas','NUM','Sentido Numerico','Aplicacion de Algoritmos','3° Primaria'),
    ('MX','Matematicas','GEO','Forma, Espacio y Medida','Comprension Conceptual','3° Primaria'),
    ('MX','Matematicas','GEO','Forma, Espacio y Medida','Aplicacion de Algoritmos','3° Primaria');

-- Colombia: Competencias ICFES Saber
INSERT INTO curriculum_taxonomy (country_code, subject, axis_code, axis_name, skill_name, grade_level) VALUES
    ('CO','Lectura Critica','TXT','Textos Continuos','Identificar','5°'),
    ('CO','Lectura Critica','TXT','Textos Continuos','Comprender','5°'),
    ('CO','Lectura Critica','TXT','Textos Continuos','Analizar','5°'),
    ('CO','Lectura Critica','TXT','Textos Discontinuos','Identificar','5°'),
    ('CO','Lectura Critica','TXT','Textos Discontinuos','Comprender','5°'),
    ('CO','Matematicas','NUM','Numerico-Variacional','Interpretacion','5°'),
    ('CO','Matematicas','NUM','Numerico-Variacional','Formulacion','5°'),
    ('CO','Matematicas','GEO','Geometrico-Metrico','Interpretacion','5°'),
    ('CO','Matematicas','GEO','Geometrico-Metrico','Formulacion','5°'),
    ('CO','Matematicas','ALE','Aleatorio','Interpretacion','5°'),
    ('CO','Matematicas','ALE','Aleatorio','Formulacion','5°');

-- ================================================================
-- 4. NIVELES DE DESEMPENO OFICIALES por sistema de evaluacion
-- ================================================================
CREATE TABLE IF NOT EXISTS performance_levels (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    system_id UUID REFERENCES evaluation_systems(id) ON DELETE CASCADE NOT NULL,
    level_number INT NOT NULL,
    level_name TEXT NOT NULL,
    min_score DECIMAL NOT NULL,
    max_score DECIMAL NOT NULL,
    description TEXT,
    color_hex TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SIMCE Chile (4° Basico)
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 1, 'Insuficiente', 100, 240, 'No alcanza los aprendizajes esperados', '#EF4444'
FROM evaluation_systems WHERE country_code='CL' AND name='SIMCE';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 2, 'Elemental', 241, 280, 'Parcialmente alcanza los aprendizajes', '#F59E0B'
FROM evaluation_systems WHERE country_code='CL' AND name='SIMCE';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 3, 'Adecuado', 281, 400, 'Alcanza los aprendizajes esperados', '#22C55E'
FROM evaluation_systems WHERE country_code='CL' AND name='SIMCE';

-- PLANEA Mexico
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 1, 'Nivel I (Insuficiente)', 200, 415, 'Dominio insuficiente de los aprendizajes', '#EF4444'
FROM evaluation_systems WHERE country_code='MX' AND name='PLANEA';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 2, 'Nivel II (Basico)', 416, 500, 'Dominio basico de los aprendizajes', '#F59E0B'
FROM evaluation_systems WHERE country_code='MX' AND name='PLANEA';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 3, 'Nivel III (Satisfactorio)', 501, 620, 'Dominio satisfactorio de los aprendizajes', '#3B82F6'
FROM evaluation_systems WHERE country_code='MX' AND name='PLANEA';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 4, 'Nivel IV (Sobresaliente)', 621, 800, 'Dominio sobresaliente de los aprendizajes', '#22C55E'
FROM evaluation_systems WHERE country_code='MX' AND name='PLANEA';

-- Saber Colombia (5°)
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 1, 'Insuficiente', 100, 240, 'No supera las preguntas de menor complejidad', '#EF4444'
FROM evaluation_systems WHERE country_code='CO' AND name='Saber';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 2, 'Minimo', 241, 315, 'Supera preguntas de menor complejidad', '#F59E0B'
FROM evaluation_systems WHERE country_code='CO' AND name='Saber';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 3, 'Satisfactorio', 316, 395, 'Muestra desempeño adecuado', '#3B82F6'
FROM evaluation_systems WHERE country_code='CO' AND name='Saber';
INSERT INTO performance_levels (system_id, level_number, level_name, min_score, max_score, description, color_hex)
SELECT id, 4, 'Avanzado', 396, 500, 'Muestra desempeño sobresaliente', '#22C55E'
FROM evaluation_systems WHERE country_code='CO' AND name='Saber';

-- ================================================================
-- 5. EXPORT FORMATS oficiales por sistema de gobierno
-- ================================================================
CREATE TABLE IF NOT EXISTS export_formats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    delimiter TEXT DEFAULT ',',
    encoding TEXT DEFAULT 'UTF-8',
    header_template JSONB,
    column_mapping JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO export_formats (country_code, name, description, column_mapping) VALUES
    ('CL', 'agencia_calidad_2024', 'Agencia de Calidad Chile - Formato oficial 2024',
     '{"run":"RUN","nombre":"Nombre","curso":"Curso","puntaje":"Puntaje","nivel_logro":"Nivel Logro","eje":"Eje","habilidad":"Habilidad","fecha":"Fecha"}'),
    ('MX', 'planea_2024', 'PLANEA Mexico - Reporte oficial',
     '{"curp":"CURP","alumno":"Alumno","puntaje":"Puntaje Global","nivel":"Nivel Logro","unidad":"Unidad Analisis","proceso":"Proceso Cognitivo"}'),
    ('CO', 'icfes_2024', 'ICFES Colombia - Reporte Saber',
     '{"id":"ID Estudiante","nombre":"Nombre","puntaje_global":"Puntaje Global","percentil":"Percentil","competencia":"Competencia","nivel":"Nivel Desempeño"}')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 6. Funcion SQL: calcular nivel de desempeño segun sistema
-- ================================================================
CREATE OR REPLACE FUNCTION get_performance_level(
    p_score DECIMAL,
    p_country_code TEXT DEFAULT 'CL',
    p_system_name TEXT DEFAULT 'SIMCE'
) RETURNS TABLE(level_name TEXT, level_number INT, color_hex TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT pl.level_name, pl.level_number::INT, pl.color_hex
    FROM performance_levels pl
    JOIN evaluation_systems es ON es.id = pl.system_id
    WHERE es.country_code = p_country_code
      AND es.name = p_system_name
      AND p_score >= pl.min_score
      AND p_score <= pl.max_score
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

-- ================================================================
-- 7. Funcion SQL: escalar puntaje entre sistemas
-- ================================================================
CREATE OR REPLACE FUNCTION scale_score(
    p_raw_score INT,
    p_total INT,
    p_from_min DECIMAL DEFAULT 0,
    p_from_max DECIMAL DEFAULT 100,
    p_to_min DECIMAL DEFAULT 200,
    p_to_max DECIMAL DEFAULT 800
) RETURNS DECIMAL AS $$
DECLARE
    pct DECIMAL;
BEGIN
    IF p_total <= 0 THEN RETURN p_to_min; END IF;
    pct := p_raw_score::DECIMAL / p_total::DECIMAL;
    RETURN ROUND(p_to_min + pct * (p_to_max - p_to_min));
END;
$$ LANGUAGE plpgsql IMMUTABLE;
