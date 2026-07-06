import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ProcessResticRunner,
  TmpfsKeyMaterializer,
  normalizePrivateKey,
  type KeyMaterializer,
  type SpawnImpl,
  type SpawnedChild,
} from './restic-runner.js';

interface FakeChildControls {
  child: SpawnedChild;
  emitStdout(data: string): void;
  emitStderr(data: string): void;
  close(code: number): void;
  fail(err: Error): void;
  stdinData(): string;
}

function makeFakeChild(): FakeChildControls {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const stdin = new PassThrough();
  let stdinBuf = '';
  stdin.on('data', (b: Buffer) => {
    stdinBuf += b.toString();
  });
  const child: SpawnedChild = {
    stdin,
    stdout,
    stderr,
    on: (event: string, listener: (...args: never[]) => void) => {
      emitter.on(event, listener as (...args: unknown[]) => void);
    },
  };
  return {
    child,
    emitStdout: (d) => stdout.write(d),
    emitStderr: (d) => stderr.write(d),
    close: (code) => {
      stdout.end();
      stderr.end();
      // allow stream flushes before close
      setImmediate(() => emitter.emit('close', code));
    },
    fail: (err) => emitter.emit('error', err),
    stdinData: () => stdinBuf,
  };
}

interface SpawnCapture {
  spawnImpl: SpawnImpl;
  calls: Array<{ binary: string; argv: string[]; env: NodeJS.ProcessEnv }>;
  controls: FakeChildControls[];
}

function makeSpawnCapture(): SpawnCapture {
  const calls: SpawnCapture['calls'] = [];
  const controls: FakeChildControls[] = [];
  const spawnImpl: SpawnImpl = (binary, argv, options) => {
    const fake = makeFakeChild();
    calls.push({ binary, argv, env: options.env });
    controls.push(fake);
    return fake.child;
  };
  return { spawnImpl, calls, controls };
}

const passthroughKeys: KeyMaterializer = {
  withKeyFiles: (_material, run) =>
    run({ keyPath: '/tmp/fake-key', knownHostsPath: '/tmp/fake-known-hosts' }),
};

function makeRunner(capture: SpawnCapture, ssh = false): ProcessResticRunner {
  return new ProcessResticRunner({
    repoUrl: 'sftp:backup@host:/backups/u/p',
    password: 'repo-pw',
    binary: 'restic-test',
    cacheDir: '/tmp/cache',
    spawnImpl: capture.spawnImpl,
    keyMaterializer: passthroughKeys,
    ...(ssh
      ? { ssh: { privateKey: 'PRIVATE', hostKeyLine: 'host ssh-ed25519 AAAA' } }
      : {}),
  });
}

