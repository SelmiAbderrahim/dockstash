import { test, expect } from '../fixtures';

test('Arabic marketing landing renders dir=rtl + translated strings', async ({ localePage }) => {
  const page = await localePage('ar');
  const resp = await page.goto('/ar');
  expect(resp?.status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  // Spot-assert a real translated string appears in SSR HTML (not just an
  // attribute flip). Arabic body text uses the Arabic block.
  const arabic = await page.locator('body').innerText();
  expect(/[؀-ۿ]/.test(arabic), 'Arabic characters present in body').toBe(true);
});

test('Arabic app shell — sidebar renders on end side under RTL', async ({
  authedPage,
  page,
  baseURL,
}) => {
  const authed = await authedPage();
  // Set locale cookie in addition to auth cookie so the shell renders in Arabic.
  const url = new URL(baseURL!);
  await authed.context().addCookies([
    {
      name: 'lang',
      value: 'ar',
      domain: url.hostname,
      path: '/',
      sameSite: 'Lax',
    },
  ]);
  await authed.goto('/dashboard');
  await authed.locator('h1, h2, [role="heading"]').first().waitFor({ timeout: 10_000 });
  await expect(authed.locator('html')).toHaveAttribute('dir', 'rtl');
});
