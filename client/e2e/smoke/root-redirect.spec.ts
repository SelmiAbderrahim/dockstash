import { test, expect } from '@playwright/test';

test('/ redirects an anonymous visitor to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  await expect(page.getByLabel(/email/i).first()).toBeVisible();
});

test('a removed marketing/billing URL falls through to /login', async ({ page }) => {
  for (const url of ['/pricing', '/billing', '/superadmin']) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  }
});
