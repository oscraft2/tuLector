-- Asignacion de tickets y notas internas de staff, para completar /admin/support
-- (hoy solo lista tickets sin ninguna accion). Notas en tabla normalizada aparte
-- (no JSONB array) para ser consistente con el resto del esquema y permitir RLS
-- propia -- son internas de staff, no deben ser visibles para el colegio.

ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS support_ticket_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES auth.users(id),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_notes_ticket ON support_ticket_notes(ticket_id, created_at);

ALTER TABLE support_ticket_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "support_ticket_notes_staff" ON support_ticket_notes FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_staff());
