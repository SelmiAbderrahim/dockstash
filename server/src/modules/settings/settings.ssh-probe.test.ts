import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { SpawnImpl, SpawnedChild } from '../backups/backups.restic-runner.js';
import { makeProductionSshProbe } from './settings.ssh-probe.js';

interface FakeChildControls {
  child: SpawnedChild;
  emitStdout(data: string): void;
  close(code: number, stderr?: string): void;
}

function makeFakeChild(): FakeChildControls {
  const emitter = new EventEmitter();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const child: SpawnedChild = {
    stdin: null,
    stdout,
    stderr,
    on: (event: string, listener: (...args: never[]) => void) => {
      emitter.on(event, listener as (...args: unknown[]) => void);
    },
  };
  return {
    child,
    emitStdout: (d) => stdout.write(d),
    close: (code, err) => {
      if (err) stderr.write(err);
      stdout.end();
      stderr.end();
      setImmediate(() => emitter.emit('close', code));
    },
  };
}

interface SpawnCapture {
  spawnImpl: SpawnImpl;
  calls: Array<{ binary: string; argv: string[] }>;
  controls: FakeChildControls[];
}

function makeSpawnCapture(): SpawnCapture {
  const calls: SpawnCapture['calls'] = [];
  const controls: FakeChildControls[] = [];
  const spawnImpl: SpawnImpl = (binary, argv) => {
    const fake = makeFakeChild();
    calls.push({ binary, argv });
    controls.push(fake);
    return fake.child;
  };
  return { spawnImpl, calls, controls };
}

async function waitForCall(cap: SpawnCapture, n: number): Promise<void> {
  await vi.waitFor(() => {
    if (cap.calls.length < n) throw new Error('waiting for spawn call');
  });
}

const CONNECT_OPTS = { host: 'storage.example.com', user: 'backup', port: 22, privateKey: 'PK' };

describe('makeProductionSshProbe', () => {
  it('scans the host key, derives its fingerprint, and verifies auth', async () => {
    const cap = makeSpawnCapture();
    const probe = makeProductionSshProbe({ spawnImpl: cap.spawnImpl });

    const result = probe.connect(CONNECT_OPTS);

    await waitForCall(cap, 1);
    expect(cap.calls[0]!.binary).toBe('ssh-keyscan');
    cap.controls[0]!.emitStdout('storage.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5\n');
    cap.controls[0]!.close(0);

    await waitForCall(cap, 2);
    expect(cap.calls[1]!.binary).toBe('ssh-keygen');
    cap.controls[1]!.emitStdout(
      '256 SHA256:abcd1234EFGH storage.example.com (ED25519)\n',
    );
    cap.controls[1]!.close(0);

    await waitForCall(cap, 3);
    expect(cap.calls[2]!.binary).toBe('ssh');
    cap.controls[2]!.close(0);

    await expect(result).resolves.toEqual({
      fingerprint: 'sha256:abcd1234EFGH',
      hostKeyLine: 'storage.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5',
    });
  });

  it('rejects when ssh-keyscan finds no host key (unreachable host)', async () => {
    const cap = makeSpawnCapture();
    const probe = makeProductionSshProbe({ spawnImpl: cap.spawnImpl });

    const result = probe.connect(CONNECT_OPTS);

    await waitForCall(cap, 1);
    cap.controls[0]!.close(1);

    await expect(result).rejects.toThrow(/ssh-keyscan found no host key/);
    expect(cap.calls).toHaveLength(1);
  });

  it('rejects when the auth check fails', async () => {
    const cap = makeSpawnCapture();
    const probe = makeProductionSshProbe({ spawnImpl: cap.spawnImpl });

    const result = probe.connect(CONNECT_OPTS);

    await waitForCall(cap, 1);
    cap.controls[0]!.emitStdout('storage.example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5\n');
    cap.controls[0]!.close(0);

    await waitForCall(cap, 2);
    cap.controls[1]!.emitStdout('256 SHA256:abcd1234EFGH storage.example.com (ED25519)\n');
    cap.controls[1]!.close(0);

    await waitForCall(cap, 3);
    cap.controls[2]!.close(255, 'Permission denied (publickey).');

    await expect(result).rejects.toThrow(/Permission denied/);
  });
});
