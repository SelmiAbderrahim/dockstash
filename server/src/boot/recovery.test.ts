import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app.js';
import { env } from '../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../shared/testing/mongo.js';
import { User } from '../modules/users/users.model.js';
import { upsertStorage, testStorage } from '../modules/settings/settings.service.js';
import { createProject } from '../modules/backups/backups.service.js';
import { ProcessResticRunner } from '../modules/backups/backups.restic-runner.js';
import { resetRecoveryController } from '../modules/recovery/recovery.controller.js';
import {
  deriveSelfBackupPassword,
  makeMongoDumpRunner,
  probeProjectRepo,
  wireRecoveryController,
} from './recovery.js';

const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';
const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<string> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'B', lastName: 'R' },
    emailVerified: true,
  });
  return u._id.toString();
}

async function seedConfiguredStorage(userId: string): Promise<void> {
  await upsertStorage(userId, {
    host: 'storage.example.com',
    user: 'backup',
    port: 22,
    privateKey: 'PRIVATE-KEY',
  });
  await testStorage(userId, {
    probe: {
      async connect() {
        return { fingerprint: PIN, hostKeyLine: 'storage.example.com ssh-ed25519 AAAA' };
      },
    },
  });
}

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
}

function makeFakeSpawn(): {
  spawnFn: (cmd: string, argv: string[], opts: unknown) => FakeChild;
  calls: Array<{ cmd: string; argv: string[] }>;
  children: FakeChild[];
} {
  const calls: Array<{ cmd: string; argv: string[] }> = [];
  const children: FakeChild[] = [];
  const spawnFn = (cmd: string, argv: string[]): FakeChild => {
    const child = new EventEmitter() as FakeChild;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    calls.push({ cmd, argv });
    children.push(child);
    return child;
  };
  return { spawnFn, calls, children };
}

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});
afterEach(() => {
  resetRecoveryController();
  vi.restoreAllMocks();
});

describe('makeMongoDumpRunner', () => {
  it('spawns mongodump argv-only against the configured URI', async () => {
    const fake = makeFakeSpawn();
    const runner = makeMongoDumpRunner(fake.spawnFn as never);
    const stream = await runner.dump();
    expect(fake.calls[0]!.cmd).toBe('mongodump');
    expect(fake.calls[0]!.argv).toContain('--archive');
    expect(fake.calls[0]!.argv).toContain('--uri');
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    fake.children[0]!.stdout.end('dump-bytes');
    fake.children[0]!.emit('close', 0);
    await new Promise((r) => setImmediate(r));
    expect(Buffer.concat(chunks).toString()).toBe('dump-bytes');
  });

  it('destroys the stream when mongodump exits non-zero', async () => {
    const fake = makeFakeSpawn();
    const runner = makeMongoDumpRunner(fake.spawnFn as never);
    const stream = await runner.dump();
    const errPromise = new Promise<Error>((resolve) => stream.on('error', resolve));
    fake.children[0]!.stderr.end('auth failed');
    await new Promise((r) => setImmediate(r));
    fake.children[0]!.emit('close', 1);
    const err = await errPromise;
    expect(err.message).toContain('mongodump exit 1');
    expect(err.message).toContain('auth failed');
  });

  it('destroys the stream on spawn errors', async () => {
    const fake = makeFakeSpawn();
    const runner = makeMongoDumpRunner(fake.spawnFn as never);
    const stream = await runner.dump();
    const errPromise = new Promise<Error>((resolve) => stream.on('error', resolve));
    fake.children[0]!.emit('error', new Error('ENOENT'));
    await expect(errPromise).resolves.toMatchObject({ message: 'ENOENT' });
  });
});

describe('probeProjectRepo', () => {
  it('cat-configs the project repo through the owner transport', async () => {
    const uid = await seedUser('probe@t.com');
    await seedConfiguredStorage(uid);
    const project = await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const spy = vi
      .spyOn(ProcessResticRunner.prototype, 'check')
      .mockResolvedValue(undefined);
    await probeProjectRepo(project, 'imported-password');
    expect(spy).toHaveBeenCalledWith(['cat', 'config']);
  });

  it('fails when the owner has no configured storage', async () => {
    const uid = await seedUser('probe@t.com');
    const project = await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    await expect(probeProjectRepo(project, 'pw')).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('wireRecoveryController (via /api/recovery/export)', () => {
  it('export includes the storage envelope once wired', async () => {
    const uid = await seedUser('wire@t.com');
    await seedConfiguredStorage(uid);
    await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    wireRecoveryController({ spawnFn: makeFakeSpawn().spawnFn as never });
    const res = await request(app)
      .post('/api/recovery/export')
      .set('Authorization', `JWT ${signToken(uid)}`);
    expect(res.status).toBe(200);
    expect(res.body.storage).toMatchObject({
      host: 'storage.example.com',
      user: 'backup',
    });
    expect(res.body.storage.sshKeyEnc.ciphertext).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE-KEY');
    expect(res.body.projects).toHaveLength(1);
  });

  it('export omits storage for a user without settings', async () => {
    const uid = await seedUser('nosettings@t.com');
    wireRecoveryController({ spawnFn: makeFakeSpawn().spawnFn as never });
    const res = await request(app)
      .post('/api/recovery/export')
      .set('Authorization', `JWT ${signToken(uid)}`);
    expect(res.status).toBe(200);
    expect(res.body.storage).toBeUndefined();
  });
});

describe('wireRecoveryController defaults', () => {
  it('wires with the real spawn function when no override is given', () => {
    expect(() => wireRecoveryController()).not.toThrow();
  });

  it('initializes once and coalesces overlapping self-backup runs', async () => {
    let releaseInit!: () => void;
    const init = vi.spyOn(ProcessResticRunner.prototype, 'init').mockImplementation(
      () => new Promise<void>((resolve) => {
        releaseInit = resolve;
      }),
    );
    const backup = vi.spyOn(ProcessResticRunner.prototype, 'backup').mockResolvedValue();
    const runtime = wireRecoveryController({ spawnFn: makeFakeSpawn().spawnFn as never });

    const first = runtime.runNow();
    const second = runtime.runNow();
    expect(second).toBe(first);
    await vi.waitFor(() => expect(init).toHaveBeenCalledTimes(1));
    releaseInit();
    await first;
    expect(backup).toHaveBeenCalledTimes(1);
  });
});

describe('deriveSelfBackupPassword (S7-03)', () => {
  it('never returns the master key verbatim', () => {
    const master = 'a'.repeat(64); // 64 hex chars → 32 bytes
    const password = deriveSelfBackupPassword(master);
    expect(password).not.toBe(master);
    // 32 bytes → 64 hex chars, and different from the master.
    expect(password).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same master key (recoverable from `.env`)', () => {
    const master = 'a'.repeat(64);
    expect(deriveSelfBackupPassword(master)).toBe(deriveSelfBackupPassword(master));
  });

  it('produces a distinct output per master key', () => {
    expect(deriveSelfBackupPassword('a'.repeat(64))).not.toBe(
      deriveSelfBackupPassword('b'.repeat(64)),
    );
  });
});
