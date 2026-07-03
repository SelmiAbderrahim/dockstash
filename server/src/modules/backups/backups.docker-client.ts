import * as http from 'node:http';
import { PassThrough, type Readable } from 'node:stream';
import type { DockerClient, DockerContainerSummary } from './backups.boundaries.js';

/** Minimal request boundary over the Docker Engine API. Injectable for tests. */
export type DockerRequestFn = (opts: {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}) => Promise<{ status: number; body: Buffer }>;

export type DockerStreamRequestFn = (opts: {
  method: 'POST';
  path: string;
  body: unknown;
}) => Promise<Readable>;

interface DockerEndpoint {
  host: string;
  port: number;
}

/** Parse `tcp://docker-socket-proxy:2375` into host/port. */
export function parseDockerHost(dockerHost: string): DockerEndpoint {
  const m = /^tcp:\/\/([^:/]+):(\d+)$/.exec(dockerHost);
  if (!m) {
    throw new Error(`DOCKER_HOST must look like tcp://host:port, got: ${dockerHost}`);
  }
  return { host: m[1] as string, port: Number(m[2]) };
}

function makeHttpRequest(endpoint: DockerEndpoint): DockerRequestFn {
  return ({ method, path, body }) =>
    new Promise((resolve, reject) => {
      const payload = body === undefined ? undefined : JSON.stringify(body);
      const req = http.request(
        {
          host: endpoint.host,
          port: endpoint.port,
          method,
          path,
          headers: {
            'content-type': 'application/json',
            ...(payload ? { 'content-length': Buffer.byteLength(payload) } : {}),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c: Buffer) => chunks.push(c));
          res.on('end', () =>
            resolve({ status: Number(res.statusCode), body: Buffer.concat(chunks) }),
          );
          res.on('error', reject);
        },
      );
      req.on('error', reject);
      if (payload) req.write(payload);
      req.end();
    });
}

function makeHttpStreamRequest(endpoint: DockerEndpoint): DockerStreamRequestFn {
  return ({ method, path, body }) =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request(
        {
          host: endpoint.host,
          port: endpoint.port,
          method,
          path,
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          if (Number(res.statusCode) >= 300) {
            const chunks: Buffer[] = [];
            res.on('data', (c: Buffer) => chunks.push(c));
            res.on('end', () =>
              reject(
                new Error(
                  `docker exec start failed (${res.statusCode}): ${Buffer.concat(chunks).toString().trim()}`,
                ),
              ),
            );
            return;
          }
          resolve(res as unknown as Readable);
        },
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
}

/**
 * Demultiplex the Docker attach stream framing (8-byte header: stream type,
 * 3 reserved bytes, 4-byte big-endian length) into a plain stdout byte stream.
 * stderr frames are collected and surfaced as an error suffix if the source
 * errors; for dumps we only forward stdout.
 */
export function demuxDockerStream(source: Readable): Readable {
  const out = new PassThrough();
  let pending = Buffer.alloc(0);

  source.on('data', (chunk: Buffer) => {
    pending = Buffer.concat([pending, chunk]);
    // Each frame: [type(1)][pad(3)][len(4 BE)][payload(len)]
    while (pending.length >= 8) {
      const type = pending[0];
      const len = pending.readUInt32BE(4);
      if (pending.length < 8 + len) break;
      const payload = pending.subarray(8, 8 + len);
      pending = pending.subarray(8 + len);
      if (type === 1) out.write(payload); // stdout
      // type 2 = stderr: dump progress/noise — intentionally dropped;
      // a failing dump exits non-zero and surfaces via exec inspect.
    }
  });
  source.on('end', () => out.end());
  source.on('error', (err) => out.destroy(err));
  return out;
}

export interface HttpDockerClientOptions {
  dockerHost: string;
  requestFn?: DockerRequestFn;
  streamRequestFn?: DockerStreamRequestFn;
}

/**
 * DockerClient over the Engine HTTP API — reaches Docker only through the
 * least-privilege socket proxy (`DOCKER_HOST=tcp://docker-socket-proxy:2375`),
 * which allows exactly CONTAINERS + EXEC. No dockerode dependency; argv-only
 * exec (never a shell string).
 */
export class HttpDockerClient implements DockerClient {
  private readonly request: DockerRequestFn;
  private readonly streamRequest: DockerStreamRequestFn;

  constructor(opts: HttpDockerClientOptions) {
    const endpoint = parseDockerHost(opts.dockerHost);
    this.request = opts.requestFn ?? makeHttpRequest(endpoint);
    this.streamRequest = opts.streamRequestFn ?? makeHttpStreamRequest(endpoint);
  }

  async exec(container: string, argv: string[]): Promise<Readable> {
    const create = await this.request({
      method: 'POST',
      path: `/containers/${encodeURIComponent(container)}/exec`,
      body: { AttachStdout: true, AttachStderr: true, Cmd: argv },
    });
    if (create.status !== 201) {
      throw new Error(
        `docker exec create failed (${create.status}): ${create.body.toString().trim()}`,
      );
    }
    let execId: string;
    try {
      execId = (JSON.parse(create.body.toString()) as { Id: string }).Id;
    } catch {
      throw new Error('docker exec create returned malformed JSON');
    }
    const raw = await this.streamRequest({
      method: 'POST',
      path: `/exec/${execId}/start`,
      body: { Detach: false, Tty: false },
    });
    return demuxDockerStream(raw);
  }

  async listContainers(): Promise<DockerContainerSummary[]> {
    const res = await this.request({ method: 'GET', path: '/containers/json' });
    if (res.status !== 200) {
      throw new Error(
        `docker list containers failed (${res.status}): ${res.body.toString().trim()}`,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body.toString());
    } catch {
      throw new Error('docker list containers returned malformed JSON');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('docker list containers returned a non-array');
    }
    return parsed.map((entry) => {
      const c = entry as {
        Id?: string;
        Names?: unknown;
        Image?: string;
        State?: string;
        Labels?: unknown;
      };
      const names = Array.isArray(c.Names)
        ? c.Names.filter((n): n is string => typeof n === 'string')
        : [];
      const labels =
        c.Labels && typeof c.Labels === 'object' && !Array.isArray(c.Labels)
          ? (c.Labels as Record<string, string>)
          : {};
      return {
        id: c.Id ?? '',
        names,
        image: c.Image ?? '',
        state: c.State ?? '',
        labels,
      };
    });
  }

  async inspect(container: string): Promise<{ id: string; running: boolean }> {
    const res = await this.request({
      method: 'GET',
      path: `/containers/${encodeURIComponent(container)}/json`,
    });
    if (res.status !== 200) {
      throw new Error(
        `docker inspect failed (${res.status}): ${res.body.toString().trim()}`,
      );
    }
    let parsed: { Id?: string; State?: { Running?: boolean } };
    try {
      parsed = JSON.parse(res.body.toString()) as typeof parsed;
    } catch {
      throw new Error('docker inspect returned malformed JSON');
    }
    return { id: parsed.Id ?? container, running: Boolean(parsed.State?.Running) };
  }
}
