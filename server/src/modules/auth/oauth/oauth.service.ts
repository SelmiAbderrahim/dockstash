import { randomBytes } from 'node:crypto';
import { DEFAULT_LOCALE, type SupportedLocale } from '../../../shared/i18n/index.js';
import { ROLE_MEMBER, User, type UserHydrated } from '../../users/index.js';
import { hashPassword } from '../auth.service.js';
import { oauthHttp } from './oauth-http.js';
import {
  PROVIDER_DEFINITIONS,
  redirectUriFor,
  type OAuthProviderName,
} from './oauth-providers.js';

/**
 * Machine-readable failure codes for the callback leg. The browser is mid
 * top-level navigation there, so the controller translates each code into a
 * redirect fragment (`#error=<code>`) that the client renders localized.
 */
export type OAuthFlowErrorCode =
  | 'accessDenied'
  | 'invalidState'
  | 'emailUnavailable'
  | 'providerError';

export class OAuthFlowError extends Error {
  constructor(readonly code: OAuthFlowErrorCode) {
    super(`OAuth flow failed: ${code}`);
    this.name = 'OAuthFlowError';
  }
}

export type OAuthProfile = {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
};

export function buildAuthorizeUrl(name: OAuthProviderName, state: string): string {
  const def = PROVIDER_DEFINITIONS[name];
  const params = new URLSearchParams({
    client_id: def.clientId() ?? '',
    redirect_uri: redirectUriFor(name),
    response_type: 'code',
    scope: def.scopes.join(' '),
    state,
  });
  if (name === 'google') {
    params.set('access_type', 'online');
    params.set('prompt', 'select_account');
  }
  return `${def.authorizeUrl}?${params.toString()}`;
}

export async function exchangeCode(name: OAuthProviderName, code: string): Promise<string> {
  const def = PROVIDER_DEFINITIONS[name];
  const body = new URLSearchParams({
    client_id: def.clientId() ?? '',
    client_secret: def.clientSecret() ?? '',
    code,
    redirect_uri: redirectUriFor(name),
    grant_type: 'authorization_code',
  });
  const response = await oauthHttp(def.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      // GitHub returns urlencoded unless asked for JSON; Google always JSON.
      Accept: 'application/json',
    },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new OAuthFlowError('providerError');
  }
  const data = (await response.json()) as { access_token?: unknown };
  if (typeof data.access_token !== 'string' || data.access_token.length === 0) {
    throw new OAuthFlowError('providerError');
  }
  return data.access_token;
}

type GoogleUserinfo = {
  sub?: unknown;
  email?: unknown;
  email_verified?: unknown;
  given_name?: unknown;
  family_name?: unknown;
};

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const response = await oauthHttp('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new OAuthFlowError('providerError');
  }
  const info = (await response.json()) as GoogleUserinfo;
  if (
    typeof info.sub !== 'string' ||
    typeof info.email !== 'string' ||
    info.email_verified !== true
  ) {
    throw new OAuthFlowError('emailUnavailable');
  }
  return {
    providerId: info.sub,
    email: info.email.toLowerCase(),
    firstName: typeof info.given_name === 'string' ? info.given_name : '',
    lastName: typeof info.family_name === 'string' ? info.family_name : '',
  };
}

type GitHubUser = { id?: unknown; name?: unknown; login?: unknown };
type GitHubEmail = { email?: unknown; primary?: unknown; verified?: unknown };

function splitGitHubName(user: GitHubUser): { firstName: string; lastName: string } {
  const fallback = typeof user.login === 'string' ? user.login : '';
  if (typeof user.name !== 'string' || user.name.trim() === '') {
    return { firstName: fallback, lastName: '' };
  }
  const parts = user.name.trim().split(/\s+/);
  return { firstName: parts.slice(0, 1).join(''), lastName: parts.slice(1).join(' ') };
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    // GitHub's API rejects requests without a User-Agent.
    'User-Agent': 'dockstash',
  };
  const userResponse = await oauthHttp('https://api.github.com/user', { headers });
  if (!userResponse.ok) {
    throw new OAuthFlowError('providerError');
  }
  const user = (await userResponse.json()) as GitHubUser;
  if (typeof user.id !== 'number' && typeof user.id !== 'string') {
    throw new OAuthFlowError('providerError');
  }

  const emailsResponse = await oauthHttp('https://api.github.com/user/emails', { headers });
  if (!emailsResponse.ok) {
    throw new OAuthFlowError('emailUnavailable');
  }
  const emails = (await emailsResponse.json()) as GitHubEmail[];
  const primary = Array.isArray(emails)
    ? emails.find((e) => e.primary === true && e.verified === true && typeof e.email === 'string')
    : undefined;
  if (!primary) {
    throw new OAuthFlowError('emailUnavailable');
  }

  return {
    providerId: String(user.id),
    email: (primary.email as string).toLowerCase(),
    ...splitGitHubName(user),
  };
}

export async function fetchProfile(
  name: OAuthProviderName,
  accessToken: string,
): Promise<OAuthProfile> {
  return name === 'google' ? fetchGoogleProfile(accessToken) : fetchGitHubProfile(accessToken);
}

const PROVIDER_ID_FIELD: Record<OAuthProviderName, 'googleId' | 'githubId'> = {
  google: 'googleId',
  github: 'githubId',
};

/**
 * Resolve an OAuth profile to a local account:
 * 1. provider id match → existing OAuth-linked account;
 * 2. email match → auto-link the provider to the existing (password) account,
 *    upgrading `emailVerified` — the provider attested the address, and email
 *    control is already this app's trust root (password reset);
 * 3. otherwise create a Member with a random unusable password. The provider
 *    verified the email, so no verification email is sent.
 */
export async function findOrCreateOAuthUser(
  name: OAuthProviderName,
  profile: OAuthProfile,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<UserHydrated> {
  const idField = PROVIDER_ID_FIELD[name];

  const byProviderId = await User.findOne({ [idField]: profile.providerId });
  if (byProviderId) return byProviderId;

  const byEmail = await User.findOne({ email: profile.email });
  if (byEmail) {
    byEmail.set(idField, profile.providerId);
    if (!byEmail.emailVerified) {
      byEmail.emailVerified = true;
      byEmail.emailVerificationToken = undefined;
      byEmail.emailVerificationExpires = undefined;
    }
    await byEmail.save();
    return byEmail;
  }

  const password = await hashPassword(randomBytes(48).toString('hex'));
  const created = (await User.create({
    email: profile.email,
    password,
    profile: { firstName: profile.firstName, lastName: profile.lastName },
    role: ROLE_MEMBER,
    language: locale,
    emailVerified: true,
    [idField]: profile.providerId,
  })) as UserHydrated;
  return created;
}
