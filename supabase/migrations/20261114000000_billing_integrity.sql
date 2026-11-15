-- Apply before deploying billing code. All financial mutations are service-role only.
-- Duplicate subscriptions/payment references must be reconciled, never silently deleted.
BEGIN;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS plan_code text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS entitlement_snapshot jsonb;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refund_reference text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS source_order_id uuid REFERENCES public.orders(id);

UPDATE public.orders SET plan_code = CASE WHEN scans_added >= 10000 THEN 'school' ELSE 'pro' END
WHERE type = 'plan' AND plan_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_one_per_school ON public.subscriptions(school_id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_gateway_payment_unique
ON public.orders(gateway, gateway_payment_id) WHERE gateway_payment_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS orders_refund_reference_unique
ON public.orders(gateway, refund_reference) WHERE refund_reference IS NOT NULL;

CREATE OR REPLACE FUNCTION public.apply_paid_order(
  p_order_id uuid, p_amount_cents bigint, p_currency text, p_gateway text, p_payment_id text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  s public.schools%ROWTYPE;
  sub public.subscriptions%ROWTYPE;
  target_plan text;
  period_start timestamptz := now();
  period_end timestamptz;
  remaining integer := 0;
BEGIN
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF p_amount_cents IS NULL OR p_amount_cents <= 0 OR o.amount_cents IS DISTINCT FROM p_amount_cents
    OR nullif(trim(p_currency), '') IS NULL OR lower(o.currency) IS DISTINCT FROM lower(p_currency)
    OR p_gateway IS NULL OR p_gateway NOT IN ('flow', 'dlocal', 'mercadopago')
    OR nullif(trim(p_payment_id), '') IS NULL THEN
    RAISE EXCEPTION 'Monto, moneda o referencia de pago invalidos';
  END IF;
  IF o.gateway IS NOT NULL AND o.gateway <> p_gateway THEN
    RAISE EXCEPTION 'La pasarela no coincide con la orden';
  END IF;
  IF o.gateway_payment_id IS NOT NULL AND o.gateway_payment_id <> p_payment_id THEN
    RAISE EXCEPTION 'La orden ya tiene otro pago asociado';
  END IF;
  IF p_gateway IN ('flow', 'dlocal') AND o.stripe_checkout_session_id IS NOT NULL
    AND o.stripe_checkout_session_id <> p_payment_id THEN
    RAISE EXCEPTION 'La sesion de pago no coincide con la orden';
  END IF;

  SELECT * INTO s FROM schools WHERE id = o.school_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colegio no encontrado'; END IF;
  target_plan := CASE WHEN o.type = 'plan' THEN o.plan_code ELSE s.plan END;
  IF o.status = 'paid' THEN
    RETURN jsonb_build_object('alreadyProcessed', true, 'order', to_jsonb(o),
      'school', to_jsonb(s), 'extraScans', o.scans_added, 'targetPlan', target_plan);
  END IF;
  IF o.status <> 'pending' THEN RAISE EXCEPTION 'La orden no esta pendiente'; END IF;
  IF o.scans_added IS NULL OR o.scans_added <= 0 THEN RAISE EXCEPTION 'Cuota invalida'; END IF;
  SELECT * INTO sub FROM subscriptions WHERE school_id = s.id FOR UPDATE;
  IF o.type = 'plan' THEN
    IF target_plan NOT IN ('pro', 'school') OR target_plan IS NULL THEN
      RAISE EXCEPTION 'Plan invalido';
    END IF;
    -- Same-plan renewal preserves unused readings and the paid-through date.
    -- A different plan starts immediately; downgrades are blocked at checkout.
    IF sub.status = 'active' AND sub.current_period_end > now() AND sub.plan = target_plan THEN
      period_end := sub.current_period_end + interval '1 year';
      remaining := greatest(0, coalesce(s.scans_limit, 0) - coalesce(s.scans_used, 0));
    ELSE
      period_end := period_start + interval '1 year';
    END IF;
  END IF;

  UPDATE orders SET status = 'paid', paid_at = now(), gateway = p_gateway,
    gateway_payment_id = p_payment_id, billing_period_start = period_start,
    billing_period_end = period_end,
    entitlement_snapshot = jsonb_build_object('school', to_jsonb(s), 'subscription', to_jsonb(sub))
  WHERE id = o.id RETURNING * INTO o;

  IF o.type = 'plan' THEN
    UPDATE schools SET plan = target_plan, scans_limit = o.scans_added + remaining,
      scans_used = 0, updated_at = now() WHERE id = s.id RETURNING * INTO s;
    INSERT INTO subscriptions(school_id, plan, status, currency, amount_cents,
      current_period_start, current_period_end, source_order_id, updated_at)
    VALUES(s.id, target_plan, 'active', o.currency, o.amount_cents,
      period_start, period_end, o.id, now())
    ON CONFLICT(school_id) DO UPDATE SET plan = excluded.plan, status = 'active',
      currency = excluded.currency, amount_cents = excluded.amount_cents,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end, source_order_id = excluded.source_order_id,
      updated_at = now();
  ELSE
    UPDATE schools SET scans_limit = coalesce(scans_limit, 0) + o.scans_added, updated_at = now()
    WHERE id = s.id RETURNING * INTO s;
  END IF;
  -- This is a completion record, never a lock that can swallow an unsuccessful attempt.
  INSERT INTO webhook_events(event_id, gateway) VALUES(p_gateway || '_' || p_payment_id, p_gateway)
  ON CONFLICT(event_id) DO NOTHING;
  RETURN jsonb_build_object('alreadyProcessed', false, 'order', to_jsonb(o),
    'school', to_jsonb(s), 'extraScans', o.scans_added, 'targetPlan', target_plan);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_school_plan(
  p_school_id uuid, p_plan text, p_actor uuid, p_reason text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.schools%ROWTYPE;
  sub public.subscriptions%ROWTYPE;
  staff_role text;
BEGIN
  SELECT role INTO staff_role FROM platform_users WHERE user_id = p_actor AND revoked_at IS NULL;
  IF staff_role IS NULL OR staff_role NOT IN ('platform_admin', 'finance') THEN
    RAISE EXCEPTION 'Sin permiso para cambiar planes';
  END IF;
  IF p_plan NOT IN ('starter', 'pro', 'school') OR p_plan IS NULL OR length(trim(p_reason)) < 3
    OR p_reason IS NULL THEN RAISE EXCEPTION 'Plan y motivo obligatorios'; END IF;
  SELECT * INTO s FROM schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Colegio no encontrado'; END IF;
  SELECT * INTO sub FROM subscriptions WHERE school_id = s.id FOR UPDATE;
  -- Saving the current plan is not a quota reset or renewal.
  IF s.plan = p_plan AND ((p_plan = 'starter' AND (sub.id IS NULL OR sub.status <> 'active')) OR
    (sub.plan = p_plan AND sub.status = 'active' AND sub.current_period_end > now())) THEN RETURN; END IF;
  UPDATE schools SET plan = p_plan,
    scans_limit = CASE p_plan WHEN 'school' THEN 10000 WHEN 'pro' THEN 2000 ELSE 100 END,
    updated_at = now() WHERE id = s.id;
  IF p_plan = 'starter' THEN
    UPDATE subscriptions SET status = 'canceled', current_period_end = now(),
      source_order_id = NULL, updated_at = now() WHERE school_id = s.id;
  ELSE
    INSERT INTO subscriptions(school_id, plan, status, current_period_start, current_period_end, source_order_id)
    VALUES(s.id, p_plan, 'active', now(), now() + interval '1 year', NULL)
    ON CONFLICT(school_id) DO UPDATE SET plan = excluded.plan, status = 'active',
      current_period_start = now(),
      current_period_end = CASE WHEN subscriptions.status = 'active' AND subscriptions.current_period_end > now()
        THEN subscriptions.current_period_end ELSE now() + interval '1 year' END,
      source_order_id = NULL, updated_at = now();
  END IF;
  INSERT INTO audit_log(actor_user_id, actor_role, school_id, target_type, target_id, action, reason, metadata)
  VALUES(p_actor, staff_role, s.id, 'school', s.id::text, 'school.plan_update', trim(p_reason),
    jsonb_build_object('previous_plan', s.plan, 'plan', p_plan, 'scans_used_preserved', s.scans_used));
END;
$$;

-- This records a refund ALREADY performed in the provider dashboard. It never moves money.
-- The UI requires a provider reference and explicit confirmation; "void" is not a refund.
CREATE OR REPLACE FUNCTION public.record_external_refund(
  p_order_id uuid, p_actor uuid, p_reason text, p_reference text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  o public.orders%ROWTYPE;
  s public.schools%ROWTYPE;
  sub public.subscriptions%ROWTYPE;
  previous_sub jsonb;
  previous_school jsonb;
  staff_role text;
  restored_plan text := 'starter';
BEGIN
  SELECT role INTO staff_role FROM platform_users WHERE user_id = p_actor AND revoked_at IS NULL;
  IF staff_role IS NULL OR staff_role NOT IN ('platform_admin', 'finance') THEN
    RAISE EXCEPTION 'Sin permiso para registrar reembolsos';
  END IF;
  IF p_reason IS NULL OR length(trim(p_reason)) < 3 OR p_reference IS NULL OR length(trim(p_reference)) < 3 THEN
    RAISE EXCEPTION 'Motivo y referencia de devolucion obligatorios';
  END IF;
  SELECT * INTO o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Orden no encontrada'; END IF;
  IF o.status = 'refunded' AND o.refund_reference = trim(p_reference) THEN RETURN; END IF;
  IF o.status <> 'paid' THEN RAISE EXCEPTION 'Solo se registran devoluciones de pagos confirmados'; END IF;
  SELECT * INTO s FROM schools WHERE id = o.school_id FOR UPDATE;
  SELECT * INTO sub FROM subscriptions WHERE school_id = s.id FOR UPDATE;
  previous_sub := o.entitlement_snapshot -> 'subscription';
  previous_school := o.entitlement_snapshot -> 'school';
  IF o.type = 'plan' AND sub.source_order_id = o.id THEN
    IF previous_sub ->> 'status' = 'active'
      AND (previous_sub ->> 'current_period_end')::timestamptz > now()
      AND (previous_sub ->> 'source_order_id' IS NULL OR EXISTS (
        SELECT 1 FROM orders WHERE id = (previous_sub ->> 'source_order_id')::uuid AND status = 'paid'
      )) THEN
      restored_plan := previous_sub ->> 'plan';
      UPDATE subscriptions SET plan = restored_plan, status = 'active',
        amount_cents = (previous_sub ->> 'amount_cents')::integer,
        currency = previous_sub ->> 'currency',
        current_period_start = (previous_sub ->> 'current_period_start')::timestamptz,
        current_period_end = (previous_sub ->> 'current_period_end')::timestamptz,
        source_order_id = (previous_sub ->> 'source_order_id')::uuid, updated_at = now()
      WHERE id = sub.id;
    ELSE
      UPDATE subscriptions SET status = 'canceled', current_period_end = now(),
        source_order_id = NULL, updated_at = now() WHERE id = sub.id;
    END IF;
    UPDATE schools SET plan = restored_plan,
      scans_limit = CASE WHEN restored_plan = 'starter' THEN 100
        ELSE coalesce((previous_school ->> 'scans_limit')::integer, 0) END,
      scans_used = coalesce((previous_school ->> 'scans_used')::integer, 0) + coalesce(s.scans_used, 0),
      updated_at = now() WHERE id = s.id;
  ELSE
    -- A historical refund must not cancel a more recent plan or a manual grant.
    -- Legacy orders lack a reliable snapshot: leave access unchanged for manual reconciliation.
    IF o.entitlement_snapshot IS NOT NULL THEN
      UPDATE schools SET scans_limit = greatest(0, coalesce(scans_limit, 0) - coalesce(o.scans_added, 0)),
        updated_at = now() WHERE id = s.id;
    END IF;
  END IF;
  UPDATE orders SET status = 'refunded', refund_reference = trim(p_reference), refunded_at = now() WHERE id = o.id;
  INSERT INTO audit_log(actor_user_id, actor_role, school_id, target_type, target_id, action, reason, metadata)
  VALUES(p_actor, staff_role, s.id, 'order', o.id::text, 'order.external_refund', trim(p_reason),
    jsonb_build_object('reference', trim(p_reference), 'amount_cents', o.amount_cents,
      'access_reconciliation_required', o.entitlement_snapshot IS NULL));
END;
$$;

-- Effective plan is enforced both by the server UI and the insert/quota functions.
CREATE OR REPLACE FUNCTION public.effective_school_scan_limit(p_school_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN s.plan IN ('pro', 'school') AND NOT EXISTS (
    SELECT 1 FROM subscriptions sub WHERE sub.school_id = s.id AND sub.status = 'active'
      AND sub.plan = s.plan AND sub.current_period_end > now()
  ) THEN least(coalesce(s.scans_limit, 100), 100) ELSE s.scans_limit END
  FROM schools s WHERE s.id = p_school_id;
$$;

CREATE OR REPLACE FUNCTION public.increment_school_scan_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.schools%ROWTYPE;
  current_limit integer;
BEGIN
  SELECT * INTO s FROM schools WHERE id = NEW.school_id FOR UPDATE;
  IF coalesce(s.status, 'active') <> 'active' THEN RAISE EXCEPTION 'school is not active'; END IF;
  current_limit := effective_school_scan_limit(s.id);
  IF current_limit IS NOT NULL AND coalesce(s.scans_used, 0) >= current_limit THEN
    RAISE EXCEPTION 'scan quota exceeded';
  END IF;
  UPDATE schools SET scans_used = coalesce(scans_used, 0) + 1, updated_at = now() WHERE id = s.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_scans_used(p_school_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.schools%ROWTYPE;
  current_limit integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM school_members WHERE school_id = p_school_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'school membership required';
  END IF;
  SELECT * INTO s FROM schools WHERE id = p_school_id FOR UPDATE;
  IF coalesce(s.status, 'active') <> 'active' THEN RAISE EXCEPTION 'school is not active'; END IF;
  current_limit := effective_school_scan_limit(s.id);
  IF current_limit IS NOT NULL AND coalesce(s.scans_used, 0) >= current_limit THEN
    RAISE EXCEPTION 'scan quota exceeded';
  END IF;
  UPDATE schools SET scans_used = coalesce(scans_used, 0) + 1, updated_at = now()
    WHERE id = s.id RETURNING scans_used INTO current_limit;
  RETURN current_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_paid_order(uuid,bigint,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_school_plan(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_external_refund(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.effective_school_scan_limit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paid_order(uuid,bigint,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_school_plan(uuid,text,uuid,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_external_refund(uuid,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.increment_scans_used(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_scans_used(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.billing_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $
  SELECT jsonb_build_object(
    'order_count', (SELECT count(*) FROM orders),
    'paid_count', (SELECT count(*) FROM orders WHERE status = 'paid'),
    'pending_count', (SELECT count(*) FROM orders WHERE status = 'pending'),
    'refunded_count', (SELECT count(*) FROM orders WHERE status = 'refunded'),
    'active_subscriptions', (SELECT count(*) FROM subscriptions
      WHERE status = 'active' AND current_period_end > now()),
    'revenue_by_currency', coalesce((SELECT jsonb_object_agg(currency, total) FROM (
      SELECT upper(currency) AS currency, sum(amount_cents)::numeric / 100 AS total
      FROM orders WHERE status = 'paid' GROUP BY upper(currency)
    ) amounts), '{}'::jsonb),
    'paid_by_gateway', coalesce((SELECT jsonb_object_agg(gateway, total) FROM (
      SELECT coalesce(gateway, 'sin_registrar') AS gateway, count(*) AS total
      FROM orders WHERE status = 'paid' GROUP BY coalesce(gateway, 'sin_registrar')
    ) gateways), '{}'::jsonb)
  );
$;
REVOKE ALL ON FUNCTION public.billing_summary() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_summary() TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
