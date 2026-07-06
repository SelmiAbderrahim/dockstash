import * as http from 'node:http';
import { Duplex, PassThrough, type Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  HttpDockerClient,
  collectDockerStream,
  demuxDockerStream,
  parseDockerHost,
  type DockerHijackRequestFn,
  type DockerRequestFn,
  type DockerStreamRequestFn,
} from './docker-client.js';

function frame(type: number, payload: string): Buffer {
  const body = Buffer.from(payload);
  const header = Buffer.alloc(8);
  header.writeUInt8(type, 0);
  header.writeUInt32BE(body.length, 4);
  return Buffer.concat([header, body]);
}

async function collect(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString();
}

describe('parseDockerHost', () => {
  it('parses tcp://host:port', () => {
    expect(parseDockerHost('tcp://docker-socket-proxy:2375')).toEqual({
      host: 'docker-socket-proxy',
      port: 2375,
    });
  });

  it('rejects unix sockets and malformed values', () => {
    expect(() => parseDockerHost('unix:///var/run/docker.sock')).toThrow(/tcp:\/\//);
    expect(() => parseDockerHost('docker-socket-proxy')).toThrow(/tcp:\/\//);
  });
});

describe('demuxDockerStream', () => {
  it('extracts stdout frames and drops stderr frames', async () => {
    const src = new PassThrough();
    const out = demuxDockerStream(src);
    src.write(frame(1, 'hello '));
    src.write(frame(2, 'progress noise'));
    src.write(frame(1, 'world'));
    src.end();
    await expect(collect(out)).resolves.toBe('hello world');
  });

  it('reassembles frames split across chunks', async () => {
    const src = new PassThrough();
    const out = demuxDockerStream(src);
    const f = frame(1, 'split-payload');
    src.write(f.subarray(0, 5));
    src.write(f.subarray(5, 10));
    src.write(f.subarray(10));
    src.end();
    await expect(collect(out)).resolves.toBe('split-payload');
  });

  it('propagates source errors', async () => {
    const src = new PassThrough();
    const out = demuxDockerStream(src);
    const err = collect(out);
    src.destroy(new Error('socket reset'));
    await expect(err).rejects.toThrow('socket reset');
  });
});

function fakeRequest(
  responses: Array<{ status: number; body: unknown }>,
): { fn: DockerRequestFn; calls: Array<{ method: string; path: string; body?: unknown }> } {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  let i = 0;
  const fn: DockerRequestFn = async (opts) => {
    calls.push(opts);
    const r = responses[i++];
    if (!r) throw new Error('fakeRequest: no scripted response left');
    return {
      status: r.status,
      body: Buffer.from(typeof r.body === 'string' ? r.body : JSON.stringify(r.body)),
    };
  };
  return { fn, calls };
}

describe('HttpDockerClient', () => {
  it('creates an exec, starts it, and demuxes the stream', async () => {
    const { fn, calls } = fakeRequest([{ status: 201, body: { Id: 'exec-1' } }]);
    const raw = new PassThrough();
    const streamFn: DockerStreamRequestFn = async (opts) => {
      expect(opts.path).toBe('/exec/exec-1/start');
      return raw;
    };
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: streamFn,
    });
    const streamPromise = client.exec('db-1', ['pg_dumpall', '-U', 'postgres']);
    raw.write(frame(1, 'dump-data'));
    raw.end();
    const stream = await streamPromise;
    await expect(collect(stream)).resolves.toBe('dump-data');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: '/containers/db-1/exec',
    });
    expect((calls[0]!.body as { Cmd: string[] }).Cmd).toEqual([
      'pg_dumpall',
      '-U',
      'postgres',
    ]);
  });

  it('rejects when exec create returns a non-201', async () => {
    const { fn } = fakeRequest([{ status: 404, body: 'no such container' }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.exec('missing', ['true'])).rejects.toThrow(
      /exec create failed \(404\)/,
    );
  });

  it('rejects when exec create returns malformed JSON', async () => {
    const { fn } = fakeRequest([{ status: 201, body: 'not-json' }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.exec('db', ['true'])).rejects.toThrow(/malformed JSON/);
  });

  it('inspect maps id and running state', async () => {
    const { fn, calls } = fakeRequest([
      { status: 200, body: { Id: 'abc', State: { Running: true } } },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('db-1')).resolves.toEqual({
      id: 'abc',
      running: true,
      env: [],
      image: '',
    });
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/containers/db-1/json' });
  });

  it('inspect defaults id/running when fields are missing', async () => {
    const { fn } = fakeRequest([{ status: 200, body: {} }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('db-1')).resolves.toEqual({
      id: 'db-1',
      running: false,
      env: [],
      image: '',
    });
  });

  it('inspect rejects on non-200 and malformed JSON', async () => {
    const { fn } = fakeRequest([
      { status: 500, body: 'engine error' },
      { status: 200, body: 'not-json' },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('a')).rejects.toThrow(/inspect failed \(500\)/);
    await expect(client.inspect('a')).rejects.toThrow(/malformed JSON/);
  });

  it('lists containers and normalizes fields', async () => {
    const { fn, calls } = fakeRequest([
      {
        status: 200,
        body: [
          {
            Id: 'c1',
            Names: ['/app_db_1', 42],
            Image: 'postgres:16',
            State: 'running',
            Labels: { 'com.docker.compose.project': 'app' },
          },
          { Id: 'c2' },
        ],
      },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.listContainers()).resolves.toEqual([
      {
        id: 'c1',
        names: ['/app_db_1'],
        image: 'postgres:16',
        state: 'running',
        labels: { 'com.docker.compose.project': 'app' },
      },
      { id: 'c2', names: [], image: '', state: '', labels: {} },
    ]);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/containers/json' });
  });

  it('coerces non-array Names, array/absent Labels, and a missing Id to defaults', async () => {
    const { fn } = fakeRequest([
      {
        status: 200,
        body: [{ Id: 'x', Names: 'nope', Labels: ['not', 'object'] }, {}],
      },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.listContainers()).resolves.toEqual([
      { id: 'x', names: [], image: '', state: '', labels: {} },
      { id: '', names: [], image: '', state: '', labels: {} },
    ]);
  });

  it('rejects listContainers on non-200, malformed JSON, and non-array', async () => {
    const { fn } = fakeRequest([
      { status: 500, body: 'engine error' },
      { status: 200, body: 'not-json' },
      { status: 200, body: { not: 'array' } },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.listContainers()).rejects.toThrow(/list containers failed \(500\)/);
    await expect(client.listContainers()).rejects.toThrow(/malformed JSON/);
    await expect(client.listContainers()).rejects.toThrow(/non-array/);
  });

  it('URL-encodes container identifiers', async () => {
    const { fn, calls } = fakeRequest([
      { status: 200, body: { Id: 'x', State: { Running: false } } },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await client.inspect('name/with slash');
    expect(calls[0]!.path).toBe('/containers/name%2Fwith%20slash/json');
  });
});

describe('HttpDockerClient over a real HTTP endpoint', () => {
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        if (req.method === 'POST' && req.url === '/containers/db-live/exec') {
          const body = JSON.parse(Buffer.concat(chunks).toString()) as {
            Cmd: string[];
          };
          if (body.Cmd[0] === 'explode') {
            res.writeHead(500, { 'content-type': 'text/plain' });
            res.end('engine exploded');
            return;
          }
          res.writeHead(201, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ Id: body.Cmd[0] === 'bad-start' ? 'exec-bad' : 'exec-live' }));
          return;
        }
        if (req.method === 'POST' && req.url === '/exec/exec-live/start') {
          res.writeHead(200, { 'content-type': 'application/vnd.docker.raw-stream' });
          res.end(frame(1, 'live-dump-bytes'));
          return;
        }
        if (req.method === 'POST' && req.url === '/exec/exec-bad/start') {
          res.writeHead(409, { 'content-type': 'text/plain' });
          res.end('container not running');
          return;
        }
        if (req.method === 'GET' && req.url === '/containers/db-live/json') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ Id: 'live-id', State: { Running: true } }));
          return;
        }
        if (req.method === 'GET' && req.url === '/exec/exec-stdin/json') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ExitCode: 0 }));
          return;
        }
        res.writeHead(404);
        res.end('not found');
      });
    });
    // Hijacked exec-start (stdin attach): 101-upgrade, echo the received
    // stdin bytes back as one stdout frame once the client half-closes.
    server.on('upgrade', (req, socket) => {
      if (req.url !== '/exec/exec-stdin/start' && req.url !== '/exec/exec-stdin-head/start') {
        socket.end('HTTP/1.1 409 Conflict\r\ncontent-length: 11\r\n\r\nnot running');
        return;
      }
      const headers = 'HTTP/1.1 101 UPGRADED\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n';
      if (req.url === '/exec/exec-stdin-head/start') {
        // Stream bytes in the SAME packet as the 101 — the client receives
        // them as the `head` buffer and must unshift them into the stream.
        socket.write(Buffer.concat([Buffer.from(headers), frame(2, 'early-noise')]));
      } else {
        socket.write(headers);
      }
      const received: Buffer[] = [];
      socket.on('data', (c: Buffer) => received.push(c));
      socket.on('end', () => {
        socket.end(frame(1, Buffer.concat(received).toString()));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as { port: number }).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  });

  it('execs and streams stdout through the default request functions', async () => {
    const client = new HttpDockerClient({ dockerHost: `tcp://127.0.0.1:${port}` });
    const stream = await client.exec('db-live', ['pg_dumpall']);
    await expect(collect(stream)).resolves.toBe('live-dump-bytes');
  });

  it('surfaces engine errors from exec create over real HTTP', async () => {
    const client = new HttpDockerClient({ dockerHost: `tcp://127.0.0.1:${port}` });
    await expect(client.exec('db-live', ['explode'])).rejects.toThrow(
      /exec create failed \(500\): engine exploded/,
    );
  });

  it('rejects a failed exec start with the engine detail', async () => {
    const client = new HttpDockerClient({ dockerHost: `tcp://127.0.0.1:${port}` });
    await expect(client.exec('db-live', ['bad-start'])).rejects.toThrow(
      /exec start failed \(409\): container not running/,
    );
  });

  it('inspects over real HTTP', async () => {
    const client = new HttpDockerClient({ dockerHost: `tcp://127.0.0.1:${port}` });
    await expect(client.inspect('db-live')).resolves.toEqual({
      id: 'live-id',
      running: true,
      env: [],
      image: '',
    });
  });

  it('execWithStdin over real HTTP: hijacks, streams stdin, half-closes, reads exit code', async () => {
    const { fn } = fakeRequest([
      { status: 201, body: { Id: 'exec-stdin' } },
      { status: 200, body: { ExitCode: 0 } },
    ]);
    // Real hijack transport; scripted create/inspect (the raw server routes
    // exec-create by Cmd, which the stdin path does not exercise).
    const client = new HttpDockerClient({
      dockerHost: `tcp://127.0.0.1:${port}`,
      requestFn: fn,
    });
    const stdin = new PassThrough();
    const p = client.execWithStdin('db-live', ['dd', 'of=/data/x'], stdin);
    stdin.write('artifact-payload');
    stdin.end();
    await expect(p).resolves.toEqual({ exitCode: 0, stderr: '' });
  });

  it('execWithStdin over real HTTP: bytes arriving with the 101 packet are not lost', async () => {
    const { fn } = fakeRequest([
      { status: 201, body: { Id: 'exec-stdin-head' } },
      { status: 200, body: { ExitCode: 0 } },
    ]);
    const client = new HttpDockerClient({
      dockerHost: `tcp://127.0.0.1:${port}`,
      requestFn: fn,
    });
    const stdin = new PassThrough();
    const p = client.execWithStdin('db-live', ['dd'], stdin);
    stdin.end('x');
    await expect(p).resolves.toEqual({ exitCode: 0, stderr: 'early-noise' });
  });

  it('execWithStdin over real HTTP: a non-upgrade response rejects with the engine detail', async () => {
    const { fn } = fakeRequest([{ status: 201, body: { Id: 'exec-refused' } }]);
    const client = new HttpDockerClient({
      dockerHost: `tcp://127.0.0.1:${port}`,
      requestFn: fn,
    });
    await expect(
      client.execWithStdin('db-live', ['dd'], new PassThrough()),
    ).rejects.toThrow(/exec start \(stdin\) failed \(409\): not running/);
  });

  it('rejects with connection errors when the engine is unreachable', async () => {
    const closed = new HttpDockerClient({ dockerHost: 'tcp://127.0.0.1:1' });
    await expect(closed.inspect('db')).rejects.toThrow();
    await expect(closed.exec('db', ['true'])).rejects.toThrow();
  });
});

