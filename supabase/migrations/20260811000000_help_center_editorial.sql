-- Help Center editorial workflow, metadata and revisions.
ALTER TABLE public.faq_articles
  ADD COLUMN IF NOT EXISTS excerpt text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reading_minutes int NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

UPDATE public.faq_articles
SET status = CASE WHEN published THEN 'published' ELSE 'draft' END,
    published_at = CASE WHEN published THEN COALESCE(published_at, created_at) ELSE NULL END
WHERE status = 'draft' AND published = true;

CREATE INDEX IF NOT EXISTS idx_faq_articles_editorial
  ON public.faq_articles (locale, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.faq_article_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.faq_articles(id) ON DELETE CASCADE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body_md text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faq_article_revisions_article
  ON public.faq_article_revisions (article_id, created_at DESC);

ALTER TABLE public.faq_article_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "faq_article_revisions_staff" ON public.faq_article_revisions;
CREATE POLICY "faq_article_revisions_staff" ON public.faq_article_revisions
  FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());

-- Public token replies remain bounded and cannot reopen a closed ticket.
CREATE OR REPLACE FUNCTION public.reply_ticket_by_token(
  p_token uuid, p_body text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  target_id uuid;
  target_status text;
BEGIN
  IF p_body IS NULL OR length(trim(p_body)) = 0 OR length(p_body) > 10000 THEN
    RAISE EXCEPTION 'invalid_message';
  END IF;
  SELECT id, status INTO target_id, target_status
  FROM public.support_tickets WHERE token = p_token;
  IF target_id IS NULL OR target_status = 'closed' THEN
    RAISE EXCEPTION 'ticket_unavailable';
  END IF;
  INSERT INTO public.support_ticket_messages (ticket_id, author_type, body)
  VALUES (target_id, 'customer', trim(p_body));
END;
$$;
REVOKE ALL ON FUNCTION public.reply_ticket_by_token(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reply_ticket_by_token(uuid, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
