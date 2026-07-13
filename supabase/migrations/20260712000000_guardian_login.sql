-- Fase 3 (login estudiantil/apoderado, ver docs/plan-multipais-motor.md).
-- Login por magic-link (Supabase Auth) para el APODERADO, vinculado a la(s)
-- ficha(s) de alumno que el colegio ya cargó, mediante el ID nacional del
-- alumno (RUT/DNI/CPF/... — multi-país, no solo RUT chileno) + email del
-- apoderado. Aditivo: no toca rut_normalized/student_rut_norm existentes
-- (Chile sigue funcionando exactamente igual, ver 20260703120000_rut_normalization.sql).
--
-- Aplicar a mano en Supabase → SQL Editor (Vercel no corre migraciones).
-- Después de aplicar: NOTIFY pgrst, 'reload schema';

-- ── ID nacional normalizado, genérico para cualquier país ──────────────────
-- Solo limpia formato (mayúscula, sin puntos/guiones/espacios) para poder
-- COMPARAR; la validación de formato real (regex por país) se hace en la app
-- con countries.id_format_regex antes de buscar/insertar. GENERATED STORED:
-- siempre en sync con `rut`/`student_id`, sin backfill manual que se pueda
-- olvidar.
ALTER TABLE students ADD COLUMN IF NOT EXISTS national_id_normalized text
  GENERATED ALWAYS AS (upper(regexp_replace(COALESCE(rut, student_id, ''), '[.\s-]', '', 'g'))) STORED;

CREATE INDEX IF NOT EXISTS idx_students_school_national_id
  ON students (school_id, national_id_normalized)
  WHERE national_id_normalized IS NOT NULL AND national_id_normalized <> '';

-- ── Cuenta de apoderado (Supabase Auth) <-> alumno(s) ───────────────────────
-- Un apoderado puede tener más de un pupilo; un alumno puede (en teoría)
-- tener más de un apoderado vinculado.
CREATE TABLE IF NOT EXISTS guardian_links (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (auth_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_guardian_links_auth_user ON guardian_links (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_guardian_links_student ON guardian_links (student_id);

ALTER TABLE guardian_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY guardian_links_select_own ON guardian_links
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- ── Vínculos pendientes (buzón interno, solo service role) ──────────────────
-- Entre "se pidió el magic-link" y "el apoderado hizo click en el correo",
-- necesitamos recordar qué alumno(s) matchearon la búsqueda por ID+país para
-- crear el guardian_link recién cuando la sesión se confirme en el callback
-- (signInWithOtp no garantiza pasar metadata propia de punta a punta con
-- todos los proveedores de correo). Expira solo por tiempo; las filas vencidas
-- se ignoran al leer (no hace falta un cron para que sea seguro).
CREATE TABLE IF NOT EXISTS guardian_pending_links (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  country_code text not null,
  national_id_normalized text not null,
  student_ids uuid[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_guardian_pending_links_email ON guardian_pending_links (email, expires_at);

ALTER TABLE guardian_pending_links ENABLE ROW LEVEL SECURITY;
-- Sin policies para authenticated/anon a propósito: solo el service role
-- (usado server-side en las rutas de login) puede leer/escribir esta tabla.

-- ── Lectura para apoderados vinculados (políticas ADITIVAS: se suman con OR
-- a las políticas de staff ya existentes — school_students/school_papers/
-- school_grade_records/school_quizzes en unified.sql — no las reemplazan) ──

CREATE POLICY students_select_guardian ON students
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guardian_links
      WHERE guardian_links.student_id = students.id
        AND guardian_links.auth_user_id = auth.uid()
    )
  );

-- papers.student_id es el código CRUDO escaneado (puede traer puntos/guiones);
-- student_rut_norm solo se llena para RUT chileno (tulector_canonical_rut).
-- Matchea por CUALQUIERA de los dos para no depender de que el país sea Chile.
CREATE POLICY papers_select_guardian ON papers
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guardian_links gl
      JOIN students s ON s.id = gl.student_id
      WHERE gl.auth_user_id = auth.uid()
        AND s.school_id = papers.school_id
        AND s.national_id_normalized <> ''
        AND (
          s.national_id_normalized = papers.student_rut_norm
          OR s.national_id_normalized = upper(regexp_replace(COALESCE(papers.student_id, ''), '[.\s-]', '', 'g'))
        )
    )
  );

CREATE POLICY grade_records_select_guardian ON grade_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guardian_links gl
      JOIN students s ON s.id = gl.student_id
      WHERE gl.auth_user_id = auth.uid()
        AND s.school_id = grade_records.school_id
        AND s.national_id_normalized <> ''
        AND (
          s.national_id_normalized = grade_records.student_code
          OR s.national_id_normalized = upper(regexp_replace(COALESCE(grade_records.student_code, ''), '[.\s-]', '', 'g'))
        )
    )
  );

-- Necesario para mostrar título/materia de la prueba junto a cada nota.
CREATE POLICY quizzes_select_guardian ON quizzes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guardian_links gl
      JOIN students s ON s.id = gl.student_id
      WHERE gl.auth_user_id = auth.uid()
        AND s.school_id = quizzes.school_id
    )
  );
