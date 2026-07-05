import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../fixtures';

const SURFACES = [
  { name: 'landing', path: '/' },
  { name: 'pricing', path: '/pricing' },
] as const;

const THEMES = ['light', 'dark'] as const;

// The theme class settles asynchronously after ThemeProvider mounts (the
// no-flash script runs pre-paint, but React hydration + the initial useEffect
// tick can toggle it again). Wait for the class state to match the requested
// theme AND for a paint frame to flush so the token cascade is applied — else
// axe can snapshot mid-flip and read near-white foreground over white bg on
// SSR-rendered table cells. Fixes D-03.1 (SSR → hydration race).
async function waitThemeSettled(page: import('@playwright/test').Page, theme: 'light' | 'dark') {
  await page.waitForFunction(
    (t) => document.documentElement.classList.contains('dark') === (t === 'dark'),
    theme,
  );
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))),
  );
}

for (const s of SURFACES) {
  for (const theme of THEMES) {
    test(`axe ${s.name} — ${theme}`, async ({ themedPage }) => {
      const page = await themedPage(theme);
      await page.goto(s.path);
      await page.locator('h1, h2').first().waitFor();
      await waitThemeSettled(page, theme);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations,
        `axe violations on ${s.name} (${theme}):\n${JSON.stringify(results.violations, null, 2)}`,
      ).toEqual([]);
    });
  }
}

test('axe landing — RTL (Arabic)', async ({ localePage }) => {
  const page = await localePage('ar');
  await page.goto('/ar');
  await page.locator('h1, h2').first().waitFor();
  await waitThemeSettled(page, 'light');
  // Verify dir="rtl" set — otherwise the RTL a11y coverage is fake.
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(
    results.violations,
    `axe violations on /ar landing:\n${JSON.stringify(results.violations, null, 2)}`,
  ).toEqual([]);
});
