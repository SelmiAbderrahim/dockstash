import { describe, expect, it, vi } from 'vitest';
import { assertPublicUrl, safeFetch } from './safe-fetch.js';
import { HttpError } from '../utils/http-error.js';

/**
 * Coverage:
 *   - scheme allowlist (rejects file:, gopher:, ftp:, javascript:)
 *   - URL parse failure branch
 *   - literal IPv4 blocks (loopback, private, link-local metadata, 0.0.0.0,
 *     multicast, reserved)
 *   - literal IPv6 blocks (::1, ::, fc00::/7, fe80:.., ::0)
 *   - DNS-resolved public host → allowed; DNS-resolved private host → rejected
 *   - DNS lookup failure → error branch
 *   - the fetchImpl path completes on 200
 *   - redirect re-validation (redirect to loopback rejected AFTER the first hop)
 *   - too-many-redirects loop exit
 *   - redirect with no `location` returns final response
 */

// Deterministic DNS: only these hosts resolve; everything else throws.
type DnsMap = Record<string, Array<{ address: string; family: number }>>;

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(async (host: string) => {
    const map: DnsMap = {
      'public.example': [{ address: '203.0.113.10', family: 4 }],
      'loopback.example': [{ address: '127.0.0.5', family: 4 }],
      'private.example': [{ address: '10.1.2.3', family: 4 }],
      'metadata.example': [{ address: '169.254.169.254', family: 4 }],
      'mixed.example': [
        { address: '203.0.113.10', family: 4 },
        { address: '10.0.0.1', family: 4 },
      ],
      'v6-loopback.example': [{ address: '::1', family: 6 }],
      'v6-public.example': [{ address: '2606:4700::1111', family: 6 }],
      'redir-then-loop.example': [{ address: '203.0.113.11', family: 4 }],
      // Simulates a resolver returning zero A/AAAA records.
      'empty.example': [],
    };
    const hit = map[host];
    if (!hit) throw new Error('ENOTFOUND ' + host);
    return hit;
  }),
}));

async function expectHttp(status: number, key: string, p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(HttpError);
  await p.catch((err) => {
    expect((err as HttpError).status).toBe(status);
    expect((err as HttpError).message).toBe(key);
  });
}

describe('assertPublicUrl — scheme allowlist', () => {
  it('accepts http:// with a public host', async () => {
    const url = await assertPublicUrl('http://public.example/hook');
    expect(url.hostname).toBe('public.example');
  });

  it('accepts https:// with a public host', async () => {
    const url = await assertPublicUrl('https://public.example/hook');
    expect(url.protocol).toBe('https:');
  });

  it('rejects file:// (metadata / disk read attempts)', async () => {
    await expectHttp(400, 'errors.ssrf.scheme', assertPublicUrl('file:///etc/passwd'));
  });

  it('rejects gopher://', async () => {
    await expectHttp(400, 'errors.ssrf.scheme', assertPublicUrl('gopher://public.example/'));
  });

  it('rejects ftp://', async () => {
    await expectHttp(400, 'errors.ssrf.scheme', assertPublicUrl('ftp://public.example/'));
  });

  it('rejects garbage that URL cannot parse', async () => {
    await expectHttp(400, 'errors.ssrf.scheme', assertPublicUrl('not a url'));
  });
});

describe('assertPublicUrl — IPv4 blocks (literal)', () => {
  it('rejects 127.0.0.1 loopback', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://127.0.0.1/'));
  });
  it('rejects 10.x private', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://10.0.0.1/'));
  });
  it('rejects 172.16.x private', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://172.16.5.5/'));
  });
  it('rejects 192.168.x private', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://192.168.1.1/'));
  });
  it('rejects 169.254.169.254 (cloud metadata)', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://169.254.169.254/'));
  });
  it('rejects 0.0.0.0 unspecified', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://0.0.0.0/'));
  });
  it('rejects 224.0.0.1 multicast', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://224.0.0.1/'));
  });
  it('rejects 240.0.0.1 reserved', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://240.0.0.1/'));
  });
  it('rejects 198.18.0.1 benchmarking', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://198.18.0.1/'));
  });
  it('accepts a literal public IPv4', async () => {
    const url = await assertPublicUrl('http://8.8.8.8/');
    expect(url.hostname).toBe('8.8.8.8');
  });
});

describe('assertPublicUrl — IPv6 blocks (literal)', () => {
  it('rejects [::1] loopback', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://[::1]/'));
  });
  it('rejects [::] unspecified', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://[::]/'));
  });
  it('rejects fc00:: unique-local', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://[fc00::1]/'));
  });
  it('rejects fd00:: unique-local', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://[fd12:3456:789a::1]/'));
  });
  it('rejects fe80:: link-local', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://[fe80::1]/'));
  });
  it('accepts a literal public IPv6', async () => {
    const url = await assertPublicUrl('http://[2606:4700::1111]/');
    expect(url.hostname).toBe('[2606:4700::1111]');
  });
});