describe('collectDockerStream', () => {
  it('keeps both channels, reassembling frames split across chunks', async () => {
    const src = new PassThrough();
    const done = collectDockerStream(src);
    const f = frame(1, 'out-bytes');
    src.write(f.subarray(0, 6));
    src.write(f.subarray(6));
    src.write(frame(2, 'err-bytes'));
    src.end();
    await expect(done).resolves.toEqual({ stdout: 'out-bytes', stderr: 'err-bytes' });
  });

  it('waits for a frame whose payload is split across chunks', async () => {
    const src = new PassThrough();
    const done = collectDockerStream(src);
    const f = frame(1, 'long-payload-body');
    src.write(f.subarray(0, 12)); // full header + partial payload
    src.write(f.subarray(12));
    src.end();
    await expect(done).resolves.toEqual({ stdout: 'long-payload-body', stderr: '' });
  });

  it('ignores frames of unknown type', async () => {
    const src = new PassThrough();
    const done = collectDockerStream(src);
    src.write(frame(3, 'weird'));
    src.write(frame(1, 'kept'));
    src.end();
    await expect(done).resolves.toEqual({ stdout: 'kept', stderr: '' });
  });

  it('rejects on source errors', async () => {
    const src = new PassThrough();
    const done = collectDockerStream(src);
    src.destroy(new Error('socket reset'));
    await expect(done).rejects.toThrow('socket reset');
  });
});

