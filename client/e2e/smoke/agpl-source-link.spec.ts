import { test, expect } from '../fixtures';

// AGPL-3.0 §13: a network-facing instance must offer its source to users.
test('the running app offers its source code (AGPL §13)', async ({ page }) => {
  await page.goto('/login');
  const link = page.getByRole('link', { name: /source code/i }).first();
  await expect(link).toBeVisible({ timeout: 10_000 });
  await expect(link).toHaveAttribute('href', /^https?:\/\//);
});
