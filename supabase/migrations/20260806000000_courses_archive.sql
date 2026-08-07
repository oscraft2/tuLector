-- Antes "Eliminar curso" borraba la fila para siempre (courses.id se pierde,
-- students.course_id de sus alumnos queda en NULL via ON DELETE SET NULL,
-- sin forma de recuperarlo). Se reemplaza por archivar (soft delete): oculta
-- el curso de los selectores activos pero permite restaurarlo sin perder
-- alumnos/ensayos ya vinculados por course_id.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
