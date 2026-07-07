import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import passport from 'passport';
import { requestId } from './request-id.js';
import { language } from './language.js';
import { requireCsrf } from './csrf.js';
import type { Store } from 'express-rate-limit';
import {
  createAgentRateLimiter,
  createAuthRateLimiter,
  createContactRateLimiter,
  createExportRateLimiter,
  createWebhookRateLimiter,
  getRedisStoreFactory,
  rateLimitHandler,
  setRedisStoreFactory,
} from './rate-limit.js';
import { errorHandler } from './error-handler.js';
import { requireAuth } from './require-auth.js';
import { env } from '../../config/env.js';
import { HttpError } from '../utils/http-error.js';
import { translate } from '../i18n/index.js';

interface FakeRes {
  body?: unknown;
  statusCode?: number;
  headers: Record<string, string>;
  status: (code: number) => FakeRes;
  json: (body: unknown) => FakeRes;
  setHeader: (k: string, v: string) => FakeRes;
}

function mockRes(): FakeRes & Response {
  const res: FakeRes = {
    headers: {},
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    setHeader(k: string, v: string) {
      res.headers[k] = v;
      return res;
    },
  };
  return res as unknown as FakeRes & Response;
}

describe('requestId middleware', () => {
  it('reuses a short incoming id', () => {
    const req = { header: () => 'abc123' } as unknown as Request;
    const res = mockRes();
    const next = vi.fn();
    requestId(req, res, next);
    expect(req.id).toBe('abc123');
    expect(next).toHaveBeenCalled();
  });

  it('generates a uuid when the incoming id is missing or too long', () => {
    for (const incoming of [undefined, 'x'.repeat(200)]) {
      const req = { header: () => incoming } as unknown as Request;
      const res = mockRes();
      requestId(req, res, vi.fn());
      expect(req.id).toBeDefined();
      expect(req.id).not.toBe(incoming);
    }
  });
});

describe('language middleware', () => {
  const run = (headers: Record<string, unknown>) => {
    const req = { headers } as unknown as Request;
    language(req, mockRes(), vi.fn());
    return req;
  };

  it('resolves from a valid language cookie', () => {
    const req = run({ cookie: 'lang=fr' });
    expect(req.language).toBe('fr');
  });

  it('falls back to raw value when the cookie is malformed', () => {
    const req = run({ cookie: 'lang=%E0%A4%A' });
    expect(req.language).toBeDefined();
  });

  it('ignores a cookie header without the language cookie', () => {
    const req = run({ cookie: 'other=1; more=2' });
    expect(req.language).toBeDefined();
  });

  it('reads the first value of array-valued headers', () => {
    const req = run({ 'x-lang': ['de', 'fr'], 'accept-language': ['es', 'en'] });
    expect(req.language).toBe('de');
  });
});

