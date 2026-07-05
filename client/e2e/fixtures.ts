import { test as base, expect, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The bundle is baked with the production VITE_API_BASE_URL / VITE_SOCKET_URL
// (memory: local E2E — use a Playwright origin proxy). Rewrite prod origin
// requests to the local $baseURL so API calls hit the compose stack.
const PROD_ORIGIN = 'https://dockstash.com';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function readEnv(): Record<string, string> {
  const envPath = path.resolve(HERE, '..', '..', '.env');
  const raw = readFileSync(envPath, 'utf8');
  const map: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return map;
}

const b64url = (buf: Buffer | string): string =>
  (typeof buf === 'string' ? Buffer.from(buf) : buf)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/**
 * Mint an HS256 JWT with the root .env JWT_SECRET so tests can drive
 * authenticated surfaces without going through /api/auth/login (which is
 * rate-limited to 10/15min — memory).
 */
export function mintJwt(payload: Record<string, unknown>, ttlSeconds = 3600): string {
  const env = readEnv();
  const secret = env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET missing from root .env');
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(
    JSON.stringify({ iat: now, exp: now + ttlSeconds, ...payload }),
  );
  const sig = b64url(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${sig}`;
}

async function applyTheme(page: Page, theme: 'light' | 'dark'): Promise<void> {
  // ThemeProvider + index.html no-flash script both read localStorage 'theme'
  // and toggle .dark on the root element. emulateMedia is NOT sufficient.
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
}

async function attachOriginProxy(page: Page, baseURL: string): Promise<void> {
  // The web server proxies SEO paths but NOT /api/*. The API service listens
  // separately (root .env API_PORT). Rewrite /api/* to the API origin, and
  // everything else to the web origin.
  const env = readEnv();
  const apiPort = env.API_PORT;
  const webOrigin = baseURL.replace(/\/$/, '');
  const apiOrigin = apiPort ? `http://127.0.0.1:${apiPort}` : webOrigin;
  const rewrite = (url: string): string => {
    if (!url.startsWith(PROD_ORIGIN)) return url;
    const tail = url.slice(PROD_ORIGIN.length);
    return tail.startsWith('/api') ? `${apiOrigin}${tail}` : `${webOrigin}${tail}`;
  };
  await page.route(`${PROD_ORIGIN}/**`, async (route) => {
    // Playwright's `route.continue({ url })` refuses to switch protocols
    // (https → http). Fetch the rewritten URL manually and fulfill.
    const url = route.request().url();
    const response = await route.fetch({ url: rewrite(url) });
    return route.fulfill({ response });
  });
}

async function attachAuthCookie(
  page: Page,
  baseURL: string,
  token: string,
  user: Record<string, unknown>,
): Promise<void> {
  const url = new URL(baseURL);
  // Client seeds auth state from BOTH cookies: `token` (authenticated) and
  // `user` (emailVerified + role). Payload is URI-encoded JSON — matches
  // `saveCookie` in shared/utils/cookies.ts.
  const userValue = encodeURIComponent(JSON.stringify(user));
  await page.context().addCookies([
    {
      name: 'token',
      value: token,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'user',
      value: userValue,
      domain: url.hostname,
      path: '/',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

type Fixtures = {
  themedPage: (theme: 'light' | 'dark') => Promise<Page>;
  localePage: (locale: string) => Promise<Page>;
  authedPage: (payload?: Record<string, unknown>) => Promise<Page>;
  originProxy: (page: Page) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  themedPage: async ({ page, baseURL }, use) => {
    const build = async (theme: 'light' | 'dark') => {
      if (!baseURL) throw new Error('baseURL missing');
      await applyTheme(page, theme);
      await attachOriginProxy(page, baseURL);
      return page;
    };
    await use(build);
  },
  localePage: async ({ page, baseURL }, use) => {
    const build = async (_locale: string) => {
      // Marketing SSR routes carry the locale in the URL prefix (e.g. /ar/).
      // The app shell reads it from the `lang` cookie. Set both so either surface
      // resolves the requested locale.
      if (!baseURL) throw new Error('baseURL missing');
      const url = new URL(baseURL);
      await page.context().addCookies([
        {
          name: 'lang',
          value: _locale,
          domain: url.hostname,
          path: '/',
          sameSite: 'Lax',
        },
      ]);
      await attachOriginProxy(page, baseURL);
      return page;
    };
    await use(build);
  },
  authedPage: async ({ page, baseURL }, use) => {
    const build = async (payload: Record<string, unknown> = {}) => {
      if (!baseURL) throw new Error('baseURL missing');
      // Use a stable owner-shaped payload; real DB _id is not required for
      // route-level access checks in the smoke journeys.
      const user = {
        _id: '000000000000000000000001',
        id: '000000000000000000000001',
        email: 'e2e@dockstash.local',
        role: 'admin',
        emailVerified: true,
        ...payload,
      };
      const token = mintJwt(user);
      await attachAuthCookie(page, baseURL, token, user);
      await attachOriginProxy(page, baseURL);
      return page;
    };
    await use(build);
  },
  originProxy: async ({ baseURL }, use) => {
    const attach = async (page: Page) => {
      if (!baseURL) throw new Error('baseURL missing');
      await attachOriginProxy(page, baseURL);
    };
    await use(attach);
  },
});

export { expect };
