import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { HttpError } from '../utils/http-error.js';

/**
 * SSRF guard for any server-side fetch that takes a user-supplied URL.
 * Owns surface #6 finding S6-01 (see
 * `prompts/dockstash-security/06-command-execution-ssrf-input-validation-opus-4.7.md`,
 * `.claude/rules/argv-only-spawn-and-ssrf.md`).
 *
 * Guarantees:
 *   1. Scheme allowlist — only `http:` / `https:`. Rejects `file:`,
 *      `gopher:`, `ftp:`, `ldap:`, etc.
 *   2. Host resolves to a PUBLIC IP. Rejects loopback, link-local
 *      (`169.254/16`, cloud metadata endpoint), IANA private ranges,
 *      IPv6 loopback, IPv6 unique-local (`fc00::/7`), and unspecified.
 *   3. Redirects are followed MANUALLY (`redirect: 'manual'`) and every
 *      hop is re-validated. A public URL that 302s to `127.0.0.1` is
 *      still rejected — the guard is not one-shot.
 *   4. Redirect chain capped at MAX_REDIRECTS to defeat loop DoS.
 *
 * NOT covered:
 *   - TOCTOU-style DNS re-bind after the guard resolves and before Node's
 *     `fetch` connects. The mitigation there is DNS pinning at the socket
 *     layer, out of scope for this pass.
 *   - Time-of-check vs time-of-connect for a rebinding-DNS attacker with
 *     TTL 0. Documented in `docs/security-model.en.md`.
 */

const MAX_REDIRECTS = 5;
const BLOCKED_CIDR_V4: ReadonlyArray<[number, number]> = [
  cidr('0.0.0.0/8'), // unspecified
  cidr('10.0.0.0/8'), // private
  cidr('127.0.0.0/8'), // loopback
  cidr('169.254.0.0/16'), // link-local (metadata endpoint 169.254.169.254)
  cidr('172.16.0.0/12'), // private
  cidr('192.0.0.0/24'), // IETF protocol assignments
  cidr('192.168.0.0/16'), // private
  cidr('198.18.0.0/15'), // benchmarking
  cidr('224.0.0.0/4'), // multicast
  cidr('240.0.0.0/4'), // reserved
];
function cidr(spec: string): [number, number] {
  const [addr, bitsStr] = spec.split('/');
  return [ipv4ToInt(addr!), Number(bitsStr)];
}

function ipv4ToInt(addr: string): number {
  // Callers only reach this with dotted-quad strings — either from
  // `isBlockedV4` where net.isIP() has already returned 4, or from the
  // frozen BLOCKED_CIDR_V4 seed list. No defensive branch needed.
  let out = 0;
  for (const p of addr.split('.')) {
    out = (out * 256 + Number(p)) >>> 0;
  }
  return out;
}

function isBlockedV4(addr: string): boolean {
  const int = ipv4ToInt(addr);
  for (const [net, bits] of BLOCKED_CIDR_V4) {
    const mask = (0xffffffff << (32 - bits)) >>> 0;
    if ((int & mask) === (net & mask)) return true;
  }
  return false;
}

function isBlockedV6(addr: string): boolean {
  const canonical = addr.toLowerCase();
  if (canonical === '::1' || canonical === '::') return true;
  // fc00::/7 unique-local (fc.., fd..).
  if (canonical.startsWith('fc') || canonical.startsWith('fd')) return true;
  // fe80::/10 link-local (fe8., fe9., fea., feb.).
  if (/^fe[89ab]/.test(canonical)) return true;
  return false;
}

async function resolveAndAssertPublic(host: string, t: (k: string) => string): Promise<void> {
  // WHATWG URL keeps IPv6 hostnames wrapped in brackets (`[::1]`); strip
  // them before net.isIP or the guard falls through to DNS.
  const unbracketed = host.replace(/^\[|\]$/g, '');
  const ipKind = isIP(unbracketed);
  if (ipKind === 4) {
    if (isBlockedV4(unbracketed)) throw HttpError.badRequest(t('errors.ssrf.private'));
    return;
  }
  if (ipKind === 6) {
    if (isBlockedV6(unbracketed)) throw HttpError.badRequest(t('errors.ssrf.private'));
    return;
  }
  let addrs: Array<{ address: string; family: number }>;
  try {
    addrs = await dnsLookup(unbracketed, { all: true, verbatim: true });
  } catch {
    throw HttpError.badRequest(t('errors.ssrf.dnsFailed'));
  }
  if (addrs.length === 0) throw HttpError.badRequest(t('errors.ssrf.dnsFailed'));
  for (const { address, family } of addrs) {
    if (family === 4 && isBlockedV4(address)) {
      throw HttpError.badRequest(t('errors.ssrf.private'));
    }
    if (family === 6 && isBlockedV6(address)) {
      throw HttpError.badRequest(t('errors.ssrf.private'));
    }
  }
}

/**
 * Validate a URL string against the SSRF policy. Throws `HttpError.badRequest`
 * with a localized key on rejection; returns the parsed `URL` on pass.
 */
export async function assertPublicUrl(
  raw: string,
  t: (k: string) => string = defaultT,
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw HttpError.badRequest(t('errors.ssrf.scheme'));
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw HttpError.badRequest(t('errors.ssrf.scheme'));
  }
  await resolveAndAssertPublic(url.hostname, t);
  return url;
}

export interface SafeFetchOptions {
  readonly method?: string;
  readonly headers?: Record<string, string>;
  readonly body?: string;
  readonly t?: (k: string) => string;
  /** Test seam. Defaults to global `fetch`. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * `fetch` variant that enforces the SSRF policy AND re-validates every
 * redirect hop. Callers must route ALL user-URL POST/GET/etc. through this
 * helper — enforced by the `alerting-fetch-safety.test.ts` meta-guard.
 */
export async function safeFetch(raw: string, opts: SafeFetchOptions = {}): Promise<Response> {
  const t = opts.t ?? defaultT;
  const fetchImpl = opts.fetchImpl ?? fetch;
  let url = await assertPublicUrl(raw, t);
  const init: RequestInit = {
    method: opts.method,
    headers: opts.headers,
    body: opts.body,
    redirect: 'manual',
  };
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetchImpl(url.toString(), init);
    if (res.status < 300 || res.status >= 400) return res;
    const location = res.headers.get('location');
    if (!location) return res;
    const next = new URL(location, url);
    url = await assertPublicUrl(next.toString(), t);
  }
  throw HttpError.badRequest(t('errors.ssrf.tooManyRedirects'));
}

function defaultT(k: string): string {
  return k;
}
