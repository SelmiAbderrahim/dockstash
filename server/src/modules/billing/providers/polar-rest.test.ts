import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { env } from '../../../config/env.js';
import {
  clearPolarRestClient,
  createPolarRestClient,
  getPolarBaseUrl,
  getPolarRestClient,
  getPolarServer,
  listAllPolarPages,
  PolarApiError,
  setPolarRestClientFactory,
  type PolarPaginatedResponse,
  type PolarRestClient,
} from './polar-rest.js';
import {
  __resetPolarSecretsForTests,
} from '../polar-secrets.js';

type EnvMutable = Record<string, string | undefined>;

function setEnv(key: string, value: string | undefined): string | undefined {
  const prev = (env as unknown as EnvMutable)[key];
  (env as unknown as EnvMutable)[key] = value;
  return prev;
}

/** Build a fetch stub returning a real Response with the given status/body. */
function fetchReturning(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): { impl: typeof fetch; calls: Array<{ url: string; init: RequestInit | undefined }> } {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const lowerHeaders = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (name: string) => lowerHeaders.get(name.toLowerCase()) ?? null },
      text: async () => body,
    } as unknown as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('polar-rest / server + base url', () => {
  afterEach(() => {
    setEnv('POLAR_SERVER', undefined);
  });

  it('getPolarServer returns production when env is production', () => {
    setEnv('POLAR_SERVER', 'production');
    expect(getPolarServer()).toBe('production');
    expect(getPolarBaseUrl()).toBe('https://api.polar.sh/v1');
  });

  it('getPolarServer defaults to sandbox otherwise', () => {
    setEnv('POLAR_SERVER', 'anything-else');
    expect(getPolarServer()).toBe('sandbox');
    expect(getPolarBaseUrl('sandbox')).toBe('https://sandbox-api.polar.sh/v1');
    expect(getPolarBaseUrl('production')).toBe('https://api.polar.sh/v1');
  });
});

