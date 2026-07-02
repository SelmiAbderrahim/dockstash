import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { apiClient, ApiError } from './client';

interface FakeResponseInit {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  json?: unknown;
  text?: string;
}

const fakeResponse = (init: FakeResponseInit): Response =>
  ({
    ok: init.ok ?? true,
    status: init.status ?? 200,
    headers: { get: (_: string) => init.contentType ?? null },
    json: async () => init.json,
    text: async () => init.text ?? '',
  }) as unknown as Response;

const fetchSpy = () => vi.spyOn(globalThis, 'fetch');

beforeEach(() => {
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiClient', () => {
  it('resolves parsed JSON for a 2xx response and resolves the base URL', async () => {
    const spy = fetchSpy().mockResolvedValue(
      fakeResponse({ contentType: 'application/json', json: { hello: 'world' } }),
    );
    const result = await apiClient<{ hello: string }>('/thing');
    expect(result).toEqual({ hello: 'world' });
    expect(spy).toHaveBeenCalledWith('/api/thing', expect.any(Object));
  });

  it('throws an ApiError carrying status and data on a non-2xx response', async () => {
    fetchSpy().mockResolvedValue(
      fakeResponse({ ok: false, status: 422, contentType: 'application/json', json: { error: 'bad' } }),
    );
    const err = await apiClient('/broken').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(422);
    expect((err as ApiError).data).toEqual({ error: 'bad' });
  });

  it('attaches the token cookie as the Authorization header when auth is true', async () => {
    document.cookie = `token=${encodeURIComponent('JWT abc123')}; path=/`;
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: 'ok' }));
    await apiClient('/secure', { auth: true });
    const headers = spy.mock.calls[0]![1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('JWT abc123');
  });

  it('does not attach an Authorization header when auth is true but no token exists', async () => {
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: 'ok' }));
    await apiClient('/secure', { auth: true });
    const headers = spy.mock.calls[0]![1]?.headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('serialises a JSON body and sets the Content-Type header', async () => {
    const spy = fetchSpy().mockResolvedValue(
      fakeResponse({ contentType: 'application/json', json: {} }),
    );
    await apiClient('/create', { method: 'POST', body: { a: 1 } });
    const options = spy.mock.calls[0]![1];
    expect(options?.body).toBe(JSON.stringify({ a: 1 }));
    expect((options?.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('returns raw text for a non-JSON / empty response', async () => {
    fetchSpy().mockResolvedValue(fakeResponse({ contentType: 'text/plain', text: 'plain body' }));
    const result = await apiClient<string>('/text');
    expect(result).toBe('plain body');
  });

  it('uses an absolute URL verbatim without prefixing the base', async () => {
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: '' }));
    await apiClient('http://example.com/external');
    expect(spy).toHaveBeenCalledWith('http://example.com/external', expect.any(Object));
  });

  it("defaults to cache: 'no-store' so stale API responses are never replayed", async () => {
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: '' }));
    await apiClient('/thing');
    expect(spy.mock.calls[0]![1]?.cache).toBe('no-store');
  });

  it('lets a caller override the cache mode', async () => {
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: '' }));
    await apiClient('/thing', { cache: 'reload' });
    expect(spy.mock.calls[0]![1]?.cache).toBe('reload');
  });

  it('respects caller-supplied headers instead of overriding them', async () => {
    document.cookie = `token=${encodeURIComponent('JWT z')}; path=/`;
    const spy = fetchSpy().mockResolvedValue(fakeResponse({ text: '' }));
    await apiClient('/custom', {
      method: 'POST',
      body: { x: 1 },
      auth: true,
      headers: {
        'Content-Type': 'application/xml',
        Accept: 'text/plain',
        Authorization: 'Bearer preset',
      },
    });
    const headers = spy.mock.calls[0]![1]?.headers as Headers;
    expect(headers.get('Content-Type')).toBe('application/xml');
    expect(headers.get('Accept')).toBe('text/plain');
    expect(headers.get('Authorization')).toBe('Bearer preset');
  });
});
