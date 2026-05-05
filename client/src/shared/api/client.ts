import { loadCookie } from '@shared/utils/cookies';

const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface ApiClientOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  auth?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const buildHeaders = (
  init: HeadersInit | undefined,
  hasJsonBody: boolean,
  withAuth: boolean,
): Headers => {
  const headers = new Headers(init);
  if (hasJsonBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (withAuth && !headers.has('Authorization')) {
    const token = loadCookie<string>('token');
    if (token) {
      headers.set('Authorization', token);
    }
  }
  return headers;
};

export const apiClient = async <T = unknown>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> => {
  const { body, headers, auth = false, ...rest } = options;
  const hasJsonBody = body !== undefined && body !== null;
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...rest,
    headers: buildHeaders(headers, hasJsonBody, auth),
    body: hasJsonBody ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  const data: unknown = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      `Request to ${url} failed with status ${response.status}`,
      response.status,
      data,
    );
  }

  return data as T;
};
