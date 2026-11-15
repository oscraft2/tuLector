export type BillingSubscription = {
  plan: string;
  status: string | null;
  current_period_end: string | null;
};

export function hasActiveSubscription(
  plan: string | null | undefined,
  subscription: BillingSubscription | null | undefined,
  now = Date.now(),
): boolean {
  const end = Date.parse(subscription?.current_period_end ?? "");
  return (plan === "pro" || plan === "school")
    && subscription?.plan === plan
    && subscription.status === "active"
    && Number.isFinite(end) && end > now;
}

export function effectiveEntitlement(
  school: { plan: string; scans_limit: number | null },
  subscription: BillingSubscription | null | undefined,
  now = Date.now(),
): { plan: "starter" | "pro" | "school"; scans_limit: number | null } {
  if (hasActiveSubscription(school.plan, subscription, now)) {
    return { plan: school.plan as "pro" | "school", scans_limit: school.scans_limit };
  }
  return { plan: "starter", scans_limit: Math.min(school.scans_limit ?? 100, 100) };
}