describe('requireCsrf middleware', () => {
  const call = (req: Partial<Request>) => {
    const next = vi.fn();
    requireCsrf(req as Request, mockRes(), next);
    return next;
  };

  it('passes safe methods through', () => {
    expect(call({ method: 'GET', headers: {} }).mock.calls[0]?.[0]).toBeUndefined();
  });

  it('exempts bearer-token requests', () => {
    const next = call({ method: 'POST', headers: { authorization: 'JWT x' } });
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('rejects when tokens are missing', () => {
    const next = call({ method: 'POST', headers: {} });
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403 });
  });

  it('rejects when a cookie header is present but has no CSRF cookie', () => {
    const next = call({
      method: 'POST',
      headers: {
        cookie: 'other=1; more=2',
        [env.CSRF_HEADER_NAME.toLowerCase()]: 'sometoken',
      },
    });
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403 });
  });

  it('rejects when cookie and header tokens differ in length', () => {
    const next = call({
      method: 'POST',
      headers: {
        cookie: `${env.CSRF_COOKIE_NAME}=short`,
        [env.CSRF_HEADER_NAME.toLowerCase()]: 'muchlongertoken',
      },
    });
    expect(next.mock.calls[0]?.[0]).toMatchObject({ status: 403 });
  });

  it('accepts a matching double-submit token (malformed-encoding cookie path)', () => {
    const next = call({
      method: 'POST',
      headers: {
        cookie: `${env.CSRF_COOKIE_NAME}=%E0%A4%A`,
        [env.CSRF_HEADER_NAME.toLowerCase()]: '%E0%A4%A',
      },
    });
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('reads the first element when the CSRF header is array-valued', () => {
    const next = call({
      method: 'POST',
      headers: {
        cookie: `${env.CSRF_COOKIE_NAME}=abc`,
        [env.CSRF_HEADER_NAME.toLowerCase()]: ['abc', 'other'],
      },
    });
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });

  it('uses the translator for the rejection message when req.t is a function', () => {
    const next = call({
      method: 'POST',
      headers: {},
      t: ((k: string) => `T:${k}`),
    } as unknown as Partial<Request>);
    expect(next.mock.calls[0]?.[0]).toMatchObject({
      status: 403,
      message: 'T:security.error.csrfInvalid',
    });
  });

  it('skips cookie segments that contain no "=" (idx === -1)', () => {
    const next = call({
      method: 'POST',
      headers: {
        cookie: `flagonly; ${env.CSRF_COOKIE_NAME}=abc`,
        [env.CSRF_HEADER_NAME.toLowerCase()]: 'abc',
      },
    });
    expect(next.mock.calls[0]?.[0]).toBeUndefined();
  });
});

describe('rateLimitHandler', () => {
  it('uses the translator when present', () => {
    const res = mockRes();
    (res as unknown as { req: unknown }).req = { t: (k: string) => `T:${k}` };
    rateLimitHandler({} as Request, res);
    expect((res.body as { error: string }).error).toBe('T:security.error.rateLimited');
  });

  it('falls back to a literal when no translator is present', () => {
    const res = mockRes();
    (res as unknown as { req: unknown }).req = {};
    rateLimitHandler({} as Request, res);
    expect((res.body as { error: string }).error).toMatch(/Too many/);
  });
});