describe('polar-rest / createPolarRestClient.request', () => {
  it('defaults to GET and returns decoded JSON, honouring server override', async () => {
    const { impl, calls } = fetchReturning(200, JSON.stringify({ ok: true }));
    const client = createPolarRestClient({ server: 'production', token: 'tok', fetchImpl: impl });
    expect(client.server).toBe('production');
    expect(client.baseUrl).toBe('https://api.polar.sh/v1');
    const res = await client.request<{ ok: boolean }>('subscriptions/');
    expect(res.ok).toBe(true);
    expect(calls[0]?.url).toBe('https://api.polar.sh/v1/subscriptions/');
    const init = calls[0]?.init as RequestInit;
    expect(init.method).toBe('GET');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('serialises body, sets Content-Type + Idempotency-Key, and builds query', async () => {
    const { impl, calls } = fetchReturning(200, JSON.stringify({ id: 'x' }));
    const client = createPolarRestClient({ server: 'sandbox', token: 'tok', fetchImpl: impl });
    await client.request('/checkouts/', {
      method: 'POST',
      body: { a: 1 },
      idempotencyKey: 'idem-1',
      query: { active: true, page: 2, skip: undefined },
    });
    const call = calls[0]!;
    expect(call.url).toBe('https://sandbox-api.polar.sh/v1/checkouts/?active=true&page=2');
    const init = call.init as RequestInit;
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Idempotency-Key']).toBe('idem-1');
  });

  it('returns null for 204 No Content', async () => {
    const { impl } = fetchReturning(204, '');
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    const res = await client.request('/subscriptions/x', { method: 'DELETE' });
    expect(res).toBeNull();
  });

  it('returns null when a 200 body is empty', async () => {
    const { impl } = fetchReturning(200, '');
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    expect(await client.request('/x')).toBeNull();
  });

  it('returns raw text when a 200 body is not JSON', async () => {
    const { impl } = fetchReturning(200, 'plain-text');
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    expect(await client.request('/x')).toBe('plain-text');
  });

  it('throws PolarApiError with body.error code + detail message + retry-after', async () => {
    const { impl } = fetchReturning(
      429,
      JSON.stringify({ error: 'rate_limit_exceeded', detail: 'slow down' }),
      { 'retry-after': '30' },
    );
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    await expect(client.request('/x')).rejects.toMatchObject({
      name: 'PolarApiError',
      status: 429,
      code: 'rate_limit_exceeded',
      retryAfterSeconds: 30,
    });
  });

  it('maps status codes to canned error codes when body has no error field', async () => {
    async function codeFor(status: number, body: string, headers: Record<string, string> = {}) {
      const { impl } = fetchReturning(status, body, headers);
      const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
      try {
        await client.request('/x');
        throw new Error('expected throw');
      } catch (err) {
        return err as PolarApiError;
      }
    }
    expect((await codeFor(422, JSON.stringify({ detail: 'bad' }))).code).toBe('validation_error');
    expect((await codeFor(404, JSON.stringify({ message: 'missing' }))).code).toBe('not_found');
    expect((await codeFor(500, '')).code).toBe('server_error');
    expect((await codeFor(418, '')).code).toBe('http_error');
    // Non-finite retry-after → undefined.
    const nonFinite = await codeFor(429, '', { 'retry-after': 'soon' });
    expect(nonFinite.retryAfterSeconds).toBeUndefined();
  });

  it('falls back to a generic message when body has neither detail nor message', async () => {
    const { impl } = fetchReturning(400, JSON.stringify({ foo: 'bar' }));
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    await expect(client.request('/x')).rejects.toThrow(/status 400/);
  });

  it('uses the generic message for a non-object error body', async () => {
    const { impl } = fetchReturning(400, 'null');
    const client = createPolarRestClient({ token: 'tok', fetchImpl: impl });
    await expect(client.request('/x')).rejects.toThrow(/status 400/);
  });
});

describe('polar-rest / PolarApiError', () => {
  it('carries all fields', () => {
    const e = new PolarApiError({ status: 500, code: 'server_error', detail: { a: 1 }, message: 'boom' });
    expect(e.status).toBe(500);
    expect(e.code).toBe('server_error');
    expect(e.detail).toEqual({ a: 1 });
    expect(e.message).toBe('boom');
    expect(e.retryAfterSeconds).toBeUndefined();
  });
});

describe('polar-rest / getPolarRestClient factory + cache', () => {
  beforeEach(() => {
    setPolarRestClientFactory(null);
    __resetPolarSecretsForTests();
  });

  afterEach(() => {
    setPolarRestClientFactory(null);
    __resetPolarSecretsForTests();
    setEnv('POLAR_ACCESS_TOKEN', undefined);
    __resetPolarSecretsForTests();
  });

  it('throws when no token is configured', () => {
    setEnv('POLAR_ACCESS_TOKEN', undefined);
    __resetPolarSecretsForTests();
    clearPolarRestClient();
    expect(() => getPolarRestClient()).toThrow(/POLAR_ACCESS_TOKEN is not configured/);
  });

  it('uses the injected factory and caches the result until cleared', () => {
    setEnv('POLAR_ACCESS_TOKEN', 'polar_pat_abc');
    __resetPolarSecretsForTests();
    let built = 0;
    let seenToken = '';
    const fake: PolarRestClient = {
      server: 'sandbox',
      baseUrl: 'https://sandbox-api.polar.sh/v1',
      request: async () => null as never,
    };
    setPolarRestClientFactory((token) => {
      built += 1;
      seenToken = token;
      return fake;
    });
    const first = getPolarRestClient();
    const second = getPolarRestClient();
    expect(first).toBe(fake);
    expect(second).toBe(fake);
    expect(built).toBe(1);
    expect(seenToken).toBe('polar_pat_abc');
    clearPolarRestClient();
    getPolarRestClient();
    expect(built).toBe(2);
  });

  it('builds a default client (no factory) when a token exists', () => {
    setEnv('POLAR_ACCESS_TOKEN', 'polar_pat_def');
    __resetPolarSecretsForTests();
    setPolarRestClientFactory(null);
    clearPolarRestClient();
    const client = getPolarRestClient();
    expect(client.baseUrl).toContain('polar.sh');
  });
});

describe('polar-rest / listAllPolarPages', () => {
  it('stops after the first page when max_page is 1', async () => {
    const pages: number[] = [];
    const fetchPage = async (page: number): Promise<PolarPaginatedResponse<number>> => {
      pages.push(page);
      return { items: [page], pagination: { total_count: 1, max_page: 1 } };
    };
    expect(await listAllPolarPages(fetchPage)).toEqual([1]);
    expect(pages).toEqual([1]);
  });

  it('walks every page up to max_page', async () => {
    const fetchPage = async (page: number): Promise<PolarPaginatedResponse<string>> => ({
      items: [`p${page}`],
      pagination: { total_count: 3, max_page: 3 },
    });
    expect(await listAllPolarPages(fetchPage)).toEqual(['p1', 'p2', 'p3']);
  });
});
