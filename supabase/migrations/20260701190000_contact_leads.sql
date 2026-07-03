-- Commercial lead capture for institutional TuLector contact requests.
CREATE TABLE IF NOT EXISTS contact_leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    institution TEXT,
    institutional_rut TEXT,
    role TEXT,
    phone TEXT,
    country TEXT,
    locale TEXT NOT NULL DEFAULT 'es',
    source TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    consent_marketing BOOLEAN NOT NULL DEFAULT TRUE,
    consent_text TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    internal_note TEXT,
    contacted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT contact_leads_status_check CHECK (status IN ('new', 'contacted', 'qualified', 'discarded', 'blocked')),
    CONSTRAINT contact_leads_email_length CHECK (char_length(email) <= 254)
);

CREATE INDEX IF NOT EXISTS idx_contact_leads_created_at ON contact_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_leads_status ON contact_leads(status);
CREATE INDEX IF NOT EXISTS idx_contact_leads_country ON contact_leads(country);
CREATE INDEX IF NOT EXISTS idx_contact_leads_locale ON contact_leads(locale);

ALTER TABLE contact_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_leads_staff_read" ON contact_leads;
CREATE POLICY "contact_leads_staff_read" ON contact_leads FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.user_id = auth.uid()
          AND pu.revoked_at IS NULL
          AND pu.role IN ('platform_admin', 'support', 'marketing')
    )
);

DROP POLICY IF EXISTS "contact_leads_staff_update" ON contact_leads;
CREATE POLICY "contact_leads_staff_update" ON contact_leads FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM platform_users pu
        WHERE pu.user_id = auth.uid()
          AND pu.revoked_at IS NULL
          AND pu.role IN ('platform_admin', 'marketing')
    )
);
