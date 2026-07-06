import { randomBytes } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { asyncHandler } from '../../../shared/utils/async-handler.js';
import { HttpError } from '../../../shared/utils/http-error.js';
import { extractIp } from '../../audit/index.js';
import { ROLE_SUPERADMIN } from '../../users/index.js';
import { issueLoginResponse } from '../auth.service.js';
import {
  computeFingerprint,
  createLoginChallenge,
  isTrustedDevice,
} from '../login-otp.service.js';
import {
  enabledProviders,
  isOAuthProviderName,
  isProviderEnabled,
  type OAuthProviderName,
} from './oauth-providers.js';
import {
  OAUTH_STATE_COOKIE,
  createOAuthState,
  readStateCookie,
  stateCookieOptions,
  verifyOAuthState,
} from './oauth-state.js';
import { oauthCallbackQuerySchema } from './oauth.schema.js';
import {
  OAuthFlowError,
  buildAuthorizeUrl,
  exchangeCode,
  fetchProfile,
  findOrCreateOAuthUser,
} from './oauth.service.js';

function clientCallbackUrl(): string {
  return `${env.CLIENT_URL.replace(/\/$/, '')}/oauth/callback`;
}

/**
 * Public capability probe — which providers have credentials configured.
 * Mounted OUTSIDE the auth rate limiter (see app.ts): the client fetches it
 * on every login/register render, and inside the 10-req/15-min budget it
 * would starve real login attempts.
 */
export const oauthProviders: RequestHandler = (_req, res) => {
  res.status(200).json(enabledProviders());
};

/**
 * First leg: same-app navigation, so plain JSON errors (404) are fine here.
 * Sets the state nonce cookie and bounces to the provider's consent screen.
 */
export const oauthStart: RequestHandler = asyncHandler(async (req, res) => {
  const provider = String(req.params.provider);
  if (!isOAuthProviderName(provider) || !isProviderEnabled(provider)) {
    throw HttpError.notFound('auth.oauth.providerNotEnabled');
  }
  const nonce = randomBytes(16).toString('hex');
  res.cookie(OAUTH_STATE_COOKIE, nonce, stateCookieOptions());
  res.redirect(302, buildAuthorizeUrl(provider, createOAuthState(provider, nonce)));
});

/**
 * Second leg: the browser arrives via a top-level redirect from the provider,
 * so EVERY outcome — success, OTP challenge, or failure — must itself be a
 * redirect back into the SPA. Fragments (not query strings) carry the payload
 * so tokens never reach server logs or Referer headers.
 */
export const oauthCallback: RequestHandler = asyncHandler(async (req, res) => {
  const redirectWithError = (response: Response, code: string): void => {
    response.redirect(302, `${clientCallbackUrl()}#error=${code}`);
  };

  try {
    const providerParam = String(req.params.provider);
    if (!isOAuthProviderName(providerParam) || !isProviderEnabled(providerParam)) {
      throw new OAuthFlowError('providerError');
    }
    const provider: OAuthProviderName = providerParam;

    const { code, state, error } = oauthCallbackQuerySchema.parse(req.query);
    if (error) {
      throw new OAuthFlowError(error === 'access_denied' ? 'accessDenied' : 'providerError');
    }

    const cookieNonce = readStateCookie(req.headers.cookie);
    if (!code || !state || !verifyOAuthState(state, provider, cookieNonce)) {
      throw new OAuthFlowError('invalidState');
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: stateCookieOptions().path });

    const accessToken = await exchangeCode(provider, code);
    const profile = await fetchProfile(provider, accessToken);
    const user = await findOrCreateOAuthUser(provider, profile, req.language);

    // Same second factor as password login: superadmin from an unknown
    // device gets an email-OTP challenge instead of a token.
    if (user.role === ROLE_SUPERADMIN) {
      const ip = extractIp(req);
      const userAgent = req.headers['user-agent'];
      const fingerprint = computeFingerprint(ip, userAgent);
      const trusted = await isTrustedDevice(user._id.toString(), fingerprint);
      if (!trusted) {
        const { challengeId } = await createLoginChallenge(user, {
          ip,
          userAgent,
          locale: req.language,
        });
        res.redirect(302, `${clientCallbackUrl()}#otp=1&challengeId=${challengeId}`);
        return;
      }
    }

    const { token } = issueLoginResponse(user);
    res.redirect(302, `${clientCallbackUrl()}#token=${encodeURIComponent(token)}`);
  } catch (err) {
    if (err instanceof OAuthFlowError) {
      redirectWithError(res, err.code);
      return;
    }
    // Unexpected failure (network fault, DB error, malformed provider JSON):
    // never surface internals to the redirect; log and degrade to the
    // generic provider error.
    logger.error({ err }, 'oauth callback failed');
    redirectWithError(res, 'providerError');
  }
});
