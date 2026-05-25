-- TuLector - Esquema de base de datos
-- Tablas: quizzes, papers, students

-- 1. Quizzes (examenes configurados con clave de respuestas)
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    num_questions INT DEFAULT 20,
    options_per_question INT DEFAULT 5,
    option_labels TEXT DEFAULT 'A,B,C,D,E',
    answer_key TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Papers (hojas escaneadas individuales)
CREATE TABLE IF NOT EXISTS papers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
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

-- 3. Students (registro de estudiantes)
CREATE TABLE IF NOT EXISTS students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, student_id)
);

-- 4. Indices para rendimiento
CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_papers_quiz ON papers(quiz_id);
CREATE INDEX IF NOT EXISTS idx_papers_user ON papers(user_id);
CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);

-- 5. RLS (Row Level Security) - cada usuario solo ve sus datos
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'quizzes_user_policy') THEN
        CREATE POLICY "quizzes_user_policy" ON quizzes FOR ALL USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'papers_user_policy') THEN
        CREATE POLICY "papers_user_policy" ON papers FOR ALL USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'students_user_policy') THEN
        CREATE POLICY "students_user_policy" ON students FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Storage bucket para imagenes de hojas escaneadas
INSERT INTO storage.buckets (id, name, public)
VALUES ('papers', 'papers', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'papers_storage_insert') THEN
        CREATE POLICY "papers_storage_insert" ON storage.objects
            FOR INSERT WITH CHECK (auth.uid() = owner);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'papers_storage_select') THEN
        CREATE POLICY "papers_storage_select" ON storage.objects
            FOR SELECT USING (auth.uid() = owner);
    END IF;
END $$;