describe('ProcessResticRunner', () => {
  it('spawns argv-only with repo, cache dir, and RESTIC_PASSWORD in env', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.check(['check']);
    cap.controls[0]!.close(0);
    await done;
    const call = cap.calls[0]!;
    expect(call.binary).toBe('restic-test');
    expect(call.argv).toEqual(['-r', 'sftp:backup@host:/backups/u/p', '--cache-dir', '/tmp/cache', 'check']);
    expect(call.env.RESTIC_PASSWORD).toBe('repo-pw');
  });

  it('always forces StrictHostKeyChecking=yes for SFTP repos, via sftp.args', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap, true);
    const done = runner.backup(['backup', '/var/www/x']);
    cap.controls[0]!.close(0);
    await done;
    const sftpOpt = cap.calls[0]!.argv.find((a) => a.startsWith('sftp.args='));
    expect(sftpOpt).toBeDefined();
    expect(sftpOpt).toContain('StrictHostKeyChecking=yes');
    expect(sftpOpt).toContain('UserKnownHostsFile=/tmp/fake-known-hosts');
    expect(sftpOpt).toContain('-i /tmp/fake-key');
    expect(sftpOpt).toContain('BatchMode=yes');
    expect(sftpOpt).not.toContain('StrictHostKeyChecking=no');
    // Regression (restic semantics): sftp.command is used VERBATIM by restic —
    // it drops the user@host destination from the repo URL and ssh dies with
    // "You must specify a subsystem to invoke." We must only ever pass
    // sftp.args (extra flags), never a full replacement command.
    expect(cap.calls[0]!.argv.some((a) => a.startsWith('sftp.command='))).toBe(false);
    expect(sftpOpt!.slice('sftp.args='.length).startsWith('ssh')).toBe(false);
  });

  it('pipes stdin streams into the child', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const stdin = new PassThrough();
    const done = runner.backup(['backup', '--stdin'], { stdin });
    stdin.end('dump-bytes');
    await new Promise((r) => setImmediate(r));
    cap.controls[0]!.close(0);
    await done;
    expect(cap.controls[0]!.stdinData()).toBe('dump-bytes');
  });

  it('rejects with stderr detail on non-zero exit', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.check(['check']);
    cap.controls[0]!.emitStderr('repo locked');
    cap.controls[0]!.close(1);
    await expect(done).rejects.toThrow(/check exit 1: repo locked/);
  });

  it('rejects on spawn error events', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.unlock();
    cap.controls[0]!.fail(new Error('ENOENT'));
    await expect(done).rejects.toThrow('ENOENT');
  });

  it('parses snapshots --json into detailed records', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.snapshotsDetailed();
    cap.controls[0]!.emitStdout(
      JSON.stringify([
        {
          id: 'aabbccdd0011',
          short_id: 'aabbccdd',
          time: '2026-07-01T00:00:00Z',
          hostname: 'api',
          tags: ['proj'],
          summary: { total_bytes_processed: 42 },
        },
      ]),
    );
    cap.controls[0]!.close(0);
    const snaps = await done;
    expect(snaps).toHaveLength(1);
    expect(snaps[0]).toMatchObject({ short_id: 'aabbccdd', hostname: 'api' });
    expect(cap.calls[0]!.argv).toContain('--json');
  });

  it('snapshots() maps to the narrow id/time shape', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.snapshots();
    cap.controls[0]!.emitStdout('[{"id":"x","short_id":"s","time":"t"}]');
    cap.controls[0]!.close(0);
    await expect(done).resolves.toEqual([{ id: 'x', time: 't' }]);
  });

  it('treats empty snapshot output as an empty list', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.snapshotsDetailed();
    cap.controls[0]!.close(0);
    await expect(done).resolves.toEqual([]);
  });

  it('rejects malformed and non-array snapshot payloads', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const malformed = runner.snapshotsDetailed();
    cap.controls[0]!.emitStdout('not-json');
    cap.controls[0]!.close(0);
    await expect(malformed).rejects.toThrow(/malformed JSON/);

    const nonArray = runner.snapshotsDetailed();
    cap.controls[1]!.emitStdout('{"ok":true}');
    cap.controls[1]!.close(0);
    await expect(nonArray).rejects.toThrow(/non-array/);
  });

  it('stats() parses `restic stats --json` output', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.stats();
    cap.controls[0]!.emitStdout(
      JSON.stringify({ total_size: 1024, total_file_count: 3, snapshots_count: 2 }),
    );
    cap.controls[0]!.close(0);
    await expect(done).resolves.toEqual({
      total_size: 1024,
      total_file_count: 3,
      snapshots_count: 2,
    });
    expect(cap.calls[0]!.argv).toEqual([
      '-r',
      'sftp:backup@host:/backups/u/p',
      '--cache-dir',
      '/tmp/cache',
      'stats',
      '--json',
    ]);
  });

  it('stats() treats empty stdout as an empty object', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.stats();
    cap.controls[0]!.close(0);
    await expect(done).resolves.toEqual({});
  });

  it('stats() throws on malformed JSON', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.stats();
    cap.controls[0]!.emitStdout('not-json');
    cap.controls[0]!.close(0);
    await expect(done).rejects.toThrow(/restic stats returned malformed JSON/);
  });

  it('init tolerates an already-initialized repository', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.init();
    cap.controls[0]!.emitStderr('Fatal: config file already exists');
    cap.controls[0]!.close(1);
    await expect(done).resolves.toBeUndefined();
  });

  it('init rethrows other failures', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.init();
    cap.controls[0]!.emitStderr('permission denied');
    cap.controls[0]!.close(1);
    await expect(done).rejects.toThrow(/permission denied/);
  });

  it('restore and forget pass argv through', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const restore = runner.restore(['restore', 'abc', '--target', '/tmp/t']);
    cap.controls[0]!.close(0);
    await restore;
    const forget = runner.forget(['forget', '--keep-daily', '7', '--prune']);
    cap.controls[1]!.close(0);
    await forget;
    expect(cap.calls[0]!.argv).toContain('restore');
    expect(cap.calls[1]!.argv).toContain('forget');
  });

  it('runs without SSH options when no ssh material is provided', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap, false);
    const done = runner.unlock();
    cap.controls[0]!.close(0);
    await done;
    expect(cap.calls[0]!.argv.some((a) => a.startsWith('sftp.args='))).toBe(false);
    expect(cap.calls[0]!.argv.some((a) => a.startsWith('sftp.command='))).toBe(false);
  });
});

