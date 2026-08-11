-- Directorio de alumnos: busqueda + filtros + paginacion EN LA BASE.
--
-- Problema que resuelve: /dashboard/students hacia
--   supabase.from("students").select(...)   -- sin limit, sin range, sin school_id
-- y renderizaba una fila por alumno. Entrar al modulo traia la tabla completa.
-- Lo mismo el <select> de "agregar alumno al curso" y la pantalla movil.
--
-- Se usan FUNCIONES (no una vista): una funcion en SQL es SECURITY INVOKER por
-- defecto, asi que las policies de RLS de students/papers siguen aplicando tal
-- cual. Una vista necesitaria security_invoker=true explicito y, si el motor no
-- lo soporta, correria como su dueño y saltaria RLS -- fuga de datos entre
-- colegios. No vale la pena el riesgo.
--
-- Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones).

-- ─── Indices ───────────────────────────────────────────────────
-- El orden por defecto del listado es (school_id, name): hoy solo existe
-- idx_students_school, asi que cada entrada al modulo ordenaba en memoria.
CREATE INDEX IF NOT EXISTS idx_students_school_name ON students (school_id, name);
-- Filtro por nivel.
CREATE INDEX IF NOT EXISTS idx_students_school_grade ON students (school_id, grade);
-- El filtro "con/sin ensayos rendidos" ya tiene su indice desde
-- 20260703120000_rut_normalization.sql: idx_papers_school_student_rut_norm.

-- ─── Busqueda paginada de alumnos ──────────────────────────────
-- Devuelve la pagina pedida MAS el total de coincidencias (total_count) en una
-- sola ida. COUNT(*) OVER() se evalua antes del LIMIT, asi que da el total
-- filtrado sin una segunda pasada.
--
-- papers_count se calcula con un LATERAL que corre SOLO sobre las filas ya
-- limitadas (<= p_limit), no sobre todo el colegio. El filtro por
-- "tiene/no tiene ensayos" en cambio usa EXISTS dentro del WHERE, que corta en
-- la primera coincidencia usando el indice -- mucho mas barato que contar.
CREATE OR REPLACE FUNCTION public.search_students(
  p_school     uuid,
  p_q          text    DEFAULT NULL,   -- texto libre (ya saneado en la app)
  p_rut_norm   text    DEFAULT NULL,   -- ID nacional canonico, match exacto
  p_course     uuid    DEFAULT NULL,   -- filtro por curso
  p_no_course  boolean DEFAULT false,  -- solo alumnos sin curso asignado
  p_grade      text    DEFAULT NULL,   -- filtro por nivel
  p_has_papers boolean DEFAULT NULL,   -- true = con ensayos, false = sin, NULL = todos
  p_limit      int     DEFAULT 50,
  p_offset     int     DEFAULT 0
)
RETURNS TABLE (
  id           uuid,
  student_id   text,
  rut          text,
  name         text,
  course       text,
  course_id    uuid,
  grade        text,
  created_at   timestamptz,
  papers_count bigint,
  total_count  bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      s.id, s.student_id, s.rut, s.name, s.course, s.course_id, s.grade,
      s.created_at, s.rut_normalized, s.school_id,
      COUNT(*) OVER() AS total_count
    FROM students s
    WHERE s.school_id = p_school
      AND (
        p_q IS NULL OR p_q = '' OR
        s.name ILIKE '%' || p_q || '%' OR
        s.rut ILIKE '%' || p_q || '%' OR
        s.student_id ILIKE '%' || p_q || '%' OR
        (p_rut_norm IS NOT NULL AND s.rut_normalized = p_rut_norm)
      )
      AND (p_course IS NULL OR s.course_id = p_course)
      AND (
        NOT p_no_course OR
        (s.course_id IS NULL AND (s.course IS NULL OR btrim(s.course) = ''))
      )
      -- Nivel: calza contra students.grade O contra el nivel del curso del
      -- alumno. students.grade viene disperso (solo se llena si el CSV traia
      -- columna "nivel"), mientras que courses.grade siempre esta -- filtrar
      -- solo por el primero dejaria fuera a casi todos. Ademas es lo que el
      -- profesor espera: "I Medio" trae I Medio A, B y C.
      AND (
        p_grade IS NULL OR p_grade = '' OR
        s.grade = p_grade OR
        EXISTS (SELECT 1 FROM courses c WHERE c.id = s.course_id AND c.grade = p_grade)
      )
      AND (
        p_has_papers IS NULL OR
        p_has_papers = EXISTS (
          SELECT 1 FROM papers p
          WHERE p.school_id = s.school_id
            AND p.student_rut_norm IS NOT NULL
            AND p.student_rut_norm = s.rut_normalized
            AND p.status <> 'void'
        )
      )
    ORDER BY s.name
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    f.id, f.student_id, f.rut, f.name, f.course, f.course_id, f.grade,
    f.created_at,
    COALESCE(pc.cnt, 0)::bigint AS papers_count,
    f.total_count
  FROM filtered f
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS cnt
    FROM papers p
    WHERE f.rut_normalized IS NOT NULL
      AND p.school_id = f.school_id
      AND p.student_rut_norm = f.rut_normalized
      AND p.status <> 'void'
  ) pc ON TRUE
  ORDER BY f.name;
$$;

-- ─── Recuento de alumnos por curso ─────────────────────────────
-- Cuenta con el MISMO criterio que isStudentInCourse() en la app: por course_id,
-- o por nombre cuando course_id viene nulo (filas anteriores a
-- 20260704120000_course_id_links.sql). Contar solo por course_id dejaria esos
-- alumnos fuera del recuento.
CREATE OR REPLACE FUNCTION public.course_student_counts(p_school uuid)
RETURNS TABLE (course_id uuid, student_count bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT c.id, COUNT(s.id)
  FROM courses c
  LEFT JOIN students s
    ON s.school_id = c.school_id
   AND (s.course_id = c.id OR (s.course_id IS NULL AND s.course = c.name))
  WHERE c.school_id = p_school
  GROUP BY c.id;
$$;

GRANT EXECUTE ON FUNCTION public.search_students(uuid, text, text, uuid, boolean, text, boolean, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.course_student_counts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