/**
 * A scripted hijack socket: writes are recorded; when our side half-closes
 * (stdin ended -> socket.end()), the scripted response frames are emitted and
 * the read side ends — mirroring a docker exec that reads stdin to EOF, then
 * exits.
 */
function fakeHijackSocket(framesOut: Buffer[]): { socket: Duplex; written: Buffer[] } {
  const written: Buffer[] = [];
  const socket = new Duplex({
    read() {},
    write(chunk: Buffer, _enc, cb) {
      written.push(chunk);
      cb();
    },
    final(cb) {
      for (const f of framesOut) socket.push(f);
      socket.push(null);
      cb();
    },
  });
  return { socket, written };
}

describe('HttpDockerClient.execCollect', () => {
  it('buffers both channels and reports the exit code', async () => {
    const { fn, calls } = fakeRequest([
      { status: 201, body: { Id: 'exec-2' } },
      { status: 200, body: { ExitCode: 0 } },
    ]);
    const raw = new PassThrough();
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => raw,
    });
    const p = client.execCollect('db-1', ['redis-cli', 'CONFIG', 'GET', 'appendonly']);
    raw.write(frame(1, 'appendonly\nno'));
    raw.write(frame(2, 'warning'));
    raw.end();
    await expect(p).resolves.toEqual({
      exitCode: 0,
      stdout: 'appendonly\nno',
      stderr: 'warning',
    });
    expect(calls[1]).toMatchObject({ method: 'GET', path: '/exec/exec-2/json' });
  });

  it('reports a non-zero exit code', async () => {
    const { fn } = fakeRequest([
      { status: 201, body: { Id: 'exec-3' } },
      { status: 200, body: { ExitCode: 7 } },
    ]);
    const raw = new PassThrough();
    raw.end();
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => raw,
    });
    await expect(client.execCollect('db-1', ['false'])).resolves.toMatchObject({ exitCode: 7 });
  });

  it('defaults a missing ExitCode to -1', async () => {
    const { fn } = fakeRequest([
      { status: 201, body: { Id: 'exec-4' } },
      { status: 200, body: {} },
    ]);
    const raw = new PassThrough();
    raw.end();
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => raw,
    });
    await expect(client.execCollect('db-1', ['true'])).resolves.toMatchObject({ exitCode: -1 });
  });

  it('rejects on exec-inspect non-200 and malformed JSON', async () => {
    const { fn } = fakeRequest([
      { status: 201, body: { Id: 'exec-5' } },
      { status: 500, body: 'engine sad' },
      { status: 201, body: { Id: 'exec-6' } },
      { status: 200, body: 'not-json' },
    ]);
    const mkStream = (): PassThrough => {
      const s = new PassThrough();
      s.end();
      return s;
    };
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => mkStream(),
    });
    await expect(client.execCollect('db-1', ['true'])).rejects.toThrow(
      /exec inspect failed \(500\)/,
    );
    await expect(client.execCollect('db-1', ['true'])).rejects.toThrow(/malformed JSON/);
  });
});

