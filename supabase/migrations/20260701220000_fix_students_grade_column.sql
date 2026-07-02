-- La tabla students se creo originalmente con columna "grade" (20260525000000_init.sql)
-- pero en la base de datos real esa columna nunca quedo aplicada, mientras que
-- course/rut/updated_at (agregadas despues, 20260626010000_dashboard_platform.sql)
-- si estan presentes. Esto rompe /dashboard/students por completo: el select
-- que usa la pagina (id,student_id,rut,name,course,grade,created_at) falla con
-- "column students.grade does not exist" y la tabla se ve vacia aunque haya
-- alumnos, y createStudent() falla al insertar (upsert incluye grade: course).
ALTER TABLE students ADD COLUMN IF NOT EXISTS grade TEXT;
