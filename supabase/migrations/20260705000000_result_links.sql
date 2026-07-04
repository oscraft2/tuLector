-- Portal de resultados para familias y alumnos.
-- Tabla de enlaces seguros por token (UUID v4) que permite a colegios
-- publicar resultados individuales sin exponer datos de otros alumnos.
--
-- Políticas RLS:
--  - papers/quizzes/schools: lecturas públicas solo via result_links activos
--  - result_links: view_count via SECURITY DEFINER (anon-friendly)
--  - result_links: CRUD solo para miembros del colegio (admin para insert/update/delete)
--  - NO se expone result_links a anónimos via REST API (se usa service_role en server code)

CREATE TABLE IF NOT EXISTS public.result_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  quiz_id     uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  paper_id    uuid NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
  token       uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_by  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  privacy_level text NOT NULL DEFAULT 'full_name'
                CHECK (privacy_level IN ('full_name', 'initials_only', 'id_only')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  view_count      integer NOT NULL DEFAULT 0,
  last_viewed_at  timestamptz
);

COMMENT ON TABLE public.result_links IS 'Enlaces seguros para que familias y alumnos vean sus resultados sin login';
COMMENT ON COLUMN public.result_links.privacy_level IS 'full_name: nombre completo, initials_only: iniciales (M.J.L.), id_only: solo ID interno';

-- Indices
CREATE INDEX IF NOT EXISTS idx_result_links_school_quiz ON public.result_links(school_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_result_links_token ON public.result_links(token);
CREATE INDEX IF NOT EXISTS idx_result_links_paper ON public.result_links(paper_id);

-- RLS: habilitar
ALTER TABLE public.result_links ENABLE ROW LEVEL SECURITY;

-- Politica: miembros del colegio pueden leer los enlaces de su colegio
DROP POLICY IF EXISTS "members_select_result_links" ON public.result_links;
CREATE POLICY "members_select_result_links" ON public.result_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
    )
  );

-- Politica: solo admins del colegio pueden crear enlaces
DROP POLICY IF EXISTS "admins_insert_result_links" ON public.result_links;
CREATE POLICY "admins_insert_result_links" ON public.result_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
        AND school_members.role = 'admin'
    )
  );

-- Politica: solo admins del colegio pueden actualizar (revocar)
DROP POLICY IF EXISTS "admins_update_result_links" ON public.result_links;
CREATE POLICY "admins_update_result_links" ON public.result_links
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
        AND school_members.role = 'admin'
    )
  ) WITH CHECK (true);

-- Politica: solo admins del colegio pueden eliminar
DROP POLICY IF EXISTS "admins_delete_result_links" ON public.result_links;
CREATE POLICY "admins_delete_result_links" ON public.result_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM school_members
      WHERE school_members.school_id = result_links.school_id
        AND school_members.user_id = auth.uid()
        AND school_members.role = 'admin'
    )
  );

-- ============================================================
-- POLITICAS RLS PUBLICAS para el portal (BUG 1 fix)
-- Permiten a cualquier persona (incluido anon) leer papers,
-- quizzes y schools SOLO si existe un result_link activo.
-- ============================================================

DROP POLICY IF EXISTS "public_read_papers_via_result_link" ON public.papers;
CREATE POLICY "public_read_papers_via_result_link" ON public.papers
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.result_links
      WHERE result_links.paper_id = papers.id
        AND result_links.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "public_read_quizzes_via_result_link" ON public.quizzes;
CREATE POLICY "public_read_quizzes_via_result_link" ON public.quizzes
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.result_links
      WHERE result_links.quiz_id = quizzes.id
        AND result_links.revoked_at IS NULL
    )
  );

DROP POLICY IF EXISTS "public_read_schools_via_result_link" ON public.schools;
CREATE POLICY "public_read_schools_via_result_link" ON public.schools
  FOR SELECT TO anon USING (
    EXISTS (
      SELECT 1 FROM public.result_links
      WHERE result_links.school_id = schools.id
        AND result_links.revoked_at IS NULL
    )
  );

-- ============================================================
-- SECURITY DEFINER para view_count (BUG 2 fix)
-- Permite a anon/authenticated incrementar el contador de vistas
-- sin exponer UPDATE directo sobre la tabla.
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_result_link_view(link_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS
'UPDATE public.result_links
    SET view_count = COALESCE(view_count, 0) + 1,
        last_viewed_at = now()
  WHERE id = link_id';

REVOKE ALL ON FUNCTION public.increment_result_link_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_result_link_view(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
