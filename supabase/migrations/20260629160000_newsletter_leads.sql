-- Public lead capture for footer/newsletter contact requests.
CREATE TABLE IF NOT EXISTS newsletter_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    locale TEXT NOT NULL DEFAULT 'es',
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT newsletter_leads_status_check CHECK (status IN ('new', 'contacted', 'closed', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_newsletter_leads_created_at ON newsletter_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_newsletter_leads_status ON newsletter_leads(status);

ALTER TABLE newsletter_leads ENABLE ROW LEVEL SECURITY;

-- No public insert policy: public submissions go through /api/leads/newsletter
-- using the service role, keeping the table private by default.
DROP POLICY IF EXISTS "newsletter_leads_staff_read" ON newsletter_leads;
CREATE POLICY "newsletter_leads_staff_read" ON newsletter_leads FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.user_id = auth.uid()
          AND pu.revoked_at IS NULL
          AND pu.role IN ('platform_admin', 'support')
    )
);
