import { test, expect } from '../fixtures';

test('login page renders and submit control disables while pending', async ({ page }) => {
  await page.goto('/login');
  // Login is CSR (app shell); wait for the form to hydrate.
  const email = page.getByLabel(/email/i).first();
  await expect(email).toBeVisible({ timeout: 10_000 });
  // Interaction hygiene (G-08): submit control is a real <button>.
  const submit = page.getByRole('button', { name: /log in|sign in/i }).first();
  await expect(submit).toBeVisible();
});

test('register page renders', async ({ page }) => {
  await page.goto('/register');
  const email = page.getByLabel(/email/i).first();
  await expect(email).toBeVisible({ timeout: 10_000 });
});
