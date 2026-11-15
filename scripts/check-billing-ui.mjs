import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdir, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { build } from "esbuild";
import { chromium } from "playwright";

// Render the real checkout component with synthetic account data and the compiled app CSS.
// All checkout requests are intercepted; this script cannot create payments.
const cwd = process.cwd();
const output = join(cwd, "artifacts", "billing-ui");
await mkdir(output, { recursive: true });
async function cssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const groups = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? cssFiles(join(dir, entry.name)) : entry.name.endsWith(".css") ? [join(dir, entry.name)] : []));
  return groups.flat();
}
const css = (await Promise.all((await cssFiles(join(cwd, ".next", "static"))).map((file) => readFile(file, "utf8")))).join("\n");
const client = 'import React from "react"; import {createRoot} from "react-dom/client"; import {BillingCheckoutPanel} from "./src/components/dashboard/BillingCheckoutPanel"; createRoot(document.getElementById("checkout")).render(React.createElement(BillingCheckoutPanel, window.billingFixture));';
const bundle = await build({ stdin: { contents: client, resolveDir: cwd, loader: "tsx" },
  bundle: true, platform: "browser", write: false, minify: true,
  define: { "process.env.NODE_ENV": '"production"' } });
const cl = {
  schoolName: "Cuenta de demostración", countryCode: "CL", currentPlan: "starter",
  isAdmin: true, paymentsReady: true,
  items: [
    { id: "pro", type: "plan", plan: "pro", title: "Pro", subtitle: "2.000 lecturas al año", scansAdded: 2000, amountCents: 1999000, currency: "clp" },
    { id: "school", type: "plan", plan: "school", title: "School", subtitle: "10.000 lecturas al año y trabajo en equipo", scansAdded: 10000, amountCents: 9999000, currency: "clp" },
  ],
  communes: [
    { commune: "SANTIAGO", regionCode: "13", regionName: "Metropolitana de Santiago" },
    { commune: "VALPARAISO", regionCode: "05", regionName: "Valparaíso" },
  ],
};
const fixtures = {
  cl, school: { ...cl, currentPlan: "school" }, readonly: { ...cl, isAdmin: false },
  unavailable: { ...cl, paymentsReady: false },
  mx: { ...cl, countryCode: "MX", communes: [], items: cl.items.map((item) => ({
    ...item, currency: "mxn", amountCents: item.plan === "pro" ? 49000 : 249000,
  })) },
};
const server = createServer((request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/preview.js") {
    response.writeHead(200, { "Content-Type": "text/javascript" });
    response.end(bundle.outputFiles[0].contents);
    return;
  }
  const fixture = fixtures[pathname.slice(1)];
  if (!fixture) { response.writeHead(404); response.end(); return; }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end([
    '<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1">',
    "<style>", css,
    "body{margin:0;background:#fafafa}main{max-width:1040px;margin:auto;padding:36px 24px}@media(max-width:600px){main{padding:24px 20px}}",
    '</style></head><body><main><header class="mb-7"><h1 class="text-2xl font-semibold tracking-tight text-[#20242b] sm:text-3xl">Plan y pagos</h1>',
    '<p class="mt-2 text-sm leading-6 text-[#676e78]">Consulta tus lecturas y administra tu plan.</p></header><div id="checkout"></div></main>',
    "<script>window.billingFixture=", JSON.stringify(fixture), ';</script><script src="/preview.js"></script></body></html>',
  ].join(""));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const base = "http://127.0.0.1:" + address.port;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const requests = [];
try {
  await page.route("**/api/billing/checkout", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Pago de prueba no disponible." }) });
  });
  await page.goto(base + "/cl");
  await page.getByLabel("Nombre o razón social").waitFor();
  await page.screenshot({ path: join(output, "checkout-desktop.png"), fullPage: true });
  await page.getByRole("radio", { name: /School/ }).check();
  assert.match(await page.getByRole("complementary", { name: "Resumen de compra" }).innerText(), /99.990/);
  await page.getByLabel("Dirección", { exact: true }).fill("Dirección de prueba 123");
  await page.getByLabel("Región", { exact: true }).selectOption("13");
  await page.getByLabel("Comuna", { exact: true }).selectOption("SANTIAGO");
  await page.getByRole("button", { name: "Continuar a Flow", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(requests[0].plan, "school");
  assert.equal(requests[0].billingDetails.commune, "SANTIAGO");
  assert.equal(await page.getByRole("button", { name: "Continuar a Flow", exact: true }).isEnabled(), true);
  await page.getByLabel("Región", { exact: true }).selectOption("05");
  assert.equal(await page.getByLabel("Comuna", { exact: true }).inputValue(), "");

  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(base + "/cl");
  await page.getByLabel("Nombre o razón social").waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, "mobile horizontal overflow");
  await page.getByRole("radio", { name: /Pro/ }).focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.getByRole("radio", { name: /School/ }).isChecked(), true);
  await page.screenshot({ path: join(output, "checkout-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1080 });
  await page.goto(base + "/mx");
  await page.getByLabel("Nombre o razón social").waitFor();
  assert.equal(await page.getByLabel("Región", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Comuna", { exact: true }).count(), 0);
  await page.screenshot({ path: join(output, "checkout-dlocal.png"), fullPage: true });
  await page.getByRole("button", { name: "Continuar a dLocal", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(requests.at(-1).plan, "pro");

  await page.goto(base + "/school");
  await page.getByRole("radio", { name: /School/ }).waitFor();
  assert.equal(await page.getByRole("radio", { name: /School/ }).isChecked(), true);
  assert.equal(await page.getByRole("radio", { name: /Pro/ }).isDisabled(), true);
  await page.goto(base + "/readonly");
  assert.equal(await page.getByRole("button", { name: "Continuar a Flow", exact: true }).isDisabled(), true);
  await page.goto(base + "/unavailable");
  assert.equal(await page.getByRole("button", { name: "Continuar a Flow", exact: true }).isDisabled(), true);
  console.log("Billing UI passed: desktop/mobile layout, keyboard, totals, field dependencies, error recovery, dLocal and access states.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
