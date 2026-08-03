import { env } from '../../../config/env.js';

export const OAUTH_PROVIDERS = ['google', 'github'] as const;
export type OAuthProviderName = (typeof OAUTH_PROVIDERS)[number];

export interface OAuthProviderDefinition {
  name: OAuthProviderName;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  // Read lazily so tests can mutate `env.GOOGLE_CLIENT_ID` etc. per-case,
  // the same way auth.test.ts mutates env.RESEND_API_KEY.
  clientId(): string | undefined;
  clientSecret(): string | undefined;
}

export const PROVIDER_DEFINITIONS: Record<OAuthProviderName, OAuthProviderDefinition> = {
  google: {
    name: 'google',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['openid', 'email', 'profile'],
    clientId: () => env.GOOGLE_CLIENT_ID,
    clientSecret: () => env.GOOGLE_CLIENT_SECRET,
  },
  github: {
    name: 'github',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scopes: ['read:user', 'user:email'],
    clientId: () => env.GITHUB_CLIENT_ID,
    clientSecret: () => env.GITHUB_CLIENT_SECRET,
  },
};

export function isOAuthProviderName(value: string): value is OAuthProviderName {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export function isProviderEnabled(name: OAuthProviderName): boolean {
  const def = PROVIDER_DEFINITIONS[name];
  return Boolean(def.clientId() && def.clientSecret());
}

export function enabledProviders(): Record<OAuthProviderName, boolean> {
  return {
    google: isProviderEnabled('google'),
    github: isProviderEnabled('github'),
  };
}

export function redirectUriFor(name: OAuthProviderName): string {
  return `${env.SERVER_URL.replace(/\/$/, '')}/api/auth/${name}/callback`;
}
