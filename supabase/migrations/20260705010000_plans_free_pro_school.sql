-- Canonical TuLector plans: Gratis (starter), Pro and School.
-- District is no longer a valid product plan. Existing district tenants are moved to School.

UPDATE public.schools
SET plan = 'school', updated_at = NOW()
WHERE plan = 'district';

ALTER TABLE public.schools
  ALTER COLUMN plan SET DEFAULT 'starter';

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_plan_check;

ALTER TABLE public.schools
  ADD CONSTRAINT schools_plan_check
  CHECK (plan IN ('starter', 'pro', 'school'));

UPDATE public.subscriptions
SET plan = 'school', updated_at = NOW()
WHERE plan = 'district';

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('pro', 'school'));