describe('assertPublicUrl — DNS resolution', () => {
  it('accepts a hostname that resolves to a public IPv4', async () => {
    const url = await assertPublicUrl('https://public.example/');
    expect(url.hostname).toBe('public.example');
  });

  it('rejects a hostname that resolves to 127.x', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('https://loopback.example/'));
  });

  it('rejects a hostname that resolves to a private IP', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://private.example/'));
  });

  it('rejects a hostname that resolves to the cloud metadata IP', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://metadata.example/'));
  });

  it('rejects when ANY resolved IP is blocked (mixed public + private)', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://mixed.example/'));
  });

  it('rejects a hostname that resolves to an IPv6 loopback', async () => {
    await expectHttp(400, 'errors.ssrf.private', assertPublicUrl('http://v6-loopback.example/'));
  });

  it('accepts a hostname that resolves to a public IPv6', async () => {
    const url = await assertPublicUrl('http://v6-public.example/');
    expect(url.hostname).toBe('v6-public.example');
  });

  it('rejects when DNS lookup fails', async () => {
    await expectHttp(400, 'errors.ssrf.dnsFailed', assertPublicUrl('http://nx.example/'));
  });

  it('rejects when DNS returns zero records', async () => {
    await expectHttp(400, 'errors.ssrf.dnsFailed', assertPublicUrl('http://empty.example/'));
  });
});

describe('safeFetch — happy path and defaults', () => {
  it('POSTs to a public URL and returns the 200 response', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 200,
          ok: true,
          headers: new Headers(),
          text: async () => 'ok',
        }) as unknown as Response,
    );
    const res = await safeFetch('https://public.example/hook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      fetchImpl,
    });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const firstCall = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0]!;
    const init = firstCall[1];
    expect(init.redirect).toBe('manual');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{}');
  });

  it('returns a non-redirect 4xx/5xx response unchanged', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 500,
          ok: false,
          headers: new Headers(),
          text: async () => 'err',
        }) as unknown as Response,
    );
    const res = await safeFetch('https://public.example/', { fetchImpl });
    expect(res.status).toBe(500);
  });

  it('rejects a bad scheme BEFORE calling fetch', async () => {
    const fetchImpl = vi.fn();
    await expectHttp(400, 'errors.ssrf.scheme', safeFetch('gopher://x/', { fetchImpl }));
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a private host BEFORE calling fetch', async () => {
    const fetchImpl = vi.fn();
    await expectHttp(
      400,
      'errors.ssrf.private',
      safeFetch('http://169.254.169.254/', { fetchImpl }),
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('safeFetch — redirect re-validation', () => {
  it('re-validates a redirect: public → loopback → rejected', async () => {
    let hop = 0;
    const fetchImpl = vi.fn(async () => {
      hop++;
      if (hop === 1) {
        return {
          status: 302,
          ok: false,
          headers: new Headers({ location: 'http://127.0.0.1/inner' }),
          text: async () => '',
        } as unknown as Response;
      }
      throw new Error('second hop must not fire');
    });
    await expectHttp(
      400,
      'errors.ssrf.private',
      safeFetch('https://public.example/', { fetchImpl }),
    );
    // The guard rejected on the SECOND assertPublicUrl, before the 2nd fetch.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('follows a redirect to another public host, returns final 200', async () => {
    let hop = 0;
    const fetchImpl = vi.fn(async () => {
      hop++;
      if (hop === 1) {
        return {
          status: 301,
          ok: false,
          headers: new Headers({ location: 'https://v6-public.example/final' }),
          text: async () => '',
        } as unknown as Response;
      }
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        text: async () => 'final',
      } as unknown as Response;
    });
    const res = await safeFetch('https://public.example/', { fetchImpl });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns the redirect response unchanged when no Location header is present', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 302,
          ok: false,
          headers: new Headers(),
          text: async () => '',
        }) as unknown as Response,
    );
    const res = await safeFetch('https://public.example/', { fetchImpl });
    expect(res.status).toBe(302);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves a relative Location against the current URL and re-validates', async () => {
    let hop = 0;
    const seen: string[] = [];
    const fetchImpl = vi.fn(async (input: unknown) => {
      seen.push(String(input));
      hop++;
      if (hop === 1) {
        return {
          status: 302,
          ok: false,
          headers: new Headers({ location: '/next' }),
          text: async () => '',
        } as unknown as Response;
      }
      return {
        status: 200,
        ok: true,
        headers: new Headers(),
        text: async () => 'ok',
      } as unknown as Response;
    });
    const res = await safeFetch('https://public.example/first', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(res.status).toBe(200);
    expect(seen[1]).toBe('https://public.example/next');
  });

  it('caps the redirect chain (throws tooManyRedirects)', async () => {
    const fetchImpl = vi.fn(
      async () =>
        ({
          status: 302,
          ok: false,
          headers: new Headers({ location: 'https://public.example/next' }),
          text: async () => '',
        }) as unknown as Response,
    );
    await expectHttp(
      400,
      'errors.ssrf.tooManyRedirects',
      safeFetch('https://public.example/', { fetchImpl }),
    );
    // MAX_REDIRECTS = 5 → 6 fetch calls before the loop exits.
    expect(fetchImpl.mock.calls.length).toBe(6);
  });
});

describe('safeFetch — translator seam', () => {
  it('runs the caller-supplied translator on error messages', async () => {
    const t = (k: string) => `translated:${k}`;
    const p = safeFetch('gopher://x/', { fetchImpl: vi.fn(), t });
    await expect(p).rejects.toThrow('translated:errors.ssrf.scheme');
  });
});

describe('safeFetch — default fetch fallback', () => {
  it('falls back to global fetch when no fetchImpl is supplied', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      status: 200,
      ok: true,
      headers: new Headers(),
      text: async () => 'default',
    } as unknown as Response);
    const res = await safeFetch('https://public.example/');
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});