describe('errorHandler never leaks the stack (S7-04)', () => {
  const original = env.NODE_ENV;
  afterEach(() => {
    (env as { NODE_ENV: string }).NODE_ENV = original;
  });

  it('omits the stack from the response body even in development', () => {
    (env as { NODE_ENV: string }).NODE_ENV = 'development';
    const res = mockRes();
    const req = { language: 'en' } as unknown as Request;
    errorHandler(new Error('kaboom'), req, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect((res.body as { error: Record<string, unknown> }).error.stack).toBeUndefined();
    expect((res.body as { error: { message: string } }).error.message).toBeTruthy();
  });

  it('omits the stack from the response body in production', () => {
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    const res = mockRes();
    const req = { language: 'en' } as unknown as Request;
    errorHandler(new Error('kaboom'), req, res, vi.fn());
    expect((res.body as { error: Record<string, unknown> }).error.stack).toBeUndefined();
  });
});

describe('errorHandler i18n-key resolution branches', () => {
  const errorMessage = (res: FakeRes): string =>
    (res.body as { error: { message: string } }).error.message;

  it('returns a key-shaped message verbatim when the segment resolves to a missing branch (hasKey null arm)', () => {
    const res = mockRes();
    errorHandler(HttpError.badRequest('nope.missing'), {} as Request, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(errorMessage(res)).toBe('nope.missing');
  });

  it('returns a key-shaped message verbatim when a segment overshoots a string leaf (hasKey non-object arm)', () => {
    const res = mockRes();
    errorHandler(HttpError.badRequest('errors.notFound.deeper'), {} as Request, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(errorMessage(res)).toBe('errors.notFound.deeper');
  });

  it('translates a real key via translate() when the request has no t() function', () => {
    const res = mockRes();
    // No req.t and no req.language → falls back to DEFAULT_LOCALE inside translate().
    errorHandler(HttpError.notFound('errors.projectNotFound'), {} as Request, res, vi.fn());
    expect(res.statusCode).toBe(404);
    expect(errorMessage(res)).toBe(translate('en', 'errors.projectNotFound'));
    expect(errorMessage(res)).not.toBe('errors.projectNotFound');
  });
});

/**
 * S1-02 — rate-limit store selection.
 * `buildStore()` is a private helper; its behavior is verified through the
 * public factory functions + the `setRedisStoreFactory` injector. The
 * production ioredis + rate-limit-redis wiring is covered by the
 * `c8 ignore`-wrapped `productionRedisStoreFactory` in
 * `rate-limit-redis-store.ts` (real Redis socket) — see health.service.ts
 * for the same pattern.
 */
describe('rate-limit Redis store selection (S1-02)', () => {
  const prevFactory = getRedisStoreFactory();
  const prevRedisUrl = env.REDIS_URL;
  const prevNodeEnv = env.NODE_ENV;

  afterEach(() => {
    setRedisStoreFactory(prevFactory);
    (env as { REDIS_URL?: string }).REDIS_URL = prevRedisUrl;
    (env as { NODE_ENV: string }).NODE_ENV = prevNodeEnv;
  });

  it('setter / getter round-trip the factory reference', () => {
    const stub: (url: string) => Store | null = () => null;
    setRedisStoreFactory(stub);
    expect(getRedisStoreFactory()).toBe(stub);
    setRedisStoreFactory(null);
    expect(getRedisStoreFactory()).toBeNull();
  });

  it('NODE_ENV === "test" short-circuits: the factory is never invoked', () => {
    const factory = vi.fn(() => null);
    setRedisStoreFactory(factory);
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    (env as { NODE_ENV: string }).NODE_ENV = 'test';
    // Each factory is constructed at call time — none should call the injected
    // factory because the test-env guard fires first.
    createAuthRateLimiter();
    createWebhookRateLimiter();
    createAgentRateLimiter();
    createContactRateLimiter();
    createExportRateLimiter();
    expect(factory).not.toHaveBeenCalled();
  });

  it('unset REDIS_URL short-circuits: no factory call, no Redis store', () => {
    const factory = vi.fn(() => null);
    setRedisStoreFactory(factory);
    (env as { REDIS_URL?: string }).REDIS_URL = undefined;
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    createAuthRateLimiter();
    expect(factory).not.toHaveBeenCalled();
  });

  it('unset factory short-circuits: no crash when REDIS_URL is set in prod', () => {
    setRedisStoreFactory(null);
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    // Should return an in-memory limiter without throwing.
    expect(() => createAuthRateLimiter()).not.toThrow();
  });

  it('factory returning null falls back to in-memory (undefined store)', () => {
    const nullFactory: (url: string) => Store | null = vi.fn(() => null);
    setRedisStoreFactory(nullFactory);
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    createAuthRateLimiter();
    expect(nullFactory).toHaveBeenCalledWith('redis://localhost:6379');
  });

  it('factory returning a live Store is used by every limiter kind', () => {
    // express-rate-limit rejects reusing a single Store across limiters
    // (`ERR_ERL_STORE_REUSE`), so hand out a fresh store per call.
    const newStore = (): Store => ({
      init: () => undefined,
      increment: async () => ({ totalHits: 1, resetTime: new Date() }),
      decrement: async () => undefined,
      resetKey: async () => undefined,
      resetAll: async () => undefined,
    } as unknown as Store);
    const factory: (url: string) => Store | null = vi.fn(() => newStore());
    setRedisStoreFactory(factory);
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    (env as { NODE_ENV: string }).NODE_ENV = 'production';
    createAuthRateLimiter();
    createWebhookRateLimiter();
    createAgentRateLimiter();
    createContactRateLimiter();
    createExportRateLimiter();
    expect(factory).toHaveBeenCalledTimes(5);
  });
});

describe('requireAuth passport error branch', () => {
  afterEach(() => vi.restoreAllMocks());

  it('forwards a passport strategy error to next', () => {
    const boom = new Error('strategy failed');
    vi.spyOn(passport, 'authenticate').mockImplementation(
      ((_s: unknown, _o: unknown, cb: (e: unknown, u: unknown) => void) =>
        () =>
          cb(boom, false)) as unknown as typeof passport.authenticate,
    );
    const next = vi.fn();
    requireAuth({} as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith(boom);
  });
});
