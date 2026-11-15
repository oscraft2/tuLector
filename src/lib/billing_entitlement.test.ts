import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveEntitlement, hasActiveSubscription } from "./billing_entitlement";

const now = Date.parse("2026-11-14T12:00:00Z");
const active = { plan: "pro", status: "active", current_period_end: "2027-11-14T12:00:00Z" };
test("only a matching, active and unexpired subscription grants premium features", () => {
  assert.equal(hasActiveSubscription("pro", active, now), true);
  for (const subscription of [null, { ...active, plan: "school" }, { ...active, status: "canceled" },
    { ...active, current_period_end: "invalid" }, { ...active, current_period_end: "2026-11-14T12:00:00Z" }]) {
    assert.deepEqual(effectiveEntitlement({ plan: "pro", scans_limit: 2000 }, subscription, now),
      { plan: "starter", scans_limit: 100 });
  }
});
test("active subscriptions retain purchased readings; expiry never increases the free quota", () => {
  assert.deepEqual(effectiveEntitlement({ plan: "pro", scans_limit: 3500 }, active, now),
    { plan: "pro", scans_limit: 3500 });
  assert.deepEqual(effectiveEntitlement({ plan: "starter", scans_limit: 0 }, null, now),
    { plan: "starter", scans_limit: 0 });
});
