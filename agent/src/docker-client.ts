// Vendored from server/src/modules/backups/backups.docker-client.ts — keep in sync manually.
// Only change: the DockerClient interface (and its result types) are declared
// locally (no boundaries module).
import * as http from 'node:http';
import { PassThrough, type Duplex, type Readable } from 'node:stream';

/**
 * A running container as surfaced by `GET /containers/json` — the subset the
 * discovery snapshot needs. `labels` carries the `com.docker.compose.*` metadata.
 */
export interface DockerContainerSummary {
  id: string;
  names: string[];
  image: string;
  state: string;
  labels: Record<string, string>;
}

/** A completed `docker exec` with both channels buffered + the exit code. */
export interface DockerExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Cap on the buffered stderr tail an execStream keeps for error reporting. */
const STDERR_TAIL_BYTES = 4096;

/**
 * `docker inspect` subset. `env` is Config.Env (`["KEY=VAL"]`) — the
 * credential source for DB dumps and restores; `cmd` is Config.Cmd (e.g. a
 * redis `--requirepass` flag); `image` the configured image reference.
 */
export interface DockerInspectResult {
  id: string;
  running: boolean;
  env: string[];
  cmd: string[];
  image: string;
}

/**
 * A streaming exec whose completion is observable: `stream` is the demuxed
 * stdout; `exit()` resolves once the attach stream ends with the exec exit
 * code and the last ~4KB of stderr — the dump-side truth restic cannot see.
 */
export interface DockerExecStream {
  stream: Readable;
  exit(): Promise<{ exitCode: number; stderrTail: string }>;
}

export interface DockerClient {
  exec(container: string, argv: string[]): Promise<Readable>;
  /**
   * Streaming exec with exit-code + stderr observability. `env` entries
   * (`KEY=VAL`) reach the in-container process environment — the transport
   * for dump credentials so secrets never ride argv.
   */
  execStream(
    container: string,
    argv: string[],
    opts?: { env?: string[] },
  ): Promise<DockerExecStream>;
  /** Exec to completion; buffers stdout/stderr and reports the exit code. */
  execCollect(
    container: string,
    argv: string[],
    env?: string[],
  ): Promise<DockerExecResult>;
  /** Exec with `stdin` streamed to the process (`docker exec -i` equivalent). */
  execWithStdin(
    container: string,
    argv: string[],
    stdin: Readable,
  ): Promise<{ exitCode: number; stderr: string }>;
  /** `POST /containers/{id}/restart` — needs ALLOW_RESTARTS=1 on the socket proxy. */
  restart(container: string): Promise<void>;
  inspect(container: string): Promise<DockerInspectResult>;
  /** List running containers (read-only) for local Compose-project discovery. */
  listContainers(): Promise<DockerContainerSummary[]>;
}

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

/**
 * Hijacked (`Connection: Upgrade` / `Upgrade: tcp`) exec-start request — the
 * only Engine API shape that attaches stdin. The returned duplex carries our
 * stdin bytes in and the multiplexed stdout/stderr frames back out.
 * Injectable for tests.
 */
export type DockerHijackRequestFn = (opts: {
  path: string;
  body: unknown;
}) => Promise<{ socket: Duplex }>;

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

function makeHttpHijackRequest(endpoint: DockerEndpoint): DockerHijackRequestFn {
  return ({ path, body }) =>
    new Promise((resolve, reject) => {
      const payload = JSON.stringify(body);
      const req = http.request({
        host: endpoint.host,
        port: endpoint.port,
        method: 'POST',
        path,
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          connection: 'Upgrade',
          upgrade: 'tcp',
        },
      });
      req.on('upgrade', (_res, socket, head) => {
        // Bytes the parser read past the 101 headers belong to the stream.
        if (head.length > 0) socket.unshift(head);
        resolve({ socket });
      });
      req.on('response', (res) => {
        // The daemon answered without upgrading — an error status + JSON body.
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () =>
          reject(
            new Error(
              `docker exec start (stdin) failed (${res.statusCode}): ${Buffer.concat(chunks).toString().trim()}`,
            ),
          ),
        );
      });
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

/**
 * Demux a Docker attach stream to completion, keeping BOTH channels — unlike
 * demuxDockerStream (which forwards stdout only), this buffers stdout and
 * stderr so callers can check output and surface a stderr tail alongside the
 * exec exit code.
 */
export function collectDockerStream(
  source: Readable,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let pending = Buffer.alloc(0);
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    source.on('data', (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      while (pending.length >= 8) {
        const type = pending[0];
        const len = pending.readUInt32BE(4);
        if (pending.length < 8 + len) break;
        const payload = pending.subarray(8, 8 + len);
        pending = pending.subarray(8 + len);
        if (type === 1) out.push(payload);
        else if (type === 2) err.push(payload);
      }
    });
    source.on('end', () =>
      resolve({
        stdout: Buffer.concat(out).toString(),
        stderr: Buffer.concat(err).toString(),
      }),
    );
    source.on('error', reject);
  });
}

