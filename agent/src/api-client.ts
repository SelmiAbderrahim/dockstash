import type { AgentDiscoverySnapshot } from './discovery.js';
import type { ClaimedJob, HeartbeatResponse, JobResult } from './types.js';

export type FetchFn = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  },
) => Promise<{ status: number; json(): Promise<unknown>; text(): Promise<string> }>;

export interface ApiClientOptions {
  baseUrl: string;
  token: string;
  fetchFn?: FetchFn;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Thin client for the `/api/agent` machine surface. Every call carries the
 * composite Bearer token. Callers (the poller) own retry/backoff policy:
 * a 401 here may just mean the key was rotated — keep retrying, never crash.
 */
export class AgentApiClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchFn: FetchFn;

  constructor(opts: ApiClientOptions) {
    this.baseUrl = opts.baseUrl;
    this.token = opts.token;
    this.fetchFn = opts.fetchFn ?? (fetch as unknown as FetchFn);
  }

  private async post<T>(path: string, body: unknown): Promise<{ status: number; data: T | null }> {
    const res = await this.fetchFn(`${this.baseUrl}/api/agent${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 204) return { status: res.status, data: null };
    if (res.status >= 400) {
      const text = await res.text();
      throw new ApiError(`POST ${path} failed (${res.status}): ${text.slice(0, 300)}`, res.status);
    }
    return { status: res.status, data: (await res.json()) as T };
  }

  async heartbeat(info: {
    version?: string;
    hostname?: string;
    discovery?: AgentDiscoverySnapshot;
  }): Promise<HeartbeatResponse> {
    const { data } = await this.post<HeartbeatResponse>('/heartbeat', info);
    return data as HeartbeatResponse;
  }

  /** Claim the next pending job; null when the queue is empty (204). */
  async claimJob(): Promise<ClaimedJob | null> {
    const { status, data } = await this.post<{ job: ClaimedJob }>('/jobs/claim', {});
    if (status === 204 || data === null) return null;
    return data.job;
  }

  async postLogs(jobId: string, lines: string[]): Promise<void> {
    await this.post(`/jobs/${jobId}/logs`, { lines });
  }

  async postResult(jobId: string, result: JobResult): Promise<void> {
    await this.post(`/jobs/${jobId}/result`, result);
  }
}
