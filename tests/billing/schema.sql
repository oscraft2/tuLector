-- Isolated fixture for the billing migration, never a production bootstrap.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  plan text DEFAULT 'starter', scans_limit integer DEFAULT 100, scans_used integer DEFAULT 0,
  country_code text DEFAULT 'CL', status text DEFAULT 'active', updated_at timestamptz DEFAULT now()
);
CREATE TABLE school_members (school_id uuid REFERENCES schools, user_id uuid, role text);
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools,
  type text NOT NULL, status text DEFAULT 'pending', scans_added integer, amount_cents integer,
  currency text, gateway text, gateway_payment_id text, stripe_checkout_session_id text UNIQUE,
  billing_details jsonb, receipt_seq bigserial, receipt_sent_at timestamptz,
  billing_period_start timestamptz, billing_period_end timestamptz,
  paid_at timestamptz, created_at timestamptz DEFAULT now()
);
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools,
  plan text NOT NULL CHECK(plan IN ('pro','school')), status text, currency text,
  amount_cents integer DEFAULT 0, current_period_start timestamptz, current_period_end timestamptz,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
CREATE TABLE platform_users (user_id uuid PRIMARY KEY, role text NOT NULL, revoked_at timestamptz);
CREATE TABLE audit_log (
  actor_user_id uuid, actor_role text, school_id uuid, target_type text, target_id text,
  action text, reason text, metadata jsonb
);
CREATE TABLE webhook_events(event_id text PRIMARY KEY, gateway text NOT NULL, processed_at timestamptz DEFAULT now());
CREATE TABLE papers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id uuid NOT NULL REFERENCES schools);