describe('normalizePrivateKey', () => {
  it('adds a trailing newline when missing', () => {
    expect(normalizePrivateKey('body')).toBe('body\n');
  });

  it('converts CRLF and lone CR to LF', () => {
    expect(normalizePrivateKey('a\r\nb\rc')).toBe('a\nb\nc\n');
  });

  it('collapses surrounding blank lines to one trailing newline', () => {
    expect(normalizePrivateKey('\n\n key \n\n')).toBe('key\n');
  });
});

describe('TmpfsKeyMaterializer', () => {
  it('writes 0600 key files and removes them afterwards', async () => {
    const materializer = new TmpfsKeyMaterializer(os.tmpdir());
    let seenDir = '';
    await materializer.withKeyFiles(
      { privateKey: 'KEY-BYTES', hostKeyLine: 'host ssh-ed25519 AAAA' },
      async ({ keyPath, knownHostsPath }) => {
        seenDir = path.dirname(keyPath);
        expect(await fs.readFile(keyPath, 'utf8')).toBe('KEY-BYTES\n');
        expect(await fs.readFile(knownHostsPath, 'utf8')).toBe('host ssh-ed25519 AAAA\n');
        const mode = (await fs.stat(keyPath)).mode & 0o777;
        expect(mode).toBe(0o600);
      },
    );
    await expect(fs.stat(seenDir)).rejects.toThrow();
  });

  it('cleans up even when the callback throws', async () => {
    const materializer = new TmpfsKeyMaterializer(os.tmpdir());
    let seenDir = '';
    await expect(
      materializer.withKeyFiles(
        { privateKey: 'K', hostKeyLine: 'L' },
        async ({ keyPath }) => {
          seenDir = path.dirname(keyPath);
          throw new Error('boom');
        },
      ),
    ).rejects.toThrow('boom');
    await expect(fs.stat(seenDir)).rejects.toThrow();
  });

  it('defaults to the OS temp dir', async () => {
    const materializer = new TmpfsKeyMaterializer();
    await materializer.withKeyFiles(
      { privateKey: 'K', hostKeyLine: 'L' },
      async ({ keyPath }) => {
        expect(path.dirname(path.dirname(keyPath))).toBe(os.tmpdir());
      },
    );
  });
});

describe('ProcessResticRunner: edge branches', () => {
  it('reports a failing run with empty argv without crashing the message builder', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const done = runner.forget([]);
    cap.controls[0]!.emitStderr('nothing to do');
    cap.controls[0]!.close(1);
    await expect(done).rejects.toThrow(/restic {2}exit 1: nothing to do/);
  });

  it('defaults spawnImpl (real child_process.spawn) and keyMaterializer (TmpfsKeyMaterializer) when omitted', () => {
    // Constructing without these options exercises the `??` fallback
    // branches; we never invoke a real process here, keeping the test fast
    // and deterministic.
    expect(
      () =>
        new ProcessResticRunner({
          repoUrl: '/tmp/does-not-matter',
          password: 'pw',
          binary: 'restic',
          cacheDir: '/tmp/cache',
        }),
    ).not.toThrow();
  });
});

