import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env.js';
import { HttpError } from '../utils/http-error.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF for cookie-borne JWTs.
 *
 * The dockstash API extracts JWTs from `Authorization: JWT <token>`, so most
 * mutating calls arrive as bearer requests and are CSRF-exempt (see
 * `docs/security-model.en.md`). If a future surface authenticates via cookie,
 * the client MUST call `GET /api/security/csrf-token`, receive the cookie +
 * echo it in the `x-csrf-token` header on the mutating request. Missing or
 * mismatched tokens are rejected with `HttpError.forbidden`.
 */
export const requireCsrf: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();

  // Bearer-token requests are exempt. Documented in the security model.
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.length > 0) return next();

  const cookieToken = readCookie(req, env.CSRF_COOKIE_NAME);
  const headerRaw = req.headers[env.CSRF_HEADER_NAME.toLowerCase()];
  const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

  if (!cookieToken || !headerToken || !constantTimeEquals(cookieToken, String(headerToken))) {
    const t = (req as Request & { t?: (k: string) => string }).t;
    const msg = t ? t('security.error.csrfInvalid') : 'CSRF token missing or invalid.';
    next(HttpError.forbidden(msg));
    return;
  }
  next();
};

/** Issue a fresh CSRF token cookie + echo it in the response body. */
export const issueCsrfToken: RequestHandler = (_req, res) => {
  const token = randomBytes(32).toString('base64url');
  res.cookie(env.CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/',
  });
  res.status(200).json({ csrfToken: token });
};

function readCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      const raw = part.slice(idx + 1).trim();
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    }
  }
  return undefined;
}

function constantTimeEquals(a: string, b: string): boolean {
  const buf1 = Buffer.from(a, 'utf8');
  const buf2 = Buffer.from(b, 'utf8');
  if (buf1.length !== buf2.length) return false;
  return timingSafeEqual(buf1, buf2);
}
