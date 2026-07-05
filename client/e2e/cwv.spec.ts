import { test, expect } from './fixtures';

/**
 * Buffered PerformanceObserver injected before navigation so we catch layout-shift
 * + LCP entries that fire during initial paint. Assertions run after `networkidle`
 * plus a settle delay so late shifts still count.
 *
 * Budgets: LCP < 2500ms, CLS < 0.1 on the compose stack (G-12).
 */
test('landing meets CLS < 0.1 and LCP < 2500ms budgets', async ({ page }) => {
  await page.addInitScript(() => {
    // @ts-expect-error runtime globals used only inside the browser
    window.__cls = 0;
    // @ts-expect-error runtime globals used only inside the browser
    window.__lcp = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        // @ts-expect-error layout-shift entry types not in lib.dom
        if (!entry.hadRecentInput) {
          // @ts-expect-error runtime global
          window.__cls += (entry as any).value ?? 0;
        }
      }
    }).observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) {
        // @ts-expect-error runtime global
        window.__lcp = entries[entries.length - 1].startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  // Settle: any late shifts (e.g. font swap) counted before we sample.
  await page.waitForTimeout(1500);
  // Trigger a final LCP capture in Chromium: interaction stops LCP updates.
  await page.evaluate(() => document.body.click());

  const [cls, lcp] = await page.evaluate(() => [
    // @ts-expect-error runtime global
    window.__cls as number,
    // @ts-expect-error runtime global
    window.__lcp as number,
  ]);
  expect(cls, `CLS should be < 0.1 (got ${cls})`).toBeLessThan(0.1);
  expect(lcp, `LCP should be < 2500ms (got ${lcp}ms)`).toBeLessThan(2500);
});
