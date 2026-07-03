ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

UPDATE quizzes q
SET course_id = c.id
FROM courses c
WHERE c.school_id = q.school_id
  AND c.name = q.grade
  AND q.course_id IS NULL;

UPDATE students s
SET course_id = c.id
FROM courses c
WHERE c.school_id = s.school_id
  AND c.name = s.course
  AND s.course_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_school_course_id ON quizzes (school_id, course_id);
CREATE INDEX IF NOT EXISTS idx_students_school_course_id ON students (school_id, course_id);

NOTIFY pgrst, 'reload schema';