export interface HttpDockerClientOptions {
  dockerHost: string;
  requestFn?: DockerRequestFn;
  streamRequestFn?: DockerStreamRequestFn;
  hijackRequestFn?: DockerHijackRequestFn;
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
  private readonly hijackRequest: DockerHijackRequestFn;

  constructor(opts: HttpDockerClientOptions) {
    const endpoint = parseDockerHost(opts.dockerHost);
    this.request = opts.requestFn ?? makeHttpRequest(endpoint);
    this.streamRequest = opts.streamRequestFn ?? makeHttpStreamRequest(endpoint);
    this.hijackRequest = opts.hijackRequestFn ?? makeHttpHijackRequest(endpoint);
  }

  private async createExec(
    container: string,
    argv: string[],
    attachStdin: boolean,
    env?: string[],
  ): Promise<string> {
    const create = await this.request({
      method: 'POST',
      path: `/containers/${encodeURIComponent(container)}/exec`,
      body: {
        ...(attachStdin ? { AttachStdin: true } : {}),
        AttachStdout: true,
        AttachStderr: true,
        ...(env && env.length > 0 ? { Env: env } : {}),
        Cmd: argv,
      },
    });
    if (create.status !== 201) {
      throw new Error(
        `docker exec create failed (${create.status}): ${create.body.toString().trim()}`,
      );
    }
    try {
      return (JSON.parse(create.body.toString()) as { Id: string }).Id;
    } catch {
      throw new Error('docker exec create returned malformed JSON');
    }
  }

  /** `GET /exec/{id}/json` → ExitCode. The proxy's EXEC scope covers it. */
  private async execExitCode(execId: string): Promise<number> {
    const res = await this.request({ method: 'GET', path: `/exec/${execId}/json` });
    if (res.status !== 200) {
      throw new Error(
        `docker exec inspect failed (${res.status}): ${res.body.toString().trim()}`,
      );
    }
    let parsed: { ExitCode?: number };
    try {
      parsed = JSON.parse(res.body.toString()) as typeof parsed;
    } catch {
      throw new Error('docker exec inspect returned malformed JSON');
    }
    return typeof parsed.ExitCode === 'number' ? parsed.ExitCode : -1;
  }

  async exec(container: string, argv: string[]): Promise<Readable> {
    const execId = await this.createExec(container, argv, false);
    const raw = await this.streamRequest({
      method: 'POST',
      path: `/exec/${execId}/start`,
      body: { Detach: false, Tty: false },
    });
    return demuxDockerStream(raw);
  }

