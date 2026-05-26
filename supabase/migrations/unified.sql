-- TuLector - SQL UNIFICADO v1.0
-- Ejecutar una sola vez en: https://supabase.com/dashboard/project/cqpdptscnszpddhugmjr/sql/new
-- Crea TODAS las tablas: core + multi-tenant + LATAM + evaluaciones

-- ================================================================
-- BLOQUE 1: Core - Multi-tenant
-- ================================================================
CREATE TABLE IF NOT EXISTS schools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    plan TEXT DEFAULT 'starter',
    country_code TEXT DEFAULT 'CL',
    region TEXT,
    city TEXT,
    grading_scale_min DECIMAL,
    grading_scale_max DECIMAL,
    passing_grade DECIMAL,
    exigencia DECIMAL DEFAULT 0.60,
    ministry_format TEXT DEFAULT 'generic',
    scans_limit INT DEFAULT 100,
    scans_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'teacher',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, user_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{"read": true, "write": false}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    num_questions INT DEFAULT 20,
    options_per_question INT DEFAULT 5,
    option_labels TEXT DEFAULT 'A,B,C,D,E',
    answer_key TEXT NOT NULL,
    subject TEXT,
    grade TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    grade TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, student_id)
);

CREATE TABLE IF NOT EXISTS papers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) NOT NULL,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT,
    student_name TEXT,
    score INT,
    total INT,
    answers JSONB DEFAULT '[]',
    raw_scores JSONB DEFAULT '[]',
    question_tags JSONB DEFAULT '[]',
    image_url TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- BLOQUE 2: Taxonomia curricular LATAM
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
    taxonomy TEXT,
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

CREATE TABLE IF NOT EXISTS question_metadata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    question_number INT NOT NULL,
    axis_code TEXT,
    axis_name TEXT,
    skill_name TEXT,
    difficulty TEXT,
    weight DECIMAL DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(quiz_id, question_number)
);

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
-- BLOQUE 3: Indices
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_quizzes_school ON quizzes(school_id);
CREATE INDEX IF NOT EXISTS idx_papers_school ON papers(school_id);
CREATE INDEX IF NOT EXISTS idx_papers_quiz ON papers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_school_members_user ON school_members(user_id);
CREATE INDEX IF NOT EXISTS idx_school_members_school ON school_members(school_id);
CREATE INDEX IF NOT EXISTS idx_grade_records_student ON grade_records(student_code);
CREATE INDEX IF NOT EXISTS idx_question_metadata_quiz ON question_metadata(quiz_id);

-- ================================================================
-- BLOQUE 4: RLS (Row Level Security)
-- ================================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_axes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE grade_records ENABLE ROW LEVEL SECURITY;

-- Schools: miembros ven su propio colegio (sin recurrir a school_members en la subquery)
DROP POLICY IF EXISTS "school_members_read" ON schools;
CREATE POLICY "school_members_read" ON schools FOR SELECT USING (true);

-- School members: cada usuario ve sus propias membresias
DROP POLICY IF EXISTS "members_read_own" ON school_members;
CREATE POLICY "members_read_own" ON school_members FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_manage_members" ON school_members;
CREATE POLICY "admin_manage_members" ON school_members FOR ALL USING (
    EXISTS (
        SELECT 1 FROM school_members sm 
        WHERE sm.user_id = auth.uid() AND sm.role = 'admin' 
        AND sm.school_id = school_members.school_id
    )
);

-- API Keys: solo admin
DROP POLICY IF EXISTS "admin_manage_api_keys" ON api_keys;
CREATE POLICY "admin_manage_api_keys" ON api_keys FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND role = 'admin' AND school_id = api_keys.school_id)
);

-- Quizzes/Papers/Students: miembros del colegio
DROP POLICY IF EXISTS "school_quizzes" ON quizzes;
CREATE POLICY "school_quizzes" ON quizzes FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = quizzes.school_id)
);

DROP POLICY IF EXISTS "school_papers" ON papers;
CREATE POLICY "school_papers" ON papers FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = papers.school_id)
);

DROP POLICY IF EXISTS "school_students" ON students;
CREATE POLICY "school_students" ON students FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = students.school_id)
);

-- Curriculum
DROP POLICY IF EXISTS "school_curriculum_axes" ON curriculum_axes;
CREATE POLICY "school_curriculum_axes" ON curriculum_axes FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = curriculum_axes.school_id)
);

DROP POLICY IF EXISTS "school_curriculum_skills" ON curriculum_skills;
CREATE POLICY "school_curriculum_skills" ON curriculum_skills FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = curriculum_skills.school_id)
);

DROP POLICY IF EXISTS "school_learning_objectives" ON learning_objectives;
CREATE POLICY "school_learning_objectives" ON learning_objectives FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = learning_objectives.school_id)
);

-- Question metadata: via quiz -> school
DROP POLICY IF EXISTS "school_question_metadata" ON question_metadata;
CREATE POLICY "school_question_metadata" ON question_metadata FOR ALL USING (
    EXISTS (SELECT 1 FROM quizzes q JOIN school_members sm ON sm.school_id = q.school_id WHERE q.id = question_metadata.quiz_id AND sm.user_id = auth.uid())
);

-- Grade records
DROP POLICY IF EXISTS "school_grade_records" ON grade_records;
CREATE POLICY "school_grade_records" ON grade_records FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = grade_records.school_id)
);

-- ================================================================
-- BLOQUE 5: Funciones
-- ================================================================
CREATE OR REPLACE FUNCTION calculate_grade(
    raw_score INT, total_questions INT, grade_min DECIMAL DEFAULT 1.0,
    grade_max DECIMAL DEFAULT 7.0, passing_grade DECIMAL DEFAULT 4.0, exigencia DECIMAL DEFAULT 0.60
) RETURNS TABLE(grade DECIMAL, passing BOOLEAN, percentage DECIMAL) AS $$
DECLARE pct DECIMAL; calc_grade DECIMAL;
BEGIN
    IF total_questions <= 0 THEN
        RETURN QUERY SELECT 0::DECIMAL, false, 0::DECIMAL; RETURN;
    END IF;
    pct := raw_score::DECIMAL / total_questions::DECIMAL;
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

CREATE OR REPLACE FUNCTION scale_score(
    p_raw_score INT, p_total INT, p_from_min DECIMAL DEFAULT 0,
    p_from_max DECIMAL DEFAULT 100, p_to_min DECIMAL DEFAULT 200, p_to_max DECIMAL DEFAULT 800
) RETURNS DECIMAL AS $$
DECLARE pct DECIMAL;
BEGIN
    IF p_total <= 0 THEN RETURN p_to_min; END IF;
    pct := p_raw_score::DECIMAL / p_total::DECIMAL;
    RETURN ROUND(p_to_min + pct * (p_to_max - p_to_min));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ================================================================
-- BLOQUE 6: Storage bucket
-- ================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('papers', 'papers', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "papers_storage_insert" ON storage.objects;
CREATE POLICY "papers_storage_insert" ON storage.objects FOR INSERT WITH CHECK (auth.uid() = owner);
DROP POLICY IF EXISTS "papers_storage_select" ON storage.objects;
CREATE POLICY "papers_storage_select" ON storage.objects FOR SELECT USING (auth.uid() = owner);
