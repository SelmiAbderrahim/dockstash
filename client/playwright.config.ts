import { defineConfig } from '@playwright/test';

// E2E lives outside src/, so vitest coverage (include: ['src/**']) never sees it.
// Coverage for these flows is behavioral, via the compose stack. No vitest
// `exclude` entries are needed (see memory: vitest 2.1.9 exclude quirks).
//
// PLAYWRIGHT_BASE_URL must be derived from the root .env WEB_PORT — never hardcode
// a port here (BAN-08 + .claude/rules/site-url-env-pattern.md). Suggested harness:
//   WEB_PORT=$(grep -E '^WEB_PORT=' ../.env | cut -d= -f2)
//   export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${WEB_PORT}"
const baseURL = process.env.PLAYWRIGHT_BASE_URL;
if (!baseURL) {
  throw new Error('PLAYWRIGHT_BASE_URL is required (derive from root .env WEB_PORT)');
}

export default defineConfig({
  testDir: './e2e',
  // Flake policy (GATE-MACHINERY §c): a spec that passes on retry is a flake —
  // gate stays green but the flake is logged in ledger §5 with the trace path.
  // A spec that fails twice is a regression. Never bump retries to bury it.
  retries: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    // headless is default; keep it explicit for CI clarity
    headless: true,
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'smoke', testMatch: /smoke\/.*\.spec\.ts/ },
    { name: 'a11y', testMatch: /a11y\/.*\.spec\.ts/ },
    { name: 'locale-ar', testMatch: /locale-ar\/.*\.spec\.ts/ },
    { name: 'cwv', testMatch: /cwv\.spec\.ts/ },
  ],
});
