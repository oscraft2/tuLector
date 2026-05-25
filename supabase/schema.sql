-- ESQUEMA PARA SUPABASE - Ejecutar en SQL Editor
-- Tablas: quizzes, papers, students, users (auth), answer_keys

-- 1. Tabla de examenes/quizzes
CREATE TABLE quizzes (
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

-- 2. Tabla de hojas escaneadas (papers)
CREATE TABLE papers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT,
    student_name TEXT,
    score INT,
    total INT,
    answers JSONB,
    raw_scores JSONB,
    image_url TEXT,
    scanned_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabla de estudiantes
CREATE TABLE students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, student_id)
);

-- 4. Indices
CREATE INDEX idx_quizzes_user ON quizzes(user_id);
CREATE INDEX idx_papers_quiz ON papers(quiz_id);
CREATE INDEX idx_papers_user ON papers(user_id);
CREATE INDEX idx_students_user ON students(user_id);

-- 5. Politicas RLS
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD their quizzes" ON quizzes
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their papers" ON papers
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD their students" ON students
    FOR ALL USING (auth.uid() = user_id);

-- 6. Bucket para imagenes
INSERT INTO storage.buckets (id, name, public) VALUES ('papers', 'papers', false);

CREATE POLICY "Users can upload their papers" ON storage.objects
    FOR INSERT WITH CHECK (auth.uid() = owner);

CREATE POLICY "Users can read their papers" ON storage.objects
    FOR SELECT USING (auth.uid() = owner);
