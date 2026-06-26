import { test, expect } from "@playwright/test";

test.describe("TuLector school dashboard", () => {
  test("create quiz, import students, review mock scan and export", async ({ page }) => {
    await page.goto("/auth");
    // Requires seeded Supabase test user and storage bucket in CI.
    await test.step("login", async () => {
      await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL ?? "teacher@example.com");
      await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD ?? "password123");
      await page.getByRole("button", { name: /iniciar/i }).click();
    });
    await expect(page).toHaveURL(/dashboard/);
    await page.goto("/dashboard/quizzes");
    await page.getByLabel(/titulo/i).fill("E2E Matematica");
    await page.getByLabel(/clave/i).fill("ABCDEABCDEABCDEABCDE");
    await page.getByRole("button", { name: /crear ensayo/i }).click();
    await expect(page.getByText("E2E Matematica")).toBeVisible();
    await page.goto("/dashboard/students");
    await page.getByLabel(/importar csv/i).fill("rut,nombre,curso\n12345678-5,Ana Perez,IV Medio A");
    await page.getByRole("button", { name: /importar/i }).click();
    await expect(page.getByText("Ana Perez")).toBeVisible();
    await page.goto("/dashboard/papers");
    await page.goto("/dashboard/results/mock-quiz-id");
    await page.getByRole("button", { name: /exportacion/i }).click();
  });
});
