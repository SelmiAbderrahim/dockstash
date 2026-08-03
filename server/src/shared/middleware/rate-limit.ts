import type { Request, RequestHandler, Response } from 'express';
import rateLimit, { type Options, type Store } from 'express-rate-limit';
import { env } from '../../config/env.js';

export function rateLimitHandler(_req: Request, res: Response): void {
  const t = (res.req as Request & { t?: (k: string) => string }).t;
  const message = t ? t('security.error.rateLimited') : 'Too many requests. Try again later.';
  res.status(429).json({ error: message });
}

/**
 * Minimal contract the shared Redis client needs to satisfy for rate-limit-redis.
 * Kept as an interface so the factory below can be swapped in tests without a
 * live Redis. Matches the ioredis surface `rate-limit-redis` requires.
 */
export interface RateLimitRedisClient {
  call: (command: string, ...args: unknown[]) => Promise<unknown>;
}

export type RedisStoreFactory = (redisUrl: string) => Store | null;

let redisStoreFactory: RedisStoreFactory | null = null;

/**
 * Inject a factory that returns a Redis-backed `express-rate-limit` `Store`
 * for the given REDIS_URL. `null` return disables the Redis path (falls back
 * to in-memory). Tests inject a mock; production wires the real ioredis-backed
 * factory at boot via {@link wireDefaultRedisStore}. Idempotent — setting the
 * factory twice replaces the previous value without side effects. See S1-02
 * in prompts/dockstash-security/findings.md.
 */
export function setRedisStoreFactory(factory: RedisStoreFactory | null): void {
  redisStoreFactory = factory;
}

export function getRedisStoreFactory(): RedisStoreFactory | null {
  return redisStoreFactory;
}

/**
 * Build the shared Redis store for a limiter when REDIS_URL is set outside
 * the test env. Returns `null` when no factory is wired OR REDIS_URL is unset
 * OR NODE_ENV === 'test' (test isolation demands per-process buckets).
 */
function buildStore(): Store | undefined {
  if (env.NODE_ENV === 'test') return undefined;
  if (!env.REDIS_URL) return undefined;
  if (!redisStoreFactory) return undefined;
  const store = redisStoreFactory(env.REDIS_URL);
  return store ?? undefined;
}

const commonOptions: Partial<Options> = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: rateLimitHandler,
};

export interface RateLimitOverrides {
  windowMs?: number;
  max?: number;
}

/**
 * Auth-route limiter. Each call returns a fresh instance. In production with
 * REDIS_URL set, buckets live in Redis so multi-instance deployments share
 * one credential-mutation budget (see S1-02). Falls back to in-memory when no
 * Redis is wired — required for test isolation (`createApp()` per test) and
 * idempotent hot-reload restarts on the shipped single-`api`-container compose.
 * The security-headers integration test at `shared/middleware/security.test.ts`
 * covers the 429 path with a dedicated bucket override.
 */
export function createAuthRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    store: buildStore(),
    windowMs: overrides.windowMs ?? env.RATE_LIMIT_AUTH_WINDOW_MS,
    max: overrides.max ?? env.RATE_LIMIT_AUTH_MAX,
  });
}

/**
 * Fleet-agent machine-surface limiter (`/api/agent`). Sized for one agent per
 * IP heartbeating every 30s + polling every 10s + batched log posts.
 * Redis-backed when configured — see {@link createAuthRateLimiter}.
 */
export function createAgentRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    store: buildStore(),
    windowMs: overrides.windowMs ?? env.RATE_LIMIT_AGENT_WINDOW_MS,
    max: overrides.max ?? env.RATE_LIMIT_AGENT_MAX,
  });
}

/**
 * Public contact-form limiter (`/api/communication`). This surface is
 * unauthenticated and fires a real outbound email per request, so it must be
 * throttled hard to prevent mail-bombing / provider-quota abuse. Defaults to a
 * small bucket; overridable for tests. Redis-backed when configured.
 */
export function createContactRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    store: buildStore(),
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    max: overrides.max ?? 5,
  });
}

/**
 * GDPR data-export limiter (`POST /api/legal/export`). Each call serializes the
 * caller's full account (user + all projects), so throttle it to prevent
 * DB/CPU amplification from a logged-in user. Correctly owner-scoped already;
 * this just caps the rate. Overridable for tests. Redis-backed when configured.
 */
export function createExportRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    store: buildStore(),
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    max: overrides.max ?? 10,
  });
}

// Back-compat singleton (unused after prompt 11 wiring; kept exported so
// downstream imports don't break).
export const authRateLimiter: RequestHandler = createAuthRateLimiter();
