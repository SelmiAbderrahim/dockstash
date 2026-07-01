import { env } from '../../../config/env.js';
import { getDecryptedPolarToken } from '../polar-secrets.js';

const BASE_URL_SANDBOX = 'https://sandbox-api.polar.sh/v1';
const BASE_URL_PRODUCTION = 'https://api.polar.sh/v1';
const DEFAULT_TIMEOUT_MS = 15_000;

export type PolarServer = 'sandbox' | 'production';

export interface PolarRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

export interface PolarRestClient {
  server: PolarServer;
  baseUrl: string;
  request<T = unknown>(path: string, options?: PolarRequestOptions): Promise<T>;
}

export class PolarApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly detail: unknown;
  public readonly retryAfterSeconds?: number;

  constructor(args: {
    status: number;
    code: string;
    detail: unknown;
    message: string;
    retryAfterSeconds?: number;
  }) {
    super(args.message);
    this.name = 'PolarApiError';
    this.status = args.status;
    this.code = args.code;
    this.detail = args.detail;
    this.retryAfterSeconds = args.retryAfterSeconds;
  }
}

export interface PolarPaginatedResponse<T> {
  items: T[];
  pagination: { total_count: number; max_page: number };
}

export function getPolarServer(): PolarServer {
  return env.POLAR_SERVER === 'production' ? 'production' : 'sandbox';
}

export function getPolarBaseUrl(server: PolarServer = getPolarServer()): string {
  return server === 'production' ? BASE_URL_PRODUCTION : BASE_URL_SANDBOX;
}

function buildUrl(
  baseUrl: string,
  path: string,
  query: PolarRequestOptions['query'],
): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function parseRetryAfter(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? seconds : undefined;
}

async function decodeResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function pickErrorCode(status: number, body: unknown): string {
  if (
    body &&
    typeof body === 'object' &&
    'error' in body &&
    typeof (body as { error: unknown }).error === 'string'
  ) {
    return (body as { error: string }).error;
  }
  if (status === 422) return 'validation_error';
  if (status === 429) return 'rate_limit_exceeded';
  if (status === 404) return 'not_found';
  if (status >= 500) return 'server_error';
  return 'http_error';
}

function pickErrorMessage(status: number, body: unknown): string {
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    if (typeof record.detail === 'string') return record.detail;
    if (typeof record.message === 'string') return record.message;
  }
  return `Polar API request failed with status ${status}`;
}

type FetchLike = typeof fetch;

export interface CreatePolarRestClientOptions {
  server?: PolarServer;
  token: string;
  fetchImpl?: FetchLike;
}

export function createPolarRestClient(
  options: CreatePolarRestClientOptions,
): PolarRestClient {
  const server = options.server ?? getPolarServer();
  const baseUrl = getPolarBaseUrl(server);
  const fetchImpl = options.fetchImpl ?? fetch;
  const token = options.token;

  return {
    server,
    baseUrl,
    async request<T>(path: string, requestOptions: PolarRequestOptions = {}): Promise<T> {
      const method = requestOptions.method ?? 'GET';
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      };
      if (requestOptions.body !== undefined) {
        headers['Content-Type'] = 'application/json';
      }
      if (requestOptions.idempotencyKey) {
        headers['Idempotency-Key'] = requestOptions.idempotencyKey;
      }
      const url = buildUrl(baseUrl, path, requestOptions.query);
      const response = await fetchImpl(url, {
        method,
        headers,
        body:
          requestOptions.body === undefined
            ? undefined
            : JSON.stringify(requestOptions.body),
        signal: AbortSignal.timeout(requestOptions.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });

      if (!response.ok) {
        const detail = await decodeResponse(response);
        throw new PolarApiError({
          status: response.status,
          code: pickErrorCode(response.status, detail),
          detail,
          message: pickErrorMessage(response.status, detail),
          retryAfterSeconds: parseRetryAfter(response.headers),
        });
      }

      if (response.status === 204) {
        return null as T;
      }
      const decoded = await decodeResponse(response);
      return decoded as T;
    },
  };
}

let cachedClient: PolarRestClient | null = null;
let cachedFactory: ((token: string) => PolarRestClient) | null = null;

export function setPolarRestClientFactory(
  factory: ((token: string) => PolarRestClient) | null,
): void {
  cachedFactory = factory;
  cachedClient = null;
}

export function clearPolarRestClient(): void {
  cachedClient = null;
}

export function getPolarRestClient(): PolarRestClient {
  if (cachedClient) return cachedClient;
  const token = getDecryptedPolarToken();
  if (!token) {
    throw new Error(
      'POLAR_ACCESS_TOKEN is not configured. Set it in the root .env to use Polar.',
    );
  }
  cachedClient = cachedFactory
    ? cachedFactory(token)
    : createPolarRestClient({ token });
  return cachedClient;
}

export async function listAllPolarPages<T>(
  fetchPage: (page: number) => Promise<PolarPaginatedResponse<T>>,
): Promise<T[]> {
  const first = await fetchPage(1);
  const out: T[] = [...first.items];
  const maxPage = first.pagination.max_page;
  for (let page = 2; page <= maxPage; page++) {
    const next = await fetchPage(page);
    out.push(...next.items);
  }
  return out;
}
