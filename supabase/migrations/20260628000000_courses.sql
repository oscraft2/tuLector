-- Migration to create courses table for school course catalog management
CREATE TABLE IF NOT EXISTS courses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- e.g. "IV Medio A"
    grade TEXT NOT NULL, -- e.g. "IV Medio" (Chilean grade)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(school_id, name)
);

-- Enable RLS and add policy for school members
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_courses_policy" ON courses;
CREATE POLICY "school_courses_policy" ON courses 
FOR ALL USING (
    school_id IN (
        SELECT school_id 
        FROM school_members 
        WHERE user_id = auth.uid()
    )
);
