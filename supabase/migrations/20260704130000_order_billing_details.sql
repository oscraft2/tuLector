ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS billing_details jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_billing_details_object;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_billing_details_object
  CHECK (jsonb_typeof(billing_details) = 'object');
