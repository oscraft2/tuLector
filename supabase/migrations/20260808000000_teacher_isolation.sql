-- Aisla ensayos/resultados por DOCENTE dentro de un mismo colegio (plan
-- "school", invitar varios profesores). Hasta ahora "school_quizzes" y las
-- policies equivalentes de papers/grade_records/question_metadata/paper_pages
-- solo exigian ser miembro del colegio (is_school_member), sin distinguir
-- quien creo el ensayo -- cualquier docente veia/tocaba los ensayos y
-- resultados de CUALQUIER otro docente del mismo colegio. quizzes.created_by
-- ya existe y se graba correctamente al crear (createQuiz/duplicateQuiz),
-- pero nunca se usaba para filtrar. is_school_admin() ya existe (creada en
-- 20260626093000_mobile_auth_scan_link.sql, usada por school_members) --
-- el admin del colegio sigue viendo/editando TODO, un docente no-admin solo
-- lo que el mismo creo.
--
-- IMPORTANTE: se reemplaza la policy existente (DROP + CREATE con el MISMO
-- nombre) en vez de agregar una nueva en paralelo -- RLS combina policies
-- permisivas con OR, asi que dejar la vieja "solo colegio" activa hubiera
-- anulado el aislamiento. Las policies de apoderados/portal publico
-- (*_select_guardian, public_read_*_via_result_link) y las de "solo mis
-- propias filas" (quizzes_user_policy, papers_user_policy,
-- students_user_policy) NO se tocan -- son independientes (OR) y no dan
-- acceso cruzado entre docentes.
--
-- Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones). Despues: NOTIFY pgrst, 'reload schema';

DROP POLICY IF EXISTS "school_quizzes" ON quizzes;
CREATE POLICY "school_quizzes" ON quizzes
  FOR ALL USING (
    is_school_member(school_id) AND (created_by = auth.uid() OR is_school_admin(school_id))
  )
  WITH CHECK (
    is_school_member(school_id) AND (created_by = auth.uid() OR is_school_admin(school_id))
  );

DROP POLICY IF EXISTS "school_papers" ON papers;
CREATE POLICY "school_papers" ON papers
  FOR ALL USING (
    is_school_member(school_id) AND (
      is_school_admin(school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = papers.quiz_id AND q.created_by = auth.uid())
    )
  )
  WITH CHECK (
    is_school_member(school_id) AND (
      is_school_admin(school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = papers.quiz_id AND q.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "school_grade_records" ON grade_records;
CREATE POLICY "school_grade_records" ON grade_records
  FOR ALL USING (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = grade_records.school_id) AND (
      is_school_admin(grade_records.school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = grade_records.quiz_id AND q.created_by = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM school_members WHERE user_id = auth.uid() AND school_id = grade_records.school_id) AND (
      is_school_admin(grade_records.school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = grade_records.quiz_id AND q.created_by = auth.uid())
    )
  );

DROP POLICY IF EXISTS "school_question_metadata" ON question_metadata;
CREATE POLICY "school_question_metadata" ON question_metadata
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM quizzes q
      JOIN school_members sm ON sm.school_id = q.school_id
      WHERE q.id = question_metadata.quiz_id
        AND sm.user_id = auth.uid()
        AND (q.created_by = auth.uid() OR is_school_admin(q.school_id))
    )
  );

DROP POLICY IF EXISTS "school_paper_pages" ON paper_pages;
CREATE POLICY "school_paper_pages" ON paper_pages
  FOR ALL USING (
    is_school_member(school_id) AND (
      is_school_admin(school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = paper_pages.quiz_id AND q.created_by = auth.uid())
    )
  )
  WITH CHECK (
    is_school_member(school_id) AND (
      is_school_admin(school_id) OR
      EXISTS (SELECT 1 FROM quizzes q WHERE q.id = paper_pages.quiz_id AND q.created_by = auth.uid())
    )
  );

-- ─── Cursos y alumnos: NO se restringen por RLS ───────────────────────────
-- A diferencia de quizzes/papers/etc, aca la RLS NO puede distinguir "vino
-- del boton Agregar Alumno" vs "vino de asignar un alumno nuevo al escanear
-- una hoja sin RUT conocido" (createStudentAndAssignPaper en actions.ts,
-- llamado por CUALQUIER docente durante el flujo normal de revision de
-- resultados -- bloquear el INSERT a nivel RLS rompe ese flujo para
-- no-admins). El bloqueo de "solo admin gestiona cursos/alumnos" queda
-- exclusivamente en los server actions explicitos (createCourse,
-- updateCourse, archiveCourse, restoreCourse, createStudent, importStudents,
-- importStudentsMapped, deleteStudent, updateStudent) -- ver actions.ts.
-- courses/students conservan su policy original (is_school_member, sin
-- cambios), NO se tocan en esta migracion.

NOTIFY pgrst, 'reload schema';
