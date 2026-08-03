import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../../shared/testing/mongo.js';
import { env, envSchema } from '../../../config/env.js';
import { User } from '../../users/index.js';
import { hashPassword } from '../auth.service.js';
import { setOAuthHttp } from './oauth-http.js';
import {
  PROVIDER_DEFINITIONS,
  enabledProviders,
  isOAuthProviderName,
  isProviderEnabled,
  redirectUriFor,
} from './oauth-providers.js';
import {
  OAUTH_STATE_COOKIE,
  createOAuthState,
  readStateCookie,
  stateCookieOptions,
  verifyOAuthState,
} from './oauth-state.js';
import {
  buildAuthorizeUrl,
  exchangeCode,
  findOrCreateOAuthUser,
  type OAuthProfile,
} from './oauth.service.js';

const app = createApp();

type MutableEnv = {
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SERVER_URL: string;
  NODE_ENV: string;
};
const mutableEnv = env as unknown as MutableEnv;

function enableProvidersInEnv(): void {
  mutableEnv.GOOGLE_CLIENT_ID = 'google-client';
  mutableEnv.GOOGLE_CLIENT_SECRET = 'google-secret';
  mutableEnv.GITHUB_CLIENT_ID = 'github-client';
  mutableEnv.GITHUB_CLIENT_SECRET = 'github-secret';
}

function disableProvidersInEnv(): void {
  delete mutableEnv.GOOGLE_CLIENT_ID;
  delete mutableEnv.GOOGLE_CLIENT_SECRET;
  delete mutableEnv.GITHUB_CLIENT_ID;
  delete mutableEnv.GITHUB_CLIENT_SECRET;
}

const CALLBACK_BASE = `${env.CLIENT_URL.replace(/\/$/, '')}/oauth/callback`;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

type HttpStub = Record<string, (init?: RequestInit) => Response | Promise<Response>>;

function stubHttp(routes: HttpStub): string[] {
  const calls: string[] = [];
  setOAuthHttp(async (url, init) => {
    calls.push(url);
    const handler = routes[url];
    if (!handler) throw new Error(`unexpected oauth http call: ${url}`);
    return handler(init);
  });
  return calls;
}

function googleHappyRoutes(overrides: HttpStub = {}): HttpStub {
  return {
    [PROVIDER_DEFINITIONS.google.tokenUrl]: () => jsonResponse({ access_token: 'g-access' }),
    [GOOGLE_USERINFO_URL]: () =>
      jsonResponse({
        sub: 'google-sub-1',
        email: 'OAuth.User@Example.com',
        email_verified: true,
        given_name: 'Olive',
        family_name: 'Auth',
      }),
    ...overrides,
  };
}

function githubHappyRoutes(overrides: HttpStub = {}): HttpStub {
  return {
    [PROVIDER_DEFINITIONS.github.tokenUrl]: () => jsonResponse({ access_token: 'gh-access' }),
    [GITHUB_USER_URL]: () => jsonResponse({ id: 4242, name: 'Ada Love Lace', login: 'adal' }),
    [GITHUB_EMAILS_URL]: () =>
      jsonResponse([
        { email: 'secondary@example.com', primary: false, verified: true },
        { email: 'Ada@Example.com', primary: true, verified: true },
      ]),
    ...overrides,
  };
}

function stateFor(provider: 'google' | 'github'): { state: string; cookie: string; nonce: string } {
  const nonce = 'n0'.repeat(16);
  const state = createOAuthState(provider, nonce);
  return { state, cookie: `${OAUTH_STATE_COOKIE}=${nonce}`, nonce };
}

function fragmentOf(location: string | undefined): string {
  expect(location, 'expected a redirect Location header').toBeTruthy();
  const hashIndex = (location as string).indexOf('#');
  expect(hashIndex, `expected a fragment in ${location}`).toBeGreaterThan(-1);
  return (location as string).slice(hashIndex + 1);
}

async function callback(
  provider: string,
  query: Record<string, string>,
  cookie?: string,
): Promise<request.Response> {
  let req = request(app).get(`/api/auth/${provider}/callback`).query(query);
  if (cookie) req = req.set('Cookie', cookie);
  return req.set('User-Agent', 'vitest-ua');
}

