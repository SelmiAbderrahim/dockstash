import { test, expect } from '../fixtures';

// SSR marketing routes from the Phase-1 inventory (client/src/features/marketing/routes.tsx).
// Each must render HTTP 200 + an h1 element with no browser-console errors.
const ROUTES: readonly string[] = [
  '/',
  '/pricing',
  '/alternatives',
  '/guides',
  '/faq',
  '/security',
  '/fleet-agents',
  '/privacy',
  '/terms',
];

for (const path of ROUTES) {
  test(`marketing route renders without console errors: ${path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    const resp = await page.goto(path);
    expect(resp?.status(), `HTTP status for ${path}`).toBe(200);
    await expect(page.locator('h1').first()).toBeVisible();
    expect(errors, `Console errors on ${path}:\n${errors.join('\n')}`).toEqual([]);
  });
}

test('landing hero renders SSR content + FAQ <details>', async ({ page }) => {
  const resp = await page.goto('/');
  expect(resp?.status()).toBe(200);
  // The compose stack proxies /api → api service; the SSR HTML must carry both
  // hero copy and FAQ answer text (AEO groundwork — G-10 in Phase 4).
  await expect(page.locator('h1').first()).toContainText(/back up|Docker/i);
  await expect(page.locator('details').first()).toBeAttached();
});
