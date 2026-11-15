#!/usr/bin/env bash
set -euo pipefail
psql -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO schools(id,name) VALUES('00000000-0000-4000-8000-000000000010','Concurrent billing');
INSERT INTO orders(id,school_id,type,plan_code,status,scans_added,amount_cents,currency,gateway,stripe_checkout_session_id)
VALUES('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000010','plan','pro','pending',2000,1999000,'clp','flow','concurrent-1');
SQL
pids=()
for i in {1..8}; do
  psql -v ON_ERROR_STOP=1 -c "SELECT apply_paid_order('00000000-0000-4000-8000-000000000011',1999000,'clp','flow','concurrent-1');" > "/tmp/billing-replay-$i.log" &
  pids+=("$!")
done
for pid in "${pids[@]}"; do wait "$pid"; done
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT count(*) FROM subscriptions WHERE school_id='00000000-0000-4000-8000-000000000010') <> 1
    OR (SELECT scans_limit FROM schools WHERE id='00000000-0000-4000-8000-000000000010') <> 2000
    OR (SELECT count(*) FROM webhook_events) <> 1 THEN RAISE EXCEPTION 'concurrent replay applied more than once'; END IF;
END;
$$;
INSERT INTO orders(id,school_id,type,plan_code,status,scans_added,amount_cents,currency,gateway,stripe_checkout_session_id)
VALUES
('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000010','plan','pro','pending',2000,1999000,'clp','flow','concurrent-2'),
('00000000-0000-4000-8000-000000000013','00000000-0000-4000-8000-000000000010','plan','pro','pending',2000,1999000,'clp','flow','concurrent-3');
SQL
psql -v ON_ERROR_STOP=1 -c "SELECT apply_paid_order('00000000-0000-4000-8000-000000000012',1999000,'clp','flow','concurrent-2');" > /tmp/billing-renewal-1.log &
first_pid=$!
psql -v ON_ERROR_STOP=1 -c "SELECT apply_paid_order('00000000-0000-4000-8000-000000000013',1999000,'clp','flow','concurrent-3');" > /tmp/billing-renewal-2.log &
second_pid=$!
wait "$first_pid"
wait "$second_pid"
psql -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF (SELECT scans_limit FROM schools WHERE id='00000000-0000-4000-8000-000000000010') <> 6000
    OR (SELECT count(*) FROM subscriptions WHERE school_id='00000000-0000-4000-8000-000000000010') <> 1
    OR (SELECT count(*) FROM orders WHERE status='paid') <> 3
    OR (SELECT current_period_end FROM subscriptions WHERE school_id='00000000-0000-4000-8000-000000000010') < now() + interval '3 years' - interval '1 minute' THEN
    RAISE EXCEPTION 'concurrent renewals lost entitlement';
  END IF;
END;
$$;
SQL