describe('HttpDockerClient.execWithStdin', () => {
  it('streams stdin in, half-closes, and reports exit code + stderr', async () => {
    const { fn, calls } = fakeRequest([
      { status: 201, body: { Id: 'exec-in' } },
      { status: 200, body: { ExitCode: 0 } },
    ]);
    const { socket, written } = fakeHijackSocket([frame(2, 'loaded ok')]);
    const hijackFn: DockerHijackRequestFn = async (opts) => {
      expect(opts.path).toBe('/exec/exec-in/start');
      return { socket };
    };
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
      hijackRequestFn: hijackFn,
    });
    const stdin = new PassThrough();
    const p = client.execWithStdin('db-1', ['dd', 'of=/data/x'], stdin);
    stdin.write('rdb-bytes');
    stdin.end();
    await expect(p).resolves.toEqual({ exitCode: 0, stderr: 'loaded ok' });
    expect(Buffer.concat(written).toString()).toBe('rdb-bytes');
    expect((calls[0]!.body as { AttachStdin: boolean }).AttachStdin).toBe(true);
  });

  it('rejects when the stdin source errors mid-stream', async () => {
    const { fn } = fakeRequest([{ status: 201, body: { Id: 'exec-in2' } }]);
    const { socket } = fakeHijackSocket([]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
      hijackRequestFn: async () => ({ socket }),
    });
    const stdin = new PassThrough();
    const p = client.execWithStdin('db-1', ['dd'], stdin);
    stdin.destroy(new Error('restic dump died'));
    await expect(p).rejects.toThrow('restic dump died');
  });

  it('normalizes a non-Error stdin error before destroying the socket', async () => {
    const { fn } = fakeRequest([{ status: 201, body: { Id: 'exec-in4' } }]);
    const { socket } = fakeHijackSocket([]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
      hijackRequestFn: async () => ({ socket }),
    });
    const stdin = new PassThrough();
    const p = client.execWithStdin('db-1', ['dd'], stdin);
    // Let execWithStdin attach its error listener (exec create + hijack are
    // async) before the source stream errors.
    await new Promise((r) => setImmediate(r));
    stdin.emit('error', 'raw stdin failure');
    await expect(p).rejects.toThrow('raw stdin failure');
  });

  it('propagates a hijack failure', async () => {
    const { fn } = fakeRequest([{ status: 201, body: { Id: 'exec-in3' } }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
      hijackRequestFn: async () => {
        throw new Error('docker exec start (stdin) failed (409): not running');
      },
    });
    await expect(client.execWithStdin('db-1', ['dd'], new PassThrough())).rejects.toThrow(
      /failed \(409\)/,
    );
  });

  it('rejects when exec create fails', async () => {
    const { fn } = fakeRequest([{ status: 404, body: 'no such container' }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
      hijackRequestFn: async () => ({ socket: fakeHijackSocket([]).socket }),
    });
    await expect(client.execWithStdin('gone', ['dd'], new PassThrough())).rejects.toThrow(
      /exec create failed \(404\)/,
    );
  });
});

