import jwt from 'jsonwebtoken';
import { env } from '../../../config/env.js';
import type { OAuthProviderName } from './oauth-providers.js';

export const OAUTH_STATE_TTL_SECONDS = 600;
export const OAUTH_STATE_COOKIE = 'oauth_state';

const STATE_PURPOSE = 'oauth-state';

/**
 * CSRF protection for the OAuth flow, stateless (no session store):
 * the `state` query param is a short-lived HS256 JWT binding purpose +
 * provider + a random nonce, and the same nonce travels in an httpOnly
 * `sameSite=lax` cookie. The callback requires both to line up — the JWT
 * alone could be replayed by an attacker-initiated flow, the cookie alone
 * is not tamper-evident about which provider/flow it belongs to.
 */
export function createOAuthState(provider: OAuthProviderName, nonce: string): string {
  return jwt.sign({ purpose: STATE_PURPOSE, provider, nonce }, env.JWT_SECRET, {
    expiresIn: OAUTH_STATE_TTL_SECONDS,
  });
}

export function verifyOAuthState(
  state: string,
  provider: OAuthProviderName,
  cookieNonce: string | undefined,
): boolean {
  if (!cookieNonce) return false;
  let payload: unknown;
  try {
    payload = jwt.verify(state, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    return false;
  }
  if (typeof payload !== 'object' || payload === null) return false;
  const claims = payload as Record<string, unknown>;
  return (
    claims.purpose === STATE_PURPOSE &&
    claims.provider === provider &&
    typeof claims.nonce === 'string' &&
    claims.nonce === cookieNonce
  );
}

/**
 * Minimal `Cookie:` header parse for the one cookie this flow needs — the
 * app deliberately has no global cookie-parser middleware.
 */
export function readStateCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === OAUTH_STATE_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

/**
 * `sameSite: 'lax'` is load-bearing: the provider sends the browser back via
 * a top-level GET redirect, and strict cookies are not attached on that
 * navigation. Scoped to /api/auth so it never rides other API calls.
 */
export function stateCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax';
  secure: boolean;
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/api/auth',
    maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
  };
}
