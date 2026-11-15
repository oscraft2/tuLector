import { afterEach, test, mock } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createFlowPayment, getFlowPaymentStatus, signFlowParameters } from "./flow";

const savedEnv = { ...process.env };
afterEach(() => { mock.restoreAll(); process.env = { ...savedEnv }; });

test("Flow signs the official canonical string, in alphabetical order, without URL separators", () => {
  const expected = createHmac("sha256", "test-secret")
    .update("amount5000apiKeyXXXX-XXXX-XXXXcurrencyCLP").digest("hex");
  assert.equal(signFlowParameters({ currency: "CLP", apiKey: "XXXX-XXXX-XXXX", amount: 5000 }, "test-secret"), expected);
  assert.equal(signFlowParameters({ amount: 5000, apiKey: "XXXX-XXXX-XXXX", currency: "CLP", s: "ignored" }, "test-secret"), expected);
});

test("real checkout sends a valid signature and uses the provider redirect", async () => {
  process.env.FLOW_API_KEY = "test-key";
  process.env.FLOW_SECRET_KEY = "test-secret";
  process.env.FLOW_SANDBOX = "true";
  mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://sandbox.flow.cl/api/payment/create");
    const body = new URLSearchParams(String(init?.body));
    const canonical = "amount99990apiKeytest-keycommerceOrderorder-1currencyCLPemailtest@example.com"
      + "subjectSchool & testurlConfirmationhttps://example.com/confirmurlReturnhttps://example.com/return";
    assert.equal(body.get("s"), createHmac("sha256", "test-secret").update(canonical).digest("hex"));
    assert.equal(body.get("amount"), "99990");
    return Response.json({ url: "https://sandbox.flow.cl/pay", token: "token-1" });
  });
  const result = await createFlowPayment({ amount: 99990, email: "test@example.com", subject: "School & test",
    commerceOrder: "order-1", urlConfirmation: "https://example.com/confirm", urlReturn: "https://example.com/return" });
  assert.equal(result.url, "https://sandbox.flow.cl/pay?token=token-1");
});

test("payment verification returns actual currency and propagates transient failures", async () => {
  process.env.FLOW_API_KEY = "test-key";
  process.env.FLOW_SECRET_KEY = "test-secret";
  process.env.FLOW_SANDBOX = "false";
  let attempts = 0;
  mock.method(globalThis, "fetch", async (raw: string | URL | Request) => {
    const url = new URL(String(raw));
    assert.equal(url.searchParams.get("s"), createHmac("sha256", "test-secret")
      .update("apiKeytest-keytokentoken-1").digest("hex"));
    if (++attempts === 1) throw new Error("temporary network failure");
    return Response.json({ status: 2, amount: 19990, currency: "CLP", commerceOrder: "order-1" });
  });
  await assert.rejects(() => getFlowPaymentStatus("token-1"), /temporary network failure/);
  const paid = await getFlowPaymentStatus("token-1");
  assert.equal(paid.currency, "clp");
  assert.equal(paid.commerceOrder, "order-1");
});

test("production fails closed when Flow credentials are absent", async () => {
  process.env.NODE_ENV = "production";
  delete process.env.FLOW_API_KEY;
  delete process.env.FLOW_SECRET_KEY;
  await assert.rejects(() => getFlowPaymentStatus("mock_flow_token_1"), /no esta configurado/);
});
