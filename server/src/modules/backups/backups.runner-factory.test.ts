import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/users.model.js';
import { upsertStorage, testStorage } from '../settings/settings.service.js';
import type { ResticRunnerExt } from '../scheduler/scheduler.boundaries.js';
import { createProject } from './backups.service.js';
import {
  makeDispatchDepsFor,
  makeResticRunnerFor,
  placeholderResticRunner,
  resolveProjectRunner,
} from './backups.runner-factory.js';
import type { ProcessResticRunnerOptions } from './backups.restic-runner.js';
import {
  makeArtifactDbDiff,
  makeHashFileDiff,
  makeStatfsDiskProbe,
  makeTmpScratch,
} from './backups.diff.js';

const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';

async function seedUser(email: string): Promise<string> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'F', lastName: 'A' },
    emailVerified: true,
  });
  return u._id.toString();
}

async function seedConfiguredStorage(userId: string): Promise<void> {
  await upsertStorage(userId, {
    host: 'storage.example.com',
    user: 'backup',
    port: 22,
    privateKey: 'PRIVATE-KEY-MATERIAL',
  });
  await testStorage(userId, {
    probe: {
      async connect() {
        return { fingerprint: PIN, hostKeyLine: 'storage.example.com ssh-ed25519 AAAA' };
      },
    },
  });
}

