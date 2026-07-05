import { test } from '../fixtures';

/**
 * Evidence capture — NOT a gate. Produces §4 visual-evidence artifacts under
 * .claude/plans/design-upgrade-evidence/. Filename convention:
 * <surface>-<width>-<theme>[-rtl].png (GATE-MACHINERY §e).
 */
const SURFACES = [{ name: 'home', path: '/' }] as const;
const WIDTHS = [320, 768, 1024, 1440, 1920] as const;
const OUT = '../.claude/plans/design-upgrade-evidence';

for (const s of SURFACES) {
  for (const w of WIDTHS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${s.name}-${w}-${theme}`, async ({ themedPage }) => {
        const page = await themedPage(theme);
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(s.path, { waitUntil: 'networkidle' });
        await page.screenshot({
          path: `${OUT}/${s.name}-${w}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }
}

test('home-768-light-rtl', async ({ localePage }) => {
  const page = await localePage('ar');
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto('/ar', { waitUntil: 'networkidle' });
  await page.screenshot({
    path: `${OUT}/home-768-light-rtl.png`,
    fullPage: true,
  });
});
