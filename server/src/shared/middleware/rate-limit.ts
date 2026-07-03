import type { Request, RequestHandler, Response } from 'express';
import rateLimit, { type Options } from 'express-rate-limit';
import { env } from '../../config/env.js';

export function rateLimitHandler(_req: Request, res: Response): void {
  const t = (res.req as Request & { t?: (k: string) => string }).t;
  const message = t ? t('security.error.rateLimited') : 'Too many requests. Try again later.';
  res.status(429).json({ error: message });
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
 * Auth-route limiter. Each call returns a fresh instance with its own in-memory
 * store — required for test isolation (`createApp()` per test) and idempotent
 * hot-reload restarts. The security-headers integration test at
 * `shared/middleware/security.test.ts` covers the 429 path with a dedicated
 * bucket override.
 */
export function createAuthRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    windowMs: overrides.windowMs ?? env.RATE_LIMIT_AUTH_WINDOW_MS,
    max: overrides.max ?? env.RATE_LIMIT_AUTH_MAX,
  });
}

/**
 * Webhook limiter. Runs BEFORE `express.raw` so a flood cannot burn signature
 * math. Never consumes the request body.
 */
export function createWebhookRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    windowMs: overrides.windowMs ?? env.RATE_LIMIT_WEBHOOK_WINDOW_MS,
    max: overrides.max ?? env.RATE_LIMIT_WEBHOOK_MAX,
  });
}

/**
 * Fleet-agent machine-surface limiter (`/api/agent`). Sized for one agent per
 * IP heartbeating every 30s + polling every 10s + batched log posts.
 */
export function createAgentRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    windowMs: overrides.windowMs ?? env.RATE_LIMIT_AGENT_WINDOW_MS,
    max: overrides.max ?? env.RATE_LIMIT_AGENT_MAX,
  });
}

/**
 * Public contact-form limiter (`/api/communication`). This surface is
 * unauthenticated and fires a real outbound email per request, so it must be
 * throttled hard to prevent mail-bombing / provider-quota abuse. Defaults to a
 * small bucket; overridable for tests.
 */
export function createContactRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    max: overrides.max ?? 5,
  });
}

/**
 * GDPR data-export limiter (`POST /api/legal/export`). Each call serializes the
 * caller's full account (user + all projects), so throttle it to prevent
 * DB/CPU amplification from a logged-in user. Correctly owner-scoped already;
 * this just caps the rate. Overridable for tests.
 */
export function createExportRateLimiter(overrides: RateLimitOverrides = {}): RequestHandler {
  return rateLimit({
    ...commonOptions,
    windowMs: overrides.windowMs ?? 15 * 60 * 1000,
    max: overrides.max ?? 10,
  });
}

// Back-compat singletons (unused after prompt 11 wiring; kept exported so
// downstream imports don't break).
export const authRateLimiter: RequestHandler = createAuthRateLimiter();
export const webhookRateLimiter: RequestHandler = createWebhookRateLimiter();
