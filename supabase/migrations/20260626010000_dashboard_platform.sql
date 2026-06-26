-- TuLector dashboard + platform admin foundation

ALTER TABLE schools ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'inactive', 'deleted'));
ALTER TABLE schools ADD COLUMN IF NOT EXISTS branding_logo_url TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS branding_primary_color TEXT DEFAULT '#111827';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS email_signature TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS report_template TEXT DEFAULT 'standard';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Santiago';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'dd/MM/yyyy';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS scan_prefs JSONB DEFAULT '{}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS duplicated_from UUID REFERENCES quizzes(id);
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
UPDATE quizzes SET created_by = user_id WHERE created_by IS NULL;

ALTER TABLE papers ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'void', 'manual_review', 'corrected'));
ALTER TABLE papers ADD COLUMN IF NOT EXISTS corrected_answers JSONB DEFAULT '[]';
ALTER TABLE papers ADD COLUMN IF NOT EXISTS corrected_by UUID REFERENCES auth.users(id);
ALTER TABLE papers ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ;
ALTER TABLE papers ADD COLUMN IF NOT EXISTS storage_path TEXT;

ALTER TABLE students ADD COLUMN IF NOT EXISTS course TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS rut TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale TEXT DEFAULT 'es-CL' CHECK (locale IN ('es-CL', 'en', 'pt-BR')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'teacher' CHECK (role IN ('admin', 'teacher', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  token_hash TEXT,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'school', 'district')),
  status TEXT DEFAULT 'trialing',
  currency TEXT DEFAULT 'clp',
  amount_cents INT DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_invoice_id TEXT,
  type TEXT NOT NULL CHECK (type IN ('plan', 'scan_pack')),
  status TEXT DEFAULT 'pending',
  scans_added INT DEFAULT 0,
  amount_cents INT DEFAULT 0,
  currency TEXT DEFAULT 'clp',
  invoice_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS export_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  export_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  reason TEXT,
  row_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'support', 'finance', 'marketing')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_user_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  target_type TEXT,
  target_id TEXT,
  action TEXT NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  min_plan TEXT DEFAULT 'starter',
  config JSONB DEFAULT '{}',
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  locale TEXT DEFAULT 'es-CL',
  subject TEXT NOT NULL,
  html TEXT NOT NULL,
  text TEXT,
  consent_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_id UUID REFERENCES email_templates(id),
  segment JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'closed')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  locale TEXT DEFAULT 'es-CL',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS export_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID REFERENCES schools(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'delete', 'export', 'rectify')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_school ON invitations(school_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_school ON subscriptions(school_id);
CREATE INDEX IF NOT EXISTS idx_orders_school ON orders(school_id);
CREATE INDEX IF NOT EXISTS idx_export_logs_school ON export_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_school ON audit_log(school_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON support_tickets(school_id, status);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_requests ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_school_member(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM school_members WHERE school_id = p_school_id AND user_id = auth.uid());
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_school_admin(p_school_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM school_members WHERE school_id = p_school_id AND user_id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_platform_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND revoked_at IS NULL);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM platform_users WHERE user_id = auth.uid() AND role = 'platform_admin' AND revoked_at IS NULL);
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP POLICY IF EXISTS "profiles_owner" ON profiles;
CREATE POLICY "profiles_owner" ON profiles FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "invitations_admin" ON invitations;
CREATE POLICY "invitations_admin" ON invitations FOR ALL USING (is_school_admin(school_id)) WITH CHECK (is_school_admin(school_id));

DROP POLICY IF EXISTS "subscriptions_school_read" ON subscriptions;
CREATE POLICY "subscriptions_school_read" ON subscriptions FOR SELECT USING (is_school_member(school_id) OR is_platform_staff());

DROP POLICY IF EXISTS "orders_school_read" ON orders;
CREATE POLICY "orders_school_read" ON orders FOR SELECT USING (is_school_member(school_id) OR is_platform_staff());

DROP POLICY IF EXISTS "export_logs_admin" ON export_logs;
CREATE POLICY "export_logs_admin" ON export_logs FOR ALL USING (is_school_admin(school_id) OR is_platform_staff()) WITH CHECK (is_school_admin(school_id) OR is_platform_staff());

DROP POLICY IF EXISTS "notifications_user" ON notifications;
CREATE POLICY "notifications_user" ON notifications FOR ALL USING (user_id = auth.uid() OR is_school_admin(school_id)) WITH CHECK (is_school_admin(school_id));

DROP POLICY IF EXISTS "platform_users_platform_admin" ON platform_users;
CREATE POLICY "platform_users_platform_admin" ON platform_users FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "audit_log_platform" ON audit_log;
CREATE POLICY "audit_log_platform" ON audit_log FOR SELECT USING (is_platform_staff());
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (actor_user_id = auth.uid() OR is_platform_staff());

DROP POLICY IF EXISTS "feature_flags_read" ON feature_flags;
CREATE POLICY "feature_flags_read" ON feature_flags FOR SELECT USING (true);
DROP POLICY IF EXISTS "feature_flags_admin" ON feature_flags;
CREATE POLICY "feature_flags_admin" ON feature_flags FOR ALL USING (is_platform_admin()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "email_templates_staff" ON email_templates;
CREATE POLICY "email_templates_staff" ON email_templates FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_admin());
DROP POLICY IF EXISTS "email_campaigns_staff" ON email_campaigns;
CREATE POLICY "email_campaigns_staff" ON email_campaigns FOR ALL USING (is_platform_staff()) WITH CHECK (is_platform_admin());

DROP POLICY IF EXISTS "support_tickets_school_staff" ON support_tickets;
CREATE POLICY "support_tickets_school_staff" ON support_tickets FOR ALL USING ((school_id IS NOT NULL AND is_school_member(school_id)) OR is_platform_staff()) WITH CHECK ((school_id IS NOT NULL AND is_school_member(school_id)) OR is_platform_staff());

DROP POLICY IF EXISTS "export_requests_admin_staff" ON export_requests;
CREATE POLICY "export_requests_admin_staff" ON export_requests FOR ALL USING ((school_id IS NOT NULL AND is_school_admin(school_id)) OR is_platform_staff()) WITH CHECK ((school_id IS NOT NULL AND is_school_admin(school_id)) OR is_platform_staff());

INSERT INTO feature_flags (key, description, enabled, min_plan, config)
VALUES
  ('combination_answers', 'Permite respuestas combinadas en hojas OMR.', false, 'pro', '{}'),
  ('omr_classifier_v2', 'Publica pesos versionados del clasificador OMR.', false, 'school', '{"version":"manual-baseline"}'),
  ('br_market_beta', 'Activa textos y tablas iniciales para Brasil.', true, 'starter', '{}')
ON CONFLICT (key) DO NOTHING;
