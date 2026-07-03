import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ProcessResticRunner,
  TmpfsKeyMaterializer,
  type KeyMaterializer,
  type SpawnImpl,
  type SpawnedChild,
} from './backups.restic-runner.js';

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

  it('always forces StrictHostKeyChecking=yes for SFTP repos', async () => {
    const cap = makeSpawnCapture();
    const runner = makeRunner(cap, true);
    const done = runner.backup(['backup', '/var/www/x']);
    cap.controls[0]!.close(0);
    await done;
    const sftpOpt = cap.calls[0]!.argv.find((a) => a.startsWith('sftp.command='));
    expect(sftpOpt).toBeDefined();
    expect(sftpOpt).toContain('StrictHostKeyChecking=yes');
    expect(sftpOpt).toContain('UserKnownHostsFile=/tmp/fake-known-hosts');
    expect(sftpOpt).toContain('-i /tmp/fake-key');
    expect(sftpOpt).not.toContain('StrictHostKeyChecking=no');
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

  it('falls back to env defaults for binary and cache dir', async () => {
    const cap = makeSpawnCapture();
    const runner = new ProcessResticRunner({
      repoUrl: '/tmp/repo',
      password: 'pw',
      spawnImpl: cap.spawnImpl,
      keyMaterializer: passthroughKeys,
    });
    const done = runner.unlock();
    cap.controls[0]!.close(0);
    await done;
    expect(cap.calls[0]!.binary).toBe('restic');
    expect(cap.calls[0]!.argv).toContain('/tmp/restic-cache');
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
        // normalizePrivateKey() guarantees exactly one trailing newline (OpenSSH
        // rejects a key file without it), so the materialized file is 'KEY-BYTES\n'.
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
});