function stubRunner(): ResticRunnerExt {
  return {
    init: vi.fn(async () => {}),
    backup: vi.fn(async () => {}),
    snapshots: vi.fn(async () => []),
    check: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    unlock: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
  };
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

describe('placeholderResticRunner', () => {
  it('throws on every method', async () => {
    const r = placeholderResticRunner();
    await expect(r.init()).rejects.toThrow('restic runner not wired');
    await expect(r.backup([])).rejects.toThrow('restic runner not wired');
    await expect(r.snapshots()).rejects.toThrow('restic runner not wired');
    await expect(r.check([])).rejects.toThrow('restic runner not wired');
    await expect(r.restore([])).rejects.toThrow('restic runner not wired');
    await expect(r.unlock()).rejects.toThrow('restic runner not wired');
    await expect(r.forget([])).rejects.toThrow('restic runner not wired');
  });
});

describe('resolveProjectRunner', () => {
  it('builds a runner bound to the project repo URL and SSH material', async () => {
    const uid = await seedUser('f@t.com');
    await seedConfiguredStorage(uid);
    const project = await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'repo-secret',
    });
    let seen: ProcessResticRunnerOptions | null = null;
    const runner = stubRunner();
    const built = await resolveProjectRunner(String(project._id), uid, (opts) => {
      seen = opts;
      return runner;
    });
    expect(built).toBe(runner);
    expect(seen!.repoUrl).toBe(
      `sftp:backup@storage.example.com:/backups/${uid}/${String(project._id)}`,
    );
    expect(seen!.password).toBe('repo-secret');
    expect(seen!.ssh).toEqual({
      privateKey: 'PRIVATE-KEY-MATERIAL',
      hostKeyLine: 'storage.example.com ssh-ed25519 AAAA',
    });
  });

  it('rejects a missing project and a foreign owner', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    await seedConfiguredStorage(a);
    const project = await createProject(a, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    await expect(
      resolveProjectRunner('507f1f77bcf86cd799439011', a, stubRunner),
    ).rejects.toThrow(/not found for owner/);
    await expect(
      resolveProjectRunner(String(project._id), b, stubRunner),
    ).rejects.toThrow(/not found for owner/);
  });

  it('rejects when storage is unconfigured', async () => {
    const uid = await seedUser('f@t.com');
    const project = await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    await expect(
      resolveProjectRunner(String(project._id), uid, stubRunner),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('makeResticRunnerFor', () => {
  it('resolves lazily and memoizes across calls', async () => {
    const uid = await seedUser('f@t.com');
    await seedConfiguredStorage(uid);
    const project = await createProject(uid, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const inner = stubRunner();
    const build = vi.fn(() => inner);
    const lazy = makeResticRunnerFor(String(project._id), uid, build);
    expect(build).not.toHaveBeenCalled();
    await lazy.init();
    await lazy.backup(['backup', '/var/www/app']);
    await lazy.snapshots();
    await lazy.check(['check']);
    await lazy.restore(['restore']);
    await lazy.unlock();
    await lazy.forget(['forget']);
    expect(build).toHaveBeenCalledTimes(1);
    expect(inner.backup).toHaveBeenCalledWith(['backup', '/var/www/app'], undefined);
  });

  it('propagates resolution failures to the caller', async () => {
    const lazy = makeResticRunnerFor('507f1f77bcf86cd799439011', 'ffffffffffffffffffffffff');
    await expect(lazy.init()).rejects.toThrow();
  });
});

describe('makeDispatchDepsFor', () => {
  it('includes a docker client when a docker host is provided', () => {
    const deps = makeDispatchDepsFor({ dockerHost: 'tcp://proxy:2375' });
    expect(deps.dockerClient).toBeDefined();
    expect(deps.diskProbe).toBeDefined();
    expect(deps.scratch).toBeDefined();
    expect(deps.fileDiff).toBeDefined();
    expect(deps.dbDiff).toBeDefined();
  });

  it('omits the docker client when no docker host is configured', () => {
    const deps = makeDispatchDepsFor({});
    expect(deps.dockerClient).toBeUndefined();
  });
});

describe('backups.diff production implementations', () => {
  it('hash diff reports clean, mismatched, and missing files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'diff-test-'));
    const source = path.join(root, 'src');
    const restored = path.join(root, 'restored');
    const mirror = path.join(restored, source);
    await fs.mkdir(path.join(source, 'nested'), { recursive: true });
    await fs.mkdir(path.join(mirror, 'nested'), { recursive: true });
    await fs.writeFile(path.join(source, 'same.txt'), 'same');
    await fs.writeFile(path.join(mirror, 'same.txt'), 'same');
    await fs.writeFile(path.join(source, 'nested', 'changed.txt'), 'v1');
    await fs.writeFile(path.join(mirror, 'nested', 'changed.txt'), 'v2');
    await fs.writeFile(path.join(source, 'missing.txt'), 'gone');

    const result = await makeHashFileDiff().diff(source, restored);
    expect(result.mismatches).toBe(2);
    expect(result.details.join('\n')).toContain('hash mismatch');
    expect(result.details.join('\n')).toContain('missing restored file');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('hash diff tolerates an unreadable source root', async () => {
    const result = await makeHashFileDiff().diff('/nonexistent-src', '/nonexistent-restore');
    expect(result.mismatches).toBe(0);
  });

  it('artifact db diff distinguishes present, empty, and missing dumps', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dbdiff-test-'));
    const full = path.join(root, 'full.dump');
    const empty = path.join(root, 'empty.dump');
    await fs.writeFile(full, 'data');
    await fs.writeFile(empty, '');
    const differ = makeArtifactDbDiff();
    await expect(
      differ.diff({ container: 'c', service: 's', restoredDumpPath: full }),
    ).resolves.toEqual({ mismatches: 0, details: [] });
    await expect(
      differ.diff({ container: 'c', service: 's', restoredDumpPath: empty }),
    ).resolves.toMatchObject({ mismatches: 1 });
    await expect(
      differ.diff({ container: 'c', service: 's', restoredDumpPath: path.join(root, 'nope') }),
    ).resolves.toMatchObject({ mismatches: 1 });
    await fs.rm(root, { recursive: true, force: true });
  });

  it('scratch creates unique dirs and remove tolerates absence', async () => {
    const scratch = makeTmpScratch();
    const a = await scratch.create();
    const b = await scratch.create();
    expect(a).not.toBe(b);
    await scratch.remove(a);
    await scratch.remove(a); // second remove: force-tolerant
    await scratch.remove(b);
    await expect(fs.stat(a)).rejects.toThrow();
  });

  it('statfs probe reports positive free bytes for tmp', async () => {
    const probe = makeStatfsDiskProbe();
    const free = await probe.freeBytes();
    expect(free).toBeGreaterThan(0);
  });
});
