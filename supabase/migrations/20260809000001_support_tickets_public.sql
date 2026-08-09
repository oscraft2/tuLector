-- Tickets accesibles por el cliente (logueado o por link público /t/[token]).
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS name  text,
  ADD COLUMN IF NOT EXISTS token uuid UNIQUE DEFAULT gen_random_uuid();

-- Hilo visible al cliente (a diferencia de support_ticket_notes, que es
-- interno y solo staff). RLS espeja support_tickets_school_staff, NO
-- support_ticket_notes (que es solo is_platform_staff).
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_type text NOT NULL CHECK (author_type IN ('customer','staff')),
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON public.support_ticket_messages (ticket_id, created_at);

ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;

-- Staff y miembros del colegio (RLS espeja support_tickets_school_staff)
DROP POLICY IF EXISTS "ticket_messages_school_staff" ON public.support_ticket_messages;
CREATE POLICY "ticket_messages_school_staff" ON public.support_ticket_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (is_platform_staff() OR is_school_member(t.school_id))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.support_tickets t
      WHERE t.id = support_ticket_messages.ticket_id
        AND (is_platform_staff() OR is_school_member(t.school_id))
    )
  );

-- Acceso anónimo SOLO por token (patrón /r/[token]): una función
-- SECURITY DEFINER devuelve el hilo + datos mínimos del ticket sin
-- exponer school_id/user_id.
CREATE OR REPLACE FUNCTION public.get_ticket_by_token(p_token uuid)
RETURNS TABLE (
  ticket_id uuid,
  subject text,
  status text,
  locale text,
  created_at timestamptz,
  msg_id uuid,
  msg_author_type text,
  msg_body text,
  msg_created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT t.id, t.subject, t.status, t.locale, t.created_at,
         m.id, m.author_type, m.body, m.created_at
  FROM public.support_tickets t
  LEFT JOIN public.support_ticket_messages m ON m.ticket_id = t.id
  WHERE t.token = p_token
  ORDER BY m.created_at;
$$;
REVOKE ALL ON FUNCTION public.get_ticket_by_token(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_ticket_by_token(uuid) TO anon, authenticated;

-- Insert anónimo por token (el cliente responde sin login).
CREATE OR REPLACE FUNCTION public.reply_ticket_by_token(
  p_token uuid, p_body text
)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.support_ticket_messages (ticket_id, author_type, body)
  SELECT id, 'customer', p_body
  FROM public.support_tickets WHERE token = p_token;
$$;
REVOKE ALL ON FUNCTION public.reply_ticket_by_token(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.reply_ticket_by_token(uuid, text) TO anon, authenticated;

-- Policy para permitir que un usuario anonimo cree un ticket de soporte.
DROP POLICY IF EXISTS "support_tickets_public_insert" ON public.support_tickets;
CREATE POLICY "support_tickets_public_insert" ON public.support_tickets
  FOR INSERT WITH CHECK (school_id IS NULL AND user_id IS NULL);

NOTIFY pgrst, 'reload schema';
