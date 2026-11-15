\set ON_ERROR_STOP on
BEGIN;
CREATE TRIGGER on_paper_insert_increment_scan_usage AFTER INSERT ON papers
FOR EACH ROW EXECUTE FUNCTION increment_school_scan_usage();
CREATE FUNCTION billing_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('billing.test_failure', true) = 'true' THEN RAISE EXCEPTION 'injected failure'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER billing_failure BEFORE INSERT OR UPDATE ON subscriptions
FOR EACH ROW EXECUTE FUNCTION billing_test_failure();

DO $$
DECLARE
  v_school_id uuid := '00000000-0000-4000-8000-000000000001';
  v_actor_id uuid := '00000000-0000-4000-8000-000000000002';
  v_first_order uuid := '00000000-0000-4000-8000-000000000003';
  v_second_order uuid := '00000000-0000-4000-8000-000000000004';
  result jsonb;
  old_end timestamptz;
  count_before integer;
BEGIN
  INSERT INTO schools(id,name) VALUES(v_school_id,'Billing test');
  INSERT INTO platform_users(user_id,role) VALUES(v_actor_id,'finance');
  INSERT INTO orders(id,school_id,type,plan_code,status,scans_added,amount_cents,currency,gateway,stripe_checkout_session_id)
  VALUES(v_first_order,v_school_id,'plan','pro','pending',2000,1999000,'clp','flow','token-1');
  -- A database failure AFTER the order update must roll the financial transaction back.
  PERFORM set_config('billing.test_failure','true',true);
  BEGIN
    PERFORM apply_paid_order(v_first_order,1999000,'clp','flow','token-1');
    RAISE EXCEPTION 'expected injected failure';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'injected failure' THEN RAISE; END IF;
  END;
  IF (SELECT status FROM orders WHERE id=v_first_order) <> 'pending'
    OR (SELECT plan FROM schools WHERE id=v_school_id) <> 'starter'
    OR EXISTS(SELECT 1 FROM webhook_events) THEN RAISE EXCEPTION 'partial payment commit'; END IF;
  PERFORM set_config('billing.test_failure','false',true);
  -- A later verified success may recover an earlier authoritative rejection.
  UPDATE orders SET status='failed' WHERE id=v_first_order;
  result := apply_paid_order(v_first_order,1999000,'CLP','flow','token-1');
  IF (result->>'alreadyProcessed')::boolean THEN RAISE EXCEPTION 'retry was swallowed'; END IF;
  IF (SELECT scans_limit FROM schools WHERE id=v_school_id) <> 2000 THEN RAISE EXCEPTION 'wrong quota'; END IF;
  SELECT current_period_end INTO old_end FROM subscriptions WHERE school_id=v_school_id;
  IF old_end <> (SELECT billing_period_end FROM orders WHERE id=v_first_order) THEN
    RAISE EXCEPTION 'order/subscription period mismatch';
  END IF;
  UPDATE schools SET scans_used=37 WHERE id=v_school_id;
  result := apply_paid_order(v_first_order,1999000,'clp','flow','token-1');
  IF NOT (result->>'alreadyProcessed')::boolean OR (SELECT scans_used FROM schools WHERE id=v_school_id) <> 37 THEN
    RAISE EXCEPTION 'duplicate callback reset quota';
  END IF;
  -- Invalid verified amounts/currencies/sessions must not be accepted even on replay.
  BEGIN
    PERFORM apply_paid_order(v_first_order,1,'clp','flow','token-1');
    RAISE EXCEPTION 'amount accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'amount accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM apply_paid_order(v_first_order,1999000,'usd','flow','token-1');
    RAISE EXCEPTION 'currency accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'currency accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM apply_paid_order(v_first_order,1999000,'clp','flow','different-token');
    RAISE EXCEPTION 'foreign token accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'foreign token accepted' THEN RAISE; END IF; END;

  INSERT INTO orders(id,school_id,type,plan_code,status,scans_added,amount_cents,currency,gateway,stripe_checkout_session_id)
  VALUES(v_second_order,v_school_id,'plan','pro','pending',2000,1999000,'clp','flow','token-2');
  PERFORM apply_paid_order(v_second_order,1999000,'clp','flow','token-2');
  IF (SELECT scans_limit FROM schools WHERE id=v_school_id) <> 3963
    OR (SELECT current_period_end FROM subscriptions WHERE school_id=v_school_id) <> old_end + interval '1 year' THEN
    RAISE EXCEPTION 'renewal lost remaining readings or time';
  END IF;
  UPDATE schools SET scans_used=12 WHERE id=v_school_id;
  PERFORM set_school_plan(v_school_id,'pro',v_actor_id,'same plan');
  IF (SELECT scans_used FROM schools WHERE id=v_school_id) <> 12 THEN RAISE EXCEPTION 'manual save reset usage'; END IF;

  PERFORM record_external_refund(v_first_order,v_actor_id,'external refund','provider-ref-1');
  IF (SELECT source_order_id FROM subscriptions WHERE school_id=v_school_id) <> v_second_order
    OR (SELECT plan FROM schools WHERE id=v_school_id) <> 'pro' THEN
    RAISE EXCEPTION 'historical refund canceled newer plan';
  END IF;
  PERFORM record_external_refund(v_first_order,v_actor_id,'external refund','provider-ref-1');
  IF (SELECT scans_limit FROM schools WHERE id=v_school_id) <> 3963
    OR NOT (SELECT refund_access_review_required FROM orders WHERE id=v_first_order) THEN
    RAISE EXCEPTION 'historical refund altered a newer allowance or missed review flag'; END IF;
  PERFORM record_external_refund(v_second_order,v_actor_id,'external refund','provider-ref-2');
  IF (SELECT plan FROM schools WHERE id=v_school_id) <> 'starter' THEN
    RAISE EXCEPTION 'refund resurrected a refunded plan';
  END IF;

  PERFORM set_school_plan(v_school_id,'pro',v_actor_id,'manual grant');
  UPDATE subscriptions SET current_period_end=now()-interval '1 second' WHERE school_id=v_school_id;
  UPDATE schools SET scans_used=100 WHERE id=v_school_id;
  BEGIN
    INSERT INTO papers(school_id) VALUES(v_school_id);
    RAISE EXCEPTION 'expired premium quota accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'expired premium quota accepted' THEN RAISE; END IF; END;
  UPDATE schools SET scans_used=99 WHERE id=v_school_id;
  INSERT INTO papers(school_id) VALUES(v_school_id);
  IF (SELECT scans_used FROM schools WHERE id=v_school_id) <> 100 THEN RAISE EXCEPTION 'wrong free quota'; END IF;
  UPDATE schools SET status='paused', scans_used=0 WHERE id=v_school_id;
  BEGIN
    INSERT INTO papers(school_id) VALUES(v_school_id);
    RAISE EXCEPTION 'paused school accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM = 'paused school accepted' THEN RAISE; END IF; END;

  IF has_function_privilege('authenticated','apply_paid_order(uuid,bigint,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','record_external_refund(uuid,uuid,text,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','apply_paid_order(uuid,bigint,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'financial RPC privileges are incorrect';
  END IF;
  IF (billing_summary()->>'refunded_count')::integer <> 2 THEN RAISE EXCEPTION 'wrong financial totals'; END IF;
END;
$$;
ROLLBACK;
