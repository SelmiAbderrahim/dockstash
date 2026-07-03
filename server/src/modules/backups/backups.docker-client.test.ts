import * as http from 'node:http';
import { PassThrough, type Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  HttpDockerClient,
  demuxDockerStream,
  parseDockerHost,
  type DockerRequestFn,
  type DockerStreamRequestFn,
} from './backups.docker-client.js';

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
    await expect(client.inspect('db-1')).resolves.toEqual({ id: 'abc', running: true });
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/containers/db-1/json' });
  });

  it('inspect defaults id/running when fields are missing', async () => {
    const { fn } = fakeRequest([{ status: 200, body: {} }]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.inspect('db-1')).resolves.toEqual({ id: 'db-1', running: false });
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

  it('coerces non-array Names and array/absent Labels to safe defaults', async () => {
    const { fn } = fakeRequest([
      { status: 200, body: [{ Id: 'x', Names: 'nope', Labels: ['not', 'an', 'object'] }] },
    ]);
    const client = new HttpDockerClient({
      dockerHost: 'tcp://proxy:2375',
      requestFn: fn,
      streamRequestFn: async () => new PassThrough(),
    });
    await expect(client.listContainers()).resolves.toEqual([
      { id: 'x', names: [], image: '', state: '', labels: {} },
    ]);
  });

  it('rejects listContainers on non-200, malformed JSON, and non-array payloads', async () => {
    const { fn } = fakeRequest([
      { status: 500, body: 'engine error' },
      { status: 200, body: 'not-json' },
      { status: 200, body: { not: 'an array' } },
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
        res.writeHead(404);
        res.end('not found');
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
    });
  });

  it('rejects with connection errors when the engine is unreachable', async () => {
    const closed = new HttpDockerClient({ dockerHost: 'tcp://127.0.0.1:1' });
    await expect(closed.inspect('db')).rejects.toThrow();
    await expect(closed.exec('db', ['true'])).rejects.toThrow();
  });
});
