CREATE TABLE IF NOT EXISTS public.webhook_events (
  event_id text PRIMARY KEY,
  gateway text NOT NULL,
  processed_at timestamptz DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Denegar todo a anon y authenticated, permitir solo al service role admin (via bypass rls u opciones especificas)
DROP POLICY IF EXISTS "Deny all webhook_events" ON public.webhook_events;
CREATE POLICY "Deny all webhook_events" ON public.webhook_events FOR ALL USING (false);

NOTIFY pgrst, 'reload schema';