describe('ProcessResticRunner.dump', () => {
  async function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const c of stream) chunks.push(c as Buffer);
    return Buffer.concat(chunks).toString();
  }

  it('streams stdout and resolves done on exit 0', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const handle = await runner.dump(['dump', 'deadbeef', '/redis-dump.rdb']);
    expect(cap.calls[0]!.argv).toEqual([
      '-r',
      'sftp:backup@host:/backups/u/p',
      '--cache-dir',
      '/tmp/cache',
      'dump',
      'deadbeef',
      '/redis-dump.rdb',
    ]);
    const collected = collectStream(handle.stream);
    cap.controls[0]!.emitStdout('rdb-bytes');
    cap.controls[0]!.close(0);
    await expect(handle.done).resolves.toBeUndefined();
    await expect(collected).resolves.toBe('rdb-bytes');
  });

  it('rejects done on a non-zero exit (stream may already have EOFed cleanly)', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const handle = await runner.dump(['dump', 'deadbeef', '/x']);
    const collected = collectStream(handle.stream);
    cap.controls[0]!.emitStderr('repo does not exist');
    cap.controls[0]!.close(1);
    // stdout EOF usually precedes the exit event, so the byte stream can end
    // cleanly even when restic failed — done is the failure authority. This is
    // exactly why performDbRestore awaits done alongside the consumer.
    await expect(handle.done).rejects.toThrow('restic dump exit 1: repo does not exist');
    await collected.catch(() => '');
  });

  it('labels the error with an empty command when args are empty', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const handle = await runner.dump([]);
    cap.controls[0]!.emitStderr('bad usage');
    cap.controls[0]!.close(1);
    await expect(handle.done).rejects.toThrow('restic  exit 1: bad usage');
  });

  it('rejects done and destroys a still-open stream on a spawn error', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap);
    const handle = await runner.dump(['dump', 'deadbeef', '/x']);
    const collected = collectStream(handle.stream);
    cap.controls[0]!.fail(new Error('spawn ENOENT'));
    await expect(handle.done).rejects.toThrow('spawn ENOENT');
    await expect(collected).rejects.toThrow('spawn ENOENT');
  });

  it('ends the stream immediately when the child exposes no stdout', async () => {
    const cap = makeSpawnCapture();
    const noStdoutSpawn: SpawnImpl = (binary, argv, options) => {
      const fake = cap.spawnImpl(binary, argv, options);
      return { ...fake, stdout: null };
    };
    const runner = new ProcessResticRunner({
      repoUrl: 'local:/repo',
      password: 'pw',
      binary: 'restic-test',
      cacheDir: '/tmp/cache',
      spawnImpl: noStdoutSpawn,
    });
    const handle = await runner.dump(['dump', 'deadbeef', '/x']);
    await expect(collectStream(handle.stream)).resolves.toBe('');
    cap.controls[0]!.close(0);
    await expect(handle.done).resolves.toBeUndefined();
  });

  it('SFTP: passes sftp.args and keeps the key files until done settles', async () => {
    const cap = makeSpawnCapture();
    let cleaned = false;
    const trackingKeys: KeyMaterializer = {
      async withKeyFiles(_material, run) {
        const result = await run({
          keyPath: '/tmp/fake-key',
          knownHostsPath: '/tmp/fake-known-hosts',
        });
        cleaned = true;
        return result;
      },
    };
    const runner = new ProcessResticRunner({
      repoUrl: 'sftp:backup@host:/backups/u/p',
      password: 'pw',
      binary: 'restic-test',
      cacheDir: '/tmp/cache',
      spawnImpl: cap.spawnImpl,
      keyMaterializer: trackingKeys,
      ssh: { privateKey: 'PRIVATE', hostKeyLine: 'host ssh-ed25519 AAAA' },
    });
    const handle = await runner.dump(['dump', 'deadbeef', '/x']);
    const sftpOpt = cap.calls[0]!.argv.find((a) => a.startsWith('sftp.args='));
    expect(sftpOpt).toContain('StrictHostKeyChecking=yes');
    // dump() resolved but the process is still running — keys must survive.
    expect(cleaned).toBe(false);
    cap.controls[0]!.close(0);
    await handle.done;
    await new Promise((r) => setImmediate(r));
    expect(cleaned).toBe(true);
  });

  it('SFTP: key-file cleanup still runs when the dump fails (done rejects, no unhandled rejection)', async () => {
    const cap = makeSpawnCapture();
    let cleaned = false;
    const trackingKeys: KeyMaterializer = {
      async withKeyFiles(_material, run) {
        const result = await run({
          keyPath: '/tmp/fake-key',
          knownHostsPath: '/tmp/fake-known-hosts',
        });
        cleaned = true;
        return result;
      },
    };
    const runner = new ProcessResticRunner({
      repoUrl: 'sftp:backup@host:/backups/u/p',
      password: 'pw',
      binary: 'restic-test',
      cacheDir: '/tmp/cache',
      spawnImpl: cap.spawnImpl,
      keyMaterializer: trackingKeys,
      ssh: { privateKey: 'PRIVATE', hostKeyLine: 'host ssh-ed25519 AAAA' },
    });
    const handle = await runner.dump(['dump', 'deadbeef', '/x']);
    cap.controls[0]!.emitStderr('boom');
    cap.controls[0]!.close(3);
    await expect(handle.done).rejects.toThrow('restic dump exit 3: boom');
    await new Promise((r) => setImmediate(r));
    expect(cleaned).toBe(true);
  });

  it('SFTP: a key-materializer setup failure rejects dump() itself', async () => {
    const failingKeys: KeyMaterializer = {
      async withKeyFiles() {
        throw new Error('mkdtemp failed');
      },
    };
    const cap = makeSpawnCapture();
    const runner = new ProcessResticRunner({
      repoUrl: 'sftp:backup@host:/backups/u/p',
      password: 'pw',
      binary: 'restic-test',
      cacheDir: '/tmp/cache',
      spawnImpl: cap.spawnImpl,
      keyMaterializer: failingKeys,
      ssh: { privateKey: 'PRIVATE', hostKeyLine: 'host ssh-ed25519 AAAA' },
    });
    await expect(runner.dump(['dump', 'deadbeef', '/x'])).rejects.toThrow('mkdtemp failed');
  });
});
