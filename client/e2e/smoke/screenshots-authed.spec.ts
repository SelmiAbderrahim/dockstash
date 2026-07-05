import { test } from '../fixtures';

/**
 * G-18 per-surface visual evidence — auth-gated app + superadmin surfaces.
 * Filename convention mirrors §e: <surface>-<width>-<theme>[-rtl].png. Every
 * row of REFERENCE-UI-SPEC.md's per-surface application map is represented.
 *
 * Notes:
 * - Screenshots use the minted-JWT `authedPage` fixture so gated routes render.
 * - Empty-state anatomy is designed (SPEC-06) — capturing empty tables is
 *   deliberate G-18 evidence, not a bug.
 * - Widths: 320/768/1024/1440/1920 in both themes; one RTL-Arabic capture at
 *   768 per surface per §e.
 */
const OUT = '../.claude/plans/design-upgrade-evidence';
const WIDTHS = [320, 768, 1024, 1440, 1920] as const;

const SURFACES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'projects', path: '/projects' },
  { name: 'projects-new', path: '/projects/new' },
  { name: 'snapshots', path: '/snapshots' },
  { name: 'fleet', path: '/fleet' },
  { name: 'billing', path: '/billing' },
  { name: 'settings', path: '/settings' },
  { name: 'setup', path: '/setup' },
  { name: 'profile', path: '/profile' },
  { name: 'admin', path: '/admin' },
  { name: 'superadmin-overview', path: '/superadmin?tab=overview' },
  { name: 'superadmin-users', path: '/superadmin?tab=users' },
  { name: 'superadmin-billing', path: '/superadmin?tab=billing' },
  { name: 'superadmin-system', path: '/superadmin?tab=system' },
  { name: 'superadmin-audit', path: '/superadmin?tab=audit' },
  { name: 'login', path: '/login' },
  { name: 'register', path: '/register' },
] as const;

for (const s of SURFACES) {
  for (const w of WIDTHS) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${s.name}-${w}-${theme}`, async ({ authedPage }) => {
        const page = await authedPage();
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(s.path, { waitUntil: 'networkidle' }).catch(() => undefined);
        // The CSR shell paints even when API calls fail; give it a beat to
        // finish first-render layout so the screenshot isn't half-mounted.
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => setTimeout(r, 150)),
              ),
            ),
        );
        await page.emulateMedia({ colorScheme: theme });
        await page.evaluate((t) => {
          localStorage.setItem('theme', t);
          document.documentElement.classList.toggle('dark', t === 'dark');
        }, theme);
        await page.screenshot({
          path: `${OUT}/${s.name}-${w}-${theme}.png`,
          fullPage: true,
        });
      });
    }
  }
  test(`${s.name}-768-light-rtl`, async ({ authedPage, baseURL }) => {
    const page = await authedPage();
    const host = new URL(baseURL ?? 'http://127.0.0.1:43000').hostname;
    await page.context().addCookies([
      {
        name: 'lang',
        value: 'ar',
        domain: host,
        path: '/',
        sameSite: 'Lax',
      },
    ]);
    await page.setViewportSize({ width: 768, height: 900 });
    await page.goto(s.path, { waitUntil: 'networkidle' }).catch(() => undefined);
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() =>
            requestAnimationFrame(() => setTimeout(r, 150)),
          ),
        ),
    );
    await page.screenshot({
      path: `${OUT}/${s.name}-768-light-rtl.png`,
      fullPage: true,
    });
  });
}
