-- Help Center: FAQ con categorías, multi-locale, full-text search.
CREATE TABLE IF NOT EXISTS public.faq_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locale      text NOT NULL CHECK (locale IN ('es-CL','es-MX','es-PE','es-AR','pt-BR')),
  slug        text NOT NULL,
  name        text NOT NULL,
  sort_order  int  NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE TABLE IF NOT EXISTS public.faq_articles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.faq_categories(id) ON DELETE CASCADE,
  locale      text NOT NULL CHECK (locale IN ('es-CL','es-MX','es-PE','es-AR','pt-BR')),
  slug        text NOT NULL,
  title       text NOT NULL,
  body_md     text NOT NULL,
  tags        text[] NOT NULL DEFAULT '{}',
  search      tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(body_md,''))
  ) STORED,
  view_count  int  NOT NULL DEFAULT 0,
  helpful_yes int  NOT NULL DEFAULT 0,
  helpful_no  int  NOT NULL DEFAULT 0,
  published   boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (locale, slug)
);

CREATE INDEX IF NOT EXISTS idx_faq_articles_search ON public.faq_articles USING gin (search);
CREATE INDEX IF NOT EXISTS idx_faq_articles_category ON public.faq_articles (category_id);
CREATE INDEX IF NOT EXISTS idx_faq_categories_locale ON public.faq_categories (locale, published, sort_order);

ALTER TABLE public.faq_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_articles  ENABLE ROW LEVEL SECURITY;

-- Lectura pública si published=true (mismo patrón que site_config_read).
DROP POLICY IF EXISTS "faq_categories_public_read" ON public.faq_categories;
CREATE POLICY "faq_categories_public_read" ON public.faq_categories
  FOR SELECT USING (published);
DROP POLICY IF EXISTS "faq_articles_public_read" ON public.faq_articles;
CREATE POLICY "faq_articles_public_read" ON public.faq_articles
  FOR SELECT USING (published);

-- Escritura solo plataforma (admin o staff `support`).
DROP POLICY IF EXISTS "faq_categories_staff_write" ON public.faq_categories;
CREATE POLICY "faq_categories_staff_write" ON public.faq_categories
  FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());
DROP POLICY IF EXISTS "faq_articles_staff_write" ON public.faq_articles;
CREATE POLICY "faq_articles_staff_write" ON public.faq_articles
  FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());

-- Voto "útil/no útil" anónimo (sin login, sin identificar al votante).
CREATE OR REPLACE FUNCTION public.faq_vote(p_article_id uuid, p_helpful boolean)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.faq_articles
  SET helpful_yes = helpful_yes + CASE WHEN p_helpful THEN 1 ELSE 0 END,
      helpful_no  = helpful_no  + CASE WHEN p_helpful THEN 0 ELSE 1 END
  WHERE id = p_article_id AND published;
$$;
REVOKE ALL ON FUNCTION public.faq_vote(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.faq_vote(uuid, boolean) TO anon, authenticated;

-- Incrementar view_count sin exponer UPDATE directo.
CREATE OR REPLACE FUNCTION public.faq_view(p_article_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  UPDATE public.faq_articles SET view_count = view_count + 1 WHERE id = p_article_id AND published;
$$;
REVOKE ALL ON FUNCTION public.faq_view(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.faq_view(uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
