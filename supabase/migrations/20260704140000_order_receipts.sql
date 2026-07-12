-- Campos necesarios para comprobantes de compra tipo ecommerce.
-- receipt_seq: secuencia interna para numerar comprobantes de forma legible (TL-000123).
-- gateway / gateway_payment_id: identifican la pasarela real que aprobo el pago.
-- receipt_sent_at: evita reenviar el comprobante mas de una vez (idempotencia de notificaciones).
-- billing_period_start/end: vigencia cubierta por la compra (mensual o anual).
-- failed_at: marca cuando un pago fue rechazado o anulado por la pasarela.

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_seq BIGSERIAL;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gateway TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS gateway_payment_id TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS receipt_sent_at TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_period_start TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS billing_period_end TIMESTAMPTZ;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_gateway_payment_id ON public.orders (gateway_payment_id);