  /**
   * Streaming exec that keeps the failure channel: demuxed stdout plus an
   * `exit()` that reports the exec exit code and a stderr tail. `exit()`
   * drains any unconsumed stdout first so an abandoned stream (e.g. restic
   * bailed early) cannot buffer a multi-GB dump in memory.
   */
  async execStream(
    container: string,
    argv: string[],
    opts?: { env?: string[] },
  ): Promise<DockerExecStream> {
    const execId = await this.createExec(container, argv, false, opts?.env);
    const raw = await this.streamRequest({
      method: 'POST',
      path: `/exec/${execId}/start`,
      body: { Detach: false, Tty: false },
    });
    const out = new PassThrough();
    let pending = Buffer.alloc(0);
    let stderrTail = Buffer.alloc(0);
    const finished = new Promise<void>((resolve) => {
      raw.on('data', (chunk: Buffer) => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 8) {
          const type = pending[0];
          const len = pending.readUInt32BE(4);
          if (pending.length < 8 + len) break;
          const payload = pending.subarray(8, 8 + len);
          pending = pending.subarray(8 + len);
          if (type === 1) out.write(payload);
          else if (type === 2) {
            stderrTail = Buffer.concat([stderrTail, payload]);
            if (stderrTail.length > STDERR_TAIL_BYTES) {
              stderrTail = stderrTail.subarray(stderrTail.length - STDERR_TAIL_BYTES);
            }
          }
        }
      });
      raw.on('end', () => {
        out.end();
        resolve();
      });
      raw.on('error', (err) => {
        out.destroy(err);
        // exit() still resolves — the exec-inspect exit code (or its own
        // error) is more useful than a hung promise.
        resolve();
      });
    });
    return {
      stream: out,
      exit: async () => {
        out.resume(); // discard unread stdout so the attach stream can drain
        await finished;
        const exitCode = await this.execExitCode(execId);
        return { exitCode, stderrTail: stderrTail.toString().trim() };
      },
    };
  }

  /** Run to completion, buffering both channels, and report the exit code. */
  async execCollect(
    container: string,
    argv: string[],
    env?: string[],
  ): Promise<DockerExecResult> {
    const execId = await this.createExec(container, argv, false, env);
    const raw = await this.streamRequest({
      method: 'POST',
      path: `/exec/${execId}/start`,
      body: { Detach: false, Tty: false },
    });
    const { stdout, stderr } = await collectDockerStream(raw);
    const exitCode = await this.execExitCode(execId);
    return { exitCode, stdout, stderr };
  }

  /**
   * Run argv with `stdin` streamed to the process (`docker exec -i`
   * equivalent). The hijacked socket is half-closed when `stdin` ends —
   * that half-close IS the container-side EOF; without it the process
   * (psql, mongorestore, dd, …) waits forever.
   */
  async execWithStdin(
    container: string,
    argv: string[],
    stdin: Readable,
  ): Promise<{ exitCode: number; stderr: string }> {
    const execId = await this.createExec(container, argv, true);
    const { socket } = await this.hijackRequest({
      path: `/exec/${execId}/start`,
      body: { Detach: false, Tty: false },
    });
    const collected = collectDockerStream(socket);
    stdin.on('error', (err) => {
      socket.destroy(err instanceof Error ? err : new Error(String(err)));
    });
    // pipe() ends the socket's write side when stdin ends (the half-close).
    stdin.pipe(socket);
    const { stderr } = await collected;
    const exitCode = await this.execExitCode(execId);
    return { exitCode, stderr };
  }

  /**
   * `POST /containers/{id}/restart` — requires `ALLOW_RESTARTS: 1` on the
   * docker-socket-proxy; the 403 hint tells an operator exactly that.
   */
  async restart(container: string, timeoutSeconds = 10): Promise<void> {
    const res = await this.request({
      method: 'POST',
      path: `/containers/${encodeURIComponent(container)}/restart?t=${timeoutSeconds}`,
    });
    if (res.status === 204) return;
    const detail = res.body.toString().trim();
    if (res.status === 403) {
      throw new Error(
        `docker restart denied (403): the docker-socket-proxy must set ALLOW_RESTARTS=1 — ${detail}`,
      );
    }
    throw new Error(`docker restart failed (${res.status}): ${detail}`);
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

  async inspect(container: string): Promise<DockerInspectResult> {
    const res = await this.request({
      method: 'GET',
      path: `/containers/${encodeURIComponent(container)}/json`,
    });
    if (res.status !== 200) {
      throw new Error(
        `docker inspect failed (${res.status}): ${res.body.toString().trim()}`,
      );
    }
    let parsed: {
      Id?: string;
      State?: { Running?: boolean };
      Config?: { Env?: unknown; Cmd?: unknown; Image?: string };
    };
    try {
      parsed = JSON.parse(res.body.toString()) as typeof parsed;
    } catch {
      throw new Error('docker inspect returned malformed JSON');
    }
    // Config.Env is a ["KEY=VAL"] array — exactly the ComposeService
    // environment shape the adapters' readServiceEnv accepts. It is the
    // credential source for DB dumps and restores. Config.Cmd carries flags
    // like a redis `--requirepass` that never appear in env.
    const env = Array.isArray(parsed.Config?.Env)
      ? parsed.Config.Env.filter((e): e is string => typeof e === 'string')
      : [];
    const cmd = Array.isArray(parsed.Config?.Cmd)
      ? parsed.Config.Cmd.filter((c): c is string => typeof c === 'string')
      : [];
    return {
      id: parsed.Id ?? container,
      running: Boolean(parsed.State?.Running),
      env,
      cmd,
      image: parsed.Config?.Image ?? '',
    };
  }
}