describe('oauth module', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
    enableProvidersInEnv();
  });

  afterEach(() => {
    setOAuthHttp(null);
    disableProvidersInEnv();
  });

  describe('GET /api/auth/providers', () => {
    it('reports both providers disabled when no creds are set', async () => {
      disableProvidersInEnv();
      const res = await request(app).get('/api/auth/providers').expect(200);
      expect(res.body).toEqual({ google: false, github: false });
    });

    it('reports both enabled when both credential pairs are set', async () => {
      const res = await request(app).get('/api/auth/providers').expect(200);
      expect(res.body).toEqual({ google: true, github: true });
    });

    it('requires BOTH id and secret per provider', async () => {
      delete mutableEnv.GOOGLE_CLIENT_SECRET;
      delete mutableEnv.GITHUB_CLIENT_ID;
      const res = await request(app).get('/api/auth/providers').expect(200);
      expect(res.body).toEqual({ google: false, github: false });
    });

    it('is mounted outside the auth rate limiter (no RateLimit headers)', async () => {
      const probe = await request(app).get('/api/auth/providers').expect(200);
      expect(probe.headers['ratelimit']).toBeUndefined();
      // Contrast: a limited auth route carries the draft-7 header.
      const limited = await request(app).post('/api/auth/login').send({});
      expect(limited.headers['ratelimit']).toBeDefined();
    });
  });

  describe('GET /api/auth/:provider/start', () => {
    it('redirects to Google with the expected params and sets the state cookie', async () => {
      const res = await request(app).get('/api/auth/google/start').expect(302);
      const location = new URL(res.headers.location as string);
      expect(location.origin + location.pathname).toBe(
        'https://accounts.google.com/o/oauth2/v2/auth',
      );
      expect(location.searchParams.get('client_id')).toBe('google-client');
      expect(location.searchParams.get('redirect_uri')).toBe(
        `${env.SERVER_URL}/api/auth/google/callback`,
      );
      expect(location.searchParams.get('response_type')).toBe('code');
      expect(location.searchParams.get('scope')).toBe('openid email profile');
      expect(location.searchParams.get('prompt')).toBe('select_account');
      expect(location.searchParams.get('access_type')).toBe('online');
      const state = location.searchParams.get('state') as string;

      const setCookie = (res.headers['set-cookie'] as unknown as string[])[0] as string;
      expect(setCookie).toContain(`${OAUTH_STATE_COOKIE}=`);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/api/auth');
      const nonce = /oauth_state=([^;]+)/.exec(setCookie)?.[1] as string;
      expect(verifyOAuthState(state, 'google', nonce)).toBe(true);
    });

    it('redirects to GitHub without the Google-only params', async () => {
      const res = await request(app).get('/api/auth/github/start').expect(302);
      const location = new URL(res.headers.location as string);
      expect(location.origin + location.pathname).toBe('https://github.com/login/oauth/authorize');
      expect(location.searchParams.get('scope')).toBe('read:user user:email');
      expect(location.searchParams.get('prompt')).toBeNull();
      expect(location.searchParams.get('access_type')).toBeNull();
    });

    it('404s for an unknown provider', async () => {
      await request(app).get('/api/auth/gitlab/start').expect(404);
    });

    it('404s for a known but unconfigured provider', async () => {
      delete mutableEnv.GOOGLE_CLIENT_SECRET;
      await request(app).get('/api/auth/google/start').expect(404);
    });
  });

  describe('oauth-state helpers', () => {
    it('round-trips a valid state', () => {
      const { state, nonce } = stateFor('google');
      expect(verifyOAuthState(state, 'google', nonce)).toBe(true);
    });

    it('rejects an expired state', () => {
      const nonce = 'abc';
      const state = jwt.sign(
        { purpose: 'oauth-state', provider: 'google', nonce },
        env.JWT_SECRET,
        { expiresIn: -1 },
      );
      expect(verifyOAuthState(state, 'google', nonce)).toBe(false);
    });

    it('rejects a token with the wrong purpose (a real auth JWT)', () => {
      const authToken = jwt.sign(
        { _id: 'x', id: 'x', email: 'x@example.com', role: 'Member', nonce: 'abc' },
        env.JWT_SECRET,
      );
      expect(verifyOAuthState(authToken, 'google', 'abc')).toBe(false);
    });

    it('rejects a provider mismatch', () => {
      const { state, nonce } = stateFor('github');
      expect(verifyOAuthState(state, 'google', nonce)).toBe(false);
    });

    it('rejects a nonce mismatch and a missing cookie nonce', () => {
      const { state } = stateFor('google');
      expect(verifyOAuthState(state, 'google', 'other-nonce')).toBe(false);
      expect(verifyOAuthState(state, 'google', undefined)).toBe(false);
    });

    it('rejects a non-string nonce claim', () => {
      const state = jwt.sign(
        { purpose: 'oauth-state', provider: 'google', nonce: 5 },
        env.JWT_SECRET,
      );
      expect(verifyOAuthState(state, 'google', '5')).toBe(false);
    });

    it('rejects garbage and non-object payloads', () => {
      expect(verifyOAuthState('not-a-jwt', 'google', 'abc')).toBe(false);
      const stringPayload = jwt.sign('just-a-string', env.JWT_SECRET);
      expect(verifyOAuthState(stringPayload, 'google', 'abc')).toBe(false);
    });

    it('readStateCookie parses only the oauth_state cookie', () => {
      expect(readStateCookie(undefined)).toBeUndefined();
      expect(readStateCookie('foo=bar; baz=qux')).toBeUndefined();
      expect(readStateCookie(`a=b; ${OAUTH_STATE_COOKIE}=my%20nonce; c=d`)).toBe('my nonce');
      expect(readStateCookie('malformed; oauth_state=ok')).toBe('ok');
    });

    it('stateCookieOptions toggles secure by NODE_ENV', () => {
      expect(stateCookieOptions().secure).toBe(false);
      const prev = mutableEnv.NODE_ENV;
      mutableEnv.NODE_ENV = 'production';
      expect(stateCookieOptions().secure).toBe(true);
      mutableEnv.NODE_ENV = prev;
    });
  });

  describe('oauth-providers helpers', () => {
    it('isOAuthProviderName narrows correctly', () => {
      expect(isOAuthProviderName('google')).toBe(true);
      expect(isOAuthProviderName('github')).toBe(true);
      expect(isOAuthProviderName('gitlab')).toBe(false);
    });

    it('enabledProviders mirrors isProviderEnabled', () => {
      expect(enabledProviders()).toEqual({ google: true, github: true });
      expect(isProviderEnabled('google')).toBe(true);
    });

    it('buildAuthorizeUrl and exchangeCode tolerate missing creds (defensive empty strings)', async () => {
      disableProvidersInEnv();
      const url = new URL(buildAuthorizeUrl('google', 'the-state'));
      expect(url.searchParams.get('client_id')).toBe('');

      let tokenInit: RequestInit | undefined;
      stubHttp({
        [PROVIDER_DEFINITIONS.github.tokenUrl]: (init) => {
          tokenInit = init;
          return jsonResponse({ access_token: 'at' });
        },
      });
      await exchangeCode('github', 'code-1');
      const body = new URLSearchParams(String(tokenInit?.body));
      expect(body.get('client_id')).toBe('');
      expect(body.get('client_secret')).toBe('');
    });

    it('redirectUriFor strips a trailing slash from SERVER_URL', () => {
      const prev = mutableEnv.SERVER_URL;
      mutableEnv.SERVER_URL = 'http://api.example.test/';
      expect(redirectUriFor('github')).toBe('http://api.example.test/api/auth/github/callback');
      mutableEnv.SERVER_URL = prev;
    });
  });

  describe('GET /api/auth/:provider/callback — happy paths', () => {
    it('creates a verified Google user and redirects with a token fragment', async () => {
      stubHttp(googleHappyRoutes());
      const { state, cookie } = stateFor('google');
      const res = await callback('google', { code: 'the-code', state }, cookie);
      expect(res.status).toBe(302);

      const fragment = fragmentOf(res.headers.location as string);
      const params = new URLSearchParams(fragment);
      const token = params.get('token') as string;
      expect(token.startsWith('JWT ')).toBe(true);
      const payload = jwt.verify(token.slice(4), env.JWT_SECRET) as { email: string; role: string };
      expect(payload.email).toBe('oauth.user@example.com');
      expect(payload.role).toBe('Member');

      const user = await User.findOne({ email: 'oauth.user@example.com' });
      expect(user).not.toBeNull();
      expect(user?.googleId).toBe('google-sub-1');
      expect(user?.emailVerified).toBe(true);
      expect(user?.profile?.firstName).toBe('Olive');
      expect(user?.profile?.lastName).toBe('Auth');
      expect(user?.password).toMatch(/^\$2[aby]\$/);
      // State cookie is cleared on the callback response.
      const cleared = (res.headers['set-cookie'] as unknown as string[]).find((c) =>
        c.startsWith(`${OAUTH_STATE_COOKIE}=`),
      );
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970');
    });

    it('honours Accept-Language when creating the user', async () => {
      stubHttp(googleHappyRoutes());
      const { state, cookie } = stateFor('google');
      const res = await request(app)
        .get('/api/auth/google/callback')
        .query({ code: 'c', state })
        .set('Cookie', cookie)
        .set('Accept-Language', 'fr');
      expect(res.status).toBe(302);
      const user = await User.findOne({ email: 'oauth.user@example.com' });
      expect(user?.language).toBe('fr');
    });

    it('creates a GitHub user, picking the primary verified email and splitting the name', async () => {
      const calls = stubHttp(githubHappyRoutes());
      const { state, cookie } = stateFor('github');
      const res = await callback('github', { code: 'gh-code', state }, cookie);
      expect(res.status).toBe(302);
      expect(fragmentOf(res.headers.location as string)).toContain('token=');

      const user = await User.findOne({ email: 'ada@example.com' });
      expect(user?.githubId).toBe('4242');
      expect(user?.profile?.firstName).toBe('Ada');
      expect(user?.profile?.lastName).toBe('Love Lace');
      expect(calls).toEqual([
        PROVIDER_DEFINITIONS.github.tokenUrl,
        GITHUB_USER_URL,
        GITHUB_EMAILS_URL,
      ]);
    });

    it('sends the GitHub-required headers on API calls', async () => {
      let userInit: RequestInit | undefined;
      stubHttp(
        githubHappyRoutes({
          [GITHUB_USER_URL]: (init) => {
            userInit = init;
            return jsonResponse({ id: 7, name: 'Solo', login: 'solo' });
          },
        }),
      );
      const { state, cookie } = stateFor('github');
      await callback('github', { code: 'c', state }, cookie);
      const headers = userInit?.headers as Record<string, string>;
      expect(headers['User-Agent']).toBe('dockstash');
      expect(headers.Accept).toBe('application/vnd.github+json');
      expect(headers.Authorization).toBe('Bearer gh-access');
      // Single-word name → firstName only.
      const user = await User.findOne({ email: 'ada@example.com' });
      expect(user?.profile?.firstName).toBe('Solo');
      expect(user?.profile?.lastName).toBe('');
    });

    it('defaults missing Google name parts to empty strings', async () => {
      stubHttp(
        googleHappyRoutes({
          [GOOGLE_USERINFO_URL]: () =>
            jsonResponse({ sub: 'g-min', email: 'min@example.com', email_verified: true }),
        }),
      );
      const { state, cookie } = stateFor('google');
      await callback('google', { code: 'c', state }, cookie);
      const user = await User.findOne({ email: 'min@example.com' });
      expect(user?.profile?.firstName).toBe('');
      expect(user?.profile?.lastName).toBe('');
    });

    it('handles a string GitHub id and a whitespace name with a non-string login', async () => {
      stubHttp(
        githubHappyRoutes({
          [GITHUB_USER_URL]: () => jsonResponse({ id: 'node-id-9', name: '   ', login: 42 }),
        }),
      );
      const { state, cookie } = stateFor('github');
      await callback('github', { code: 'c', state }, cookie);
      const user = await User.findOne({ email: 'ada@example.com' });
      expect(user?.githubId).toBe('node-id-9');
      expect(user?.profile?.firstName).toBe('');
      expect(user?.profile?.lastName).toBe('');
    });

    it('falls back to the GitHub login when name is missing', async () => {
      stubHttp(
        githubHappyRoutes({
          [GITHUB_USER_URL]: () => jsonResponse({ id: 8, name: null, login: 'octo' }),
        }),
      );
      const { state, cookie } = stateFor('github');
      await callback('github', { code: 'c', state }, cookie);
      const user = await User.findOne({ email: 'ada@example.com' });
      expect(user?.profile?.firstName).toBe('octo');
    });

    it('logs in an existing user by provider id without creating a duplicate', async () => {
      stubHttp(googleHappyRoutes());
      const first = stateFor('google');
      await callback('google', { code: 'c1', state: first.state }, first.cookie);
      const second = stateFor('google');
      const res = await callback('google', { code: 'c2', state: second.state }, second.cookie);
      expect(fragmentOf(res.headers.location as string)).toContain('token=');
      expect(await User.countDocuments({ email: 'oauth.user@example.com' })).toBe(1);
    });

    it('auto-links by email and upgrades emailVerified on an unverified local account', async () => {
      await User.create({
        email: 'oauth.user@example.com',
        password: await hashPassword('local-password'),
        emailVerified: false,
        emailVerificationToken: 'tok',
        emailVerificationExpires: new Date(),
      });
      stubHttp(googleHappyRoutes());
      const { state, cookie } = stateFor('google');
      const res = await callback('google', { code: 'c', state }, cookie);
      expect(fragmentOf(res.headers.location as string)).toContain('token=');

      const user = await User.findOne({ email: 'oauth.user@example.com' });
      expect(user?.googleId).toBe('google-sub-1');
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerificationToken).toBeUndefined();
      expect(await User.countDocuments()).toBe(1);
    });

    it('links without touching verification on an already-verified account', async () => {
      const existing = await User.create({
        email: 'ada@example.com',
        password: await hashPassword('local-password'),
        emailVerified: true,
      });
      stubHttp(githubHappyRoutes());
      const { state, cookie } = stateFor('github');
      await callback('github', { code: 'c', state }, cookie);
      const user = await User.findById(existing._id);
      expect(user?.githubId).toBe('4242');
      expect(user?.emailVerified).toBe(true);
    });
  });

  describe('GET /api/auth/:provider/callback — error redirects', () => {
    async function expectErrorFragment(
      res: request.Response,
      code: string,
    ): Promise<void> {
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(`${CALLBACK_BASE}#error=${code}`);
    }

    it('maps provider access_denied to accessDenied', async () => {
      const res = await callback('google', { error: 'access_denied' });
      await expectErrorFragment(res, 'accessDenied');
    });

    it('maps any other provider error to providerError', async () => {
      const res = await callback('google', { error: 'temporarily_unavailable' });
      await expectErrorFragment(res, 'providerError');
    });

    it('redirects providerError for unknown and unconfigured providers', async () => {
      await expectErrorFragment(await callback('gitlab', { code: 'c' }), 'providerError');
      delete mutableEnv.GITHUB_CLIENT_SECRET;
      await expectErrorFragment(await callback('github', { code: 'c' }), 'providerError');
    });

    it('redirects invalidState when code or state is missing', async () => {
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(await callback('google', { state }, cookie), 'invalidState');
      await expectErrorFragment(await callback('google', { code: 'c' }, cookie), 'invalidState');
    });

    it('redirects invalidState on a bad state or missing cookie', async () => {
      const { state } = stateFor('google');
      // No cookie at all:
      await expectErrorFragment(await callback('google', { code: 'c', state }), 'invalidState');
      // Wrong nonce in the cookie:
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, `${OAUTH_STATE_COOKIE}=wrong`),
        'invalidState',
      );
    });

    it('redirects providerError when the token exchange fails', async () => {
      stubHttp({
        [PROVIDER_DEFINITIONS.google.tokenUrl]: () => jsonResponse({ error: 'bad' }, 500),
      });
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('redirects providerError when the token payload has no access_token', async () => {
      stubHttp({
        [PROVIDER_DEFINITIONS.google.tokenUrl]: () => jsonResponse({ token_type: 'bearer' }),
      });
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('redirects providerError when the userinfo fetch fails', async () => {
      stubHttp(googleHappyRoutes({ [GOOGLE_USERINFO_URL]: () => jsonResponse({}, 401) }));
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('redirects emailUnavailable when Google does not attest the email', async () => {
      stubHttp(
        googleHappyRoutes({
          [GOOGLE_USERINFO_URL]: () =>
            jsonResponse({ sub: 's', email: 'x@example.com', email_verified: false }),
        }),
      );
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, cookie),
        'emailUnavailable',
      );
    });

    it('redirects providerError when the GitHub user payload is malformed', async () => {
      stubHttp(githubHappyRoutes({ [GITHUB_USER_URL]: () => jsonResponse({ login: 'x' }) }));
      const { state, cookie } = stateFor('github');
      await expectErrorFragment(
        await callback('github', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('redirects providerError when the GitHub user fetch fails', async () => {
      stubHttp(githubHappyRoutes({ [GITHUB_USER_URL]: () => jsonResponse({}, 500) }));
      const { state, cookie } = stateFor('github');
      await expectErrorFragment(
        await callback('github', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('redirects emailUnavailable when GitHub has no primary verified email', async () => {
      stubHttp(
        githubHappyRoutes({
          [GITHUB_EMAILS_URL]: () =>
            jsonResponse([{ email: 'a@example.com', primary: true, verified: false }]),
        }),
      );
      const { state, cookie } = stateFor('github');
      await expectErrorFragment(
        await callback('github', { code: 'c', state }, cookie),
        'emailUnavailable',
      );
    });

    it('redirects emailUnavailable when the GitHub emails endpoint fails or is malformed', async () => {
      stubHttp(githubHappyRoutes({ [GITHUB_EMAILS_URL]: () => jsonResponse({}, 403) }));
      const first = stateFor('github');
      await expectErrorFragment(
        await callback('github', { code: 'c', state: first.state }, first.cookie),
        'emailUnavailable',
      );
      // Non-array JSON body:
      stubHttp(githubHappyRoutes({ [GITHUB_EMAILS_URL]: () => jsonResponse({ nope: true }) }));
      const second = stateFor('github');
      await expectErrorFragment(
        await callback('github', { code: 'c', state: second.state }, second.cookie),
        'emailUnavailable',
      );
    });

    it('degrades unexpected failures (network throw) to providerError', async () => {
      setOAuthHttp(async () => {
        throw new Error('network down');
      });
      const { state, cookie } = stateFor('google');
      await expectErrorFragment(
        await callback('google', { code: 'c', state }, cookie),
        'providerError',
      );
    });

    it('degrades a malformed query (zod failure) to providerError', async () => {
      const { cookie } = stateFor('google');
      const res = await request(app)
        .get('/api/auth/google/callback?code=a&code=b')
        .set('Cookie', cookie);
      await expectErrorFragment(res, 'providerError');
    });
  });

  describe('env schema — OAuth creds', () => {
    const baseEnv = {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/x',
      JWT_SECRET: 'test'.repeat(8),
      MASTER_ENCRYPTION_KEY: 'aa'.repeat(32),
    };

    it("maps compose's empty strings to undefined (provider disabled)", () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        GOOGLE_CLIENT_ID: '',
        GOOGLE_CLIENT_SECRET: '',
        GITHUB_CLIENT_ID: '',
        GITHUB_CLIENT_SECRET: '',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GOOGLE_CLIENT_ID).toBeUndefined();
        expect(result.data.GOOGLE_CLIENT_SECRET).toBeUndefined();
        expect(result.data.GITHUB_CLIENT_ID).toBeUndefined();
        expect(result.data.GITHUB_CLIENT_SECRET).toBeUndefined();
      }
    });

    it('passes real credential values through', () => {
      const result = envSchema.safeParse({
        ...baseEnv,
        GOOGLE_CLIENT_ID: 'gid',
        GOOGLE_CLIENT_SECRET: 'gsecret',
        GITHUB_CLIENT_ID: 'ghid',
        GITHUB_CLIENT_SECRET: 'ghsecret',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.GOOGLE_CLIENT_ID).toBe('gid');
        expect(result.data.GOOGLE_CLIENT_SECRET).toBe('gsecret');
        expect(result.data.GITHUB_CLIENT_ID).toBe('ghid');
        expect(result.data.GITHUB_CLIENT_SECRET).toBe('ghsecret');
      }
    });
  });

  describe('findOrCreateOAuthUser defaults + sparse indexes', () => {
    const profile: OAuthProfile = {
      providerId: 'direct-1',
      email: 'direct@example.com',
      firstName: 'Di',
      lastName: 'Rect',
    };

    it('defaults the locale when none is provided', async () => {
      const user = await findOrCreateOAuthUser('github', profile);
      expect(user.language).toBe('en');
      expect(user.githubId).toBe('direct-1');
    });

    it('allows many users without provider ids but rejects duplicates', async () => {
      await User.syncIndexes();
      await User.create({ email: 'a@example.com', password: 'x', emailVerified: true });
      await User.create({ email: 'b@example.com', password: 'x', emailVerified: true });
      await User.create({ email: 'c@example.com', password: 'x', googleId: 'dup-1' });
      await expect(
        User.create({ email: 'd@example.com', password: 'x', googleId: 'dup-1' }),
      ).rejects.toThrow(/duplicate key/i);
    });
  });
});
