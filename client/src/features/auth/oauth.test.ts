import { afterEach, describe, expect, it, vi } from 'vitest';
import { oauthStartUrl, parseOAuthCallbackHash, redirectToOAuth } from './oauth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('oauthStartUrl', () => {
  it('builds provider start URLs from the API base', () => {
    expect(oauthStartUrl('google')).toBe('/api/auth/google/start');
    expect(oauthStartUrl('github')).toBe('/api/auth/github/start');
  });

  it('falls back to "/api" when VITE_API_BASE_URL is unset', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', undefined as unknown as string);
    const fresh = await import('./oauth');
    expect(fresh.oauthStartUrl('google')).toBe('/api/auth/google/start');
  });
});

describe('redirectToOAuth', () => {
  it('navigates the whole page to the provider start URL', () => {
    const original = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, assign },
    });
    redirectToOAuth('github');
    expect(assign).toHaveBeenCalledWith('/api/auth/github/start');
    Object.defineProperty(window, 'location', { configurable: true, value: original });
  });
});

describe('parseOAuthCallbackHash', () => {
  it('parses a token fragment', () => {
    expect(parseOAuthCallbackHash('#token=JWT%20abc')).toEqual({ token: 'JWT abc' });
  });

  it('parses an OTP challenge fragment', () => {
    expect(parseOAuthCallbackHash('#otp=1&challengeId=ch-1')).toEqual({ challengeId: 'ch-1' });
  });

  it('parses an error fragment', () => {
    expect(parseOAuthCallbackHash('#error=accessDenied')).toEqual({ error: 'accessDenied' });
  });

  it('returns an empty payload for empty or garbage hashes', () => {
    expect(parseOAuthCallbackHash('')).toEqual({});
    expect(parseOAuthCallbackHash('#')).toEqual({});
    expect(parseOAuthCallbackHash('#unrelated=1&&&')).toEqual({});
  });
});
