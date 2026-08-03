/**
 * Injection seam for outbound OAuth HTTP calls (token exchange + profile
 * fetch). Tests replace this via `setOAuthHttp()` to observe outbound calls
 * without hitting Google/GitHub — mirrors `setResendTransport` in
 * communication/mailers/resend.ts.
 */
export type OAuthHttp = (url: string, init?: RequestInit) => Promise<Response>;

let override: OAuthHttp | null = null;

export function setOAuthHttp(fn: OAuthHttp | null): void {
  override = fn;
}

export function oauthHttp(url: string, init?: RequestInit): Promise<Response> {
  /* c8 ignore next -- the fetch fallback only fires outside tests (real network) */
  return (override ?? fetch)(url, init);
}
