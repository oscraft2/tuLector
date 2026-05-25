-- TuLector - Esquema unificado v2.0
-- Ejecutar TODO este archivo en SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/cqpdptscnszpddhugmjr/sql/new

-- ================================================================
-- TABLAS BASE
-- ================================================================
CREATE TABLE IF NOT EXISTS schools (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter','pro','school','district')),
    scans_limit INT DEFAULT 100,
    scans_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role TEXT DEFAULT 'teacher' CHECK (role IN ('admin','teacher','viewer')),
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
    image_url TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDICES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_school_members_user ON school_members(user_id);
CREATE INDEX IF NOT EXISTS idx_school_members_school ON school_members(school_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_school ON quizzes(school_id);
CREATE INDEX IF NOT EXISTS idx_papers_school ON papers(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_quiz ON papers(quiz_id);

-- ================================================================
-- RLS (Row Level Security)
-- ================================================================
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Schools: miembros ven su colegio
CREATE POLICY "members_read_school" ON schools FOR SELECT USING (
    id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

-- Members: admin gestiona
CREATE POLICY "admin_manage_members" ON school_members FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- API Keys: solo admin
CREATE POLICY "admin_manage_api_keys" ON api_keys FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid() AND role = 'admin')
);

-- Quizzes/Papers/Students: miembros ven datos de su colegio
CREATE POLICY "school_quizzes" ON quizzes FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

CREATE POLICY "school_papers" ON papers FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

CREATE POLICY "school_students" ON students FOR ALL USING (
    school_id IN (SELECT school_id FROM school_members WHERE user_id = auth.uid())
);

-- ================================================================
-- TRIGGER: crear colegio automatico al registrarse
-- ================================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_school_id UUID;
BEGIN
    INSERT INTO schools (name, plan)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'school_name', NEW.email), 'starter')
    RETURNING id INTO new_school_id;

    INSERT INTO school_members (school_id, user_id, role)
    VALUES (new_school_id, NEW.id, 'admin');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- STORAGE BUCKET
-- ================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "papers_storage_insert" ON storage.objects
    FOR INSERT WITH CHECK (auth.uid() = owner);

CREATE POLICY "papers_storage_select" ON storage.objects
    FOR SELECT USING (auth.uid() = owner);

-- ================================================================
-- TABLA DE LOGS DE ESCANEO (debug remoto)
-- ================================================================
CREATE TABLE IF NOT EXISTS scan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_agent TEXT,
    log JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permiso PUBLICO para insertar logs (sin auth, para debug)
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert_logs" ON scan_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select_logs" ON scan_logs FOR SELECT USING (true);
