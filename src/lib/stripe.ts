import "server-only";

export function getStripeConfig() {
  return {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    configured: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
  };
}

export function assertStripeConfigured() {
  const config = getStripeConfig();
  if (!config.configured) throw new Error("Stripe no esta configurado. Define STRIPE_SECRET_KEY y STRIPE_WEBHOOK_SECRET en entorno server-side.");
  return config;
}