describe('HttpDockerClient.restart', () => {
  const mk = (responses: Array<{ status: number; body: unknown }>): HttpDockerClient =>
    new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fakeRequest(responses).fn,
      streamRequestFn: async () => new PassThrough(),
    });

  it('resolves on 204', async () => {
    const { fn, calls } = fakeRequest([{ status: 204, body: '' }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.restart('db-1')).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/containers/db-1/restart?t=10' });
  });

  it('403 carries the ALLOW_RESTARTS hint', async () => {
    await expect(mk([{ status: 403, body: 'denied' }]).restart('db-1')).rejects.toThrow(
      /ALLOW_RESTARTS=1/,
    );
  });

  it('other statuses fail generically', async () => {
    await expect(mk([{ status: 500, body: 'boom' }]).restart('db-1')).rejects.toThrow(
      /docker restart failed \(500\): boom/,
    );
  });
});

describe('HttpDockerClient.inspect env/image parsing', () => {
  it('carries Config.Env and Config.Image through', async () => {
    const { fn } = fakeRequest([
      {
        status: 200,
        body: {
          Id: 'abc',
          State: { Running: true },
          Config: { Env: ['POSTGRES_USER=app', 42], Image: 'postgres:16' },
        },
      },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('db-1')).resolves.toEqual({
      id: 'abc',
      running: true,
      env: ['POSTGRES_USER=app'],
      image: 'postgres:16',
    });
  });

  it('tolerates a non-array Env', async () => {
    const { fn } = fakeRequest([
      { status: 200, body: { Id: 'abc', Config: { Env: 'nope' } } },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('db-1')).resolves.toEqual({
      id: 'abc',
      running: false,
      env: [],
      image: '',
    });
  });
});
