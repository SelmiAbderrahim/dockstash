const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type OAuthProviderName = 'google' | 'github';

export const oauthStartUrl = (provider: OAuthProviderName): string =>
  `${API_BASE_URL}/auth/${provider}/start`;

/**
 * OAuth is a top-level navigation, not a fetch — the provider consent screen
 * must replace the page. Isolated one-liner so component tests can mock this
 * module instead of fighting jsdom's read-only `window.location`.
 */
export const redirectToOAuth = (provider: OAuthProviderName): void => {
  window.location.assign(oauthStartUrl(provider));
};

export interface OAuthCallbackPayload {
  token?: string;
  challengeId?: string;
  error?: string;
}

/**
 * The server hands the result back in the URL fragment (never query — keeps
 * tokens out of server logs and Referer headers): `#token=...`,
 * `#otp=1&challengeId=...` or `#error=<code>`.
 */
export const parseOAuthCallbackHash = (hash: string): OAuthCallbackPayload => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const payload: OAuthCallbackPayload = {};
  const token = params.get('token');
  const challengeId = params.get('challengeId');
  const error = params.get('error');
  if (token) payload.token = token;
  if (challengeId) payload.challengeId = challengeId;
  if (error) payload.error = error;
  return payload;
};
