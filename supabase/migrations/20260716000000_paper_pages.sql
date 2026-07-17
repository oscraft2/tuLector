-- Multipagina (Fase 1, ver docs/plan-multipagina-fase1.md). Tabla SEPARADA de
-- `papers` a proposito: evita violar el CHECK(status IN (...)) de papers,
-- evita que el trigger on_paper_insert_increment_scan_usage (dispara por
-- cada INSERT en papers) sobre-cuente la cuota por pagina escaneada, y evita
-- tocar cualquier lugar que hoy lista `papers` sin filtrar por status
-- (dashboard/results/[quizId], api/export/results/[quizId], etc.) -- una
-- pagina parcial sin ensamblar nunca entra a `papers`.
--
-- Aplicar a mano en Supabase -> SQL Editor o `supabase db push`
-- (Vercel no corre migraciones). Despues: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS paper_pages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  quiz_id uuid not null references quizzes(id) on delete cascade,
  student_code_norm text not null,   -- mismo criterio que resolveNationalId().normalized
  student_code_raw text,
  student_name text,
  sheet_id integer not null,
  page integer not null,
  pages_total integer not null,
  answers jsonb not null default '[]',  -- [{q, a}] YA en numeracion GLOBAL del ensayo
  scanned_at timestamptz not null default now(),
  unique (quiz_id, student_code_norm, page)
);

CREATE INDEX IF NOT EXISTS idx_paper_pages_group ON paper_pages (quiz_id, student_code_norm);

ALTER TABLE paper_pages ENABLE ROW LEVEL SECURITY;

-- Reusa is_school_member(), ya definida en 20260626093000_mobile_auth_scan_link.sql
-- (misma funcion que usa la policy "school_papers" sobre `papers`).
CREATE POLICY "school_paper_pages" ON paper_pages
  FOR ALL
  USING (is_school_member(school_id))
  WITH CHECK (is_school_member(school_id));

NOTIFY pgrst, 'reload schema';
