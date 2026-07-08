import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/users.model.js';
import { AuditLog } from '../audit/index.js';
import { enqueueNowSchema } from '../scheduler/scheduler.schema.js';
import { dispatchJob } from '../scheduler/scheduler.dispatcher.js';
import {
  configureSchedulerController,
  resetSchedulerController,
} from '../scheduler/scheduler.controller.js';
import { MemoryQueue } from '../scheduler/scheduler.queue.memory.js';
import { allowAllEntitlements } from '../scheduler/scheduler.entitlements.js';
import { PassThrough } from 'node:stream';
import type { ResticRunnerExt } from '../scheduler/scheduler.boundaries.js';
import type { DockerClient, DockerInspectResult } from './backups.boundaries.js';
import { createProject } from './backups.service.js';
import { runRestore } from './backups.restore.service.js';
import { Project } from './backups.model.js';
import { serializeProject } from './backups.serialize.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'R', lastName: 'S' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

function stubRunner(overrides: Partial<ResticRunnerExt> = {}): ResticRunnerExt {
  return {
    init: vi.fn(async () => {}),
    backup: vi.fn(async () => {}),
    snapshots: vi.fn(async () => []),
    check: vi.fn(async () => {}),
    restore: vi.fn(async () => {}),
    snapshotsDetailed: vi.fn(async () => []),
    dump: vi.fn(async (): Promise<never> => {
      throw new Error('dump not stubbed');
    }),
    unlock: vi.fn(async () => {}),
    forget: vi.fn(async () => {}),
    ...overrides,
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
  resetSchedulerController();
});

describe('enqueueNowSchema: restore refinement', () => {
  const base = { projectId: 'p1', kind: 'restore' as const };

  it('accepts overwrite=true without a target path', () => {
    expect(
      enqueueNowSchema.parse({ ...base, snapshotId: 's1', overwrite: true }),
    ).toMatchObject({ snapshotId: 's1', overwrite: true });
  });

  it('accepts overwrite=false with a target path', () => {
    expect(
      enqueueNowSchema.parse({
        ...base,
        snapshotId: 's1',
        overwrite: false,
        targetPath: '/var/www/restore-here',
      }),
    ).toMatchObject({ targetPath: '/var/www/restore-here' });
  });

  it('rejects restore without snapshotId', () => {
    expect(() => enqueueNowSchema.parse({ ...base, overwrite: true })).toThrow(
      /snapshotId/,
    );
  });

  it('rejects restore without an explicit overwrite boolean', () => {
    expect(() => enqueueNowSchema.parse({ ...base, snapshotId: 's1' })).toThrow(
      /overwrite/,
    );
  });

  it('rejects overwrite=false without targetPath', () => {
    expect(() =>
      enqueueNowSchema.parse({ ...base, snapshotId: 's1', overwrite: false }),
    ).toThrow(/targetPath/);
  });

  it('leaves non-restore kinds untouched by the refinement', () => {
    expect(enqueueNowSchema.parse({ projectId: 'p1', kind: 'backup' })).toMatchObject({
      kind: 'backup',
    });
  });
});

describe('runRestore', () => {
  it('restores to a new location by default and stamps the project', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner();
    const result = await runRestore(
      String(project._id),
      id,
      { snapshotId: 'deadbeef', overwrite: false, targetPath: '/var/www/app-restored' },
      { resticRunner: runner },
    );
    expect(runner.restore).toHaveBeenCalledWith([
      'restore',
      'deadbeef',
      '--target',
      '/var/www/app-restored',
    ]);
    expect(result).toEqual({
      status: 'pass',
      snapshotId: 'deadbeef',
      target: '/var/www/app-restored',
    });
    const row = await Project.findById(project._id);
    expect(row?.lastRestoreStatus).toBe('pass');
    expect(row?.lastRestoreAt).toBeInstanceOf(Date);
    expect(row?.lastRestoreDetail).toBe('');
  });

  it('restores over the original paths when overwrite is explicit', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
      ]),
    });
    const result = await runRestore(
      String(project._id),
      id,
      { snapshotId: 'deadbeef', overwrite: true },
      { resticRunner: runner },
    );
    // Overwrite resolves the snapshot record and restores the FULL id.
    expect(runner.restore).toHaveBeenCalledWith([
      'restore',
      'deadbeefcafe',
      '--target',
      '/',
    ]);
    expect(result.target).toBe('/');
  });

  it('rejects a target path outside the allowlist without touching restic', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner();
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: 'deadbeef', overwrite: false, targetPath: '/etc' },
        { resticRunner: runner },
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: 'deadbeef', overwrite: false },
        { resticRunner: runner },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(runner.restore).not.toHaveBeenCalled();
  });

  it('rejects a malformed snapshotId before touching restic (argv injection guard)', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner();
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: '--insecure-no-password', overwrite: true },
        { resticRunner: runner },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(runner.restore).not.toHaveBeenCalled();
  });

  it('enforces ownership', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const project = await createProject(a.id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    await expect(
      runRestore(
        String(project._id),
        b.id,
        { snapshotId: 'deadbeef', overwrite: true },
        { resticRunner: stubRunner() },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('stamps failure, alerts, and rethrows a translated 500 on restic errors', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
      ]),
      restore: vi.fn(async () => {
        throw new Error('snapshot not found');
      }),
    });
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: 'deadbeef', overwrite: true },
        { resticRunner: runner },
      ),
    ).rejects.toMatchObject({ status: 500 });
    const row = await Project.findById(project._id);
    expect(row?.lastRestoreStatus).toBe('fail');
    expect(row?.lastRestoreDetail).toContain('snapshot not found');
  });

  it('stringifies non-Error restic failures', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
      ]),
      restore: vi.fn(async () => {
        throw 'weird failure';
      }),
    });
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: 'deadbeef', overwrite: true },
        { resticRunner: runner },
      ),
    ).rejects.toMatchObject({ status: 500 });
    const row = await Project.findById(project._id);
    expect(row?.lastRestoreDetail).toBe('weird failure');
  });
});

describe('dispatchJob: restore kind', () => {
  it('routes restore payloads to runRestore', async () => {
    const { id } = await seedUser('d@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
      ]),
    });
    await dispatchJob(
      {
        id: 'j1',
        attempts: 1,
        data: {
          projectId: String(project._id),
          owner: id,
          kind: 'restore',
          payload: { snapshotId: 'deadbeef', overwrite: true },
        },
      },
      { resticRunner: runner },
    );
    expect(runner.restore).toHaveBeenCalledWith([
      'restore',
      'deadbeefcafe',
      '--target',
      '/',
    ]);
  });

  it('throws when a restore job carries no payload', async () => {
    await expect(
      dispatchJob(
        {
          id: 'j1',
          attempts: 1,
          data: { projectId: 'p', owner: 'o', kind: 'restore' },
        },
        { resticRunner: stubRunner() },
      ),
    ).rejects.toThrow(/requires a restore payload/);
  });
});

describe('POST /api/scheduler/enqueue: restore end-to-end', () => {
  it('accepts the client restore body, runs the job, stamps + audits', async () => {
    const { id, token } = await seedUser('e2e@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner();
    const queue = new MemoryQueue();
    queue.setProcessor(async (job) => {
      await dispatchJob(job, { resticRunner: runner });
    });
    configureSchedulerController({ queue, entitlements: allowAllEntitlements });

    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${token}`)
      .send({
        projectId: String(project._id),
        kind: 'restore',
        snapshotId: 'deadbeef',
        overwrite: false,
        targetPath: '/var/www/app-restore',
      });
    expect(res.status).toBe(202);
    expect(res.body.job).toMatchObject({ kind: 'restore' });
    expect(typeof res.body.job.id).toBe('string');

    await queue.waitIdle();
    expect(runner.restore).toHaveBeenCalledWith([
      'restore',
      'deadbeef',
      '--target',
      '/var/www/app-restore',
    ]);
    const row = await Project.findById(project._id);
    expect(row?.lastRestoreStatus).toBe('pass');

    const audits = await AuditLog.find({ action: 'backup.restore' });
    expect(audits).toHaveLength(1);
    expect(audits[0]?.metadata).toMatchObject({
      kind: 'restore',
      snapshotId: 'deadbeef',
      overwrite: false,
    });
    await queue.close();
  });

  it('rejects a restore enqueue missing its snapshot id', async () => {
    const { id, token } = await seedUser('e2e@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    configureSchedulerController({
      queue: new MemoryQueue(),
      entitlements: allowAllEntitlements,
    });
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${token}`)
      .send({ projectId: String(project._id), kind: 'restore', overwrite: true });
    expect(res.status).toBe(400);
  });
});

describe('serializeProject: restore stamps', () => {
  it('serializes null and populated restore stamps', async () => {
    const { id } = await seedUser('s@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const fresh = serializeProject(project);
    expect(fresh.lastRestoreAt).toBeNull();
    expect(fresh.lastRestoreStatus).toBeNull();
    expect(fresh.lastRestoreDetail).toBe('');

    project.lastRestoreAt = new Date('2026-07-01T00:00:00Z');
    project.lastRestoreStatus = 'pass';
    project.lastRestoreDetail = 'ok';
    await project.save();
    const stamped = serializeProject(project);
    expect(stamped.lastRestoreAt).toBe('2026-07-01T00:00:00.000Z');
    expect(stamped.lastRestoreStatus).toBe('pass');
    expect(stamped.lastRestoreDetail).toBe('ok');
  });
});

describe('runRestore: overwrite classification (paths pre-flight + DB restore)', () => {
  const REDIS_SNAP = [
    { id: '5ad025be1234', short_id: '5ad025be', time: 't1', paths: ['/redis-dump.rdb'] },
  ];

  interface DockerStubState {
    docker: DockerClient;
    execCalls: Array<{ container: string; argv: string[] }>;
    stdinCalls: Array<{ container: string; argv: string[] }>;
    restartCalls: string[];
  }

  function stubDocker(opts: {
    inspect?: DockerInspectResult;
    stdinResult?: { exitCode: number; stderr: string };
  } = {}): DockerStubState {
    const execCalls: Array<{ container: string; argv: string[] }> = [];
    const stdinCalls: Array<{ container: string; argv: string[] }> = [];
    const restartCalls: string[] = [];
    const docker: DockerClient = {
      async exec() {
        throw new Error('unused');
      },
      async execStream() {
        throw new Error('unused');
      },
      async execCollect(container, argv) {
        execCalls.push({ container, argv });
        return { exitCode: 0, stdout: '', stderr: '' };
      },
      async execWithStdin(container, argv) {
        stdinCalls.push({ container, argv });
        return opts.stdinResult ?? { exitCode: 0, stderr: '' };
      },
      async restart(container) {
        restartCalls.push(container);
      },
      async inspect(container) {
        return opts.inspect ?? { id: container, running: true, env: [], cmd: [], image: 'redis:7-alpine' };
      },
      async listContainers() {
        return [];
      },
    };
    return { docker, execCalls, stdinCalls, restartCalls };
  }

  function dumpingRunner(overrides: Partial<ResticRunnerExt> = {}): ResticRunnerExt {
    return stubRunner({
      snapshotsDetailed: vi.fn(async () => REDIS_SNAP),
      dump: vi.fn(async () => {
        const stream = new PassThrough();
        stream.end('rdb-bytes');
        return { stream, done: Promise.resolve() };
      }),
      ...overrides,
    });
  }

  async function seedRedisProject(): Promise<{ id: string; projectId: string }> {
    const { id } = await seedUser('db@t.com');
    const project = await createProject(id, {
      name: 'thakaatprodapi',
      path: '/var/www/thakaat',
      repoPassword: 'pw',
    });
    project.plan.databases = [
      { service: 'redis', type: 'redis', container: 'thakaatprodredis', enabled: true },
    ] as typeof project.plan.databases;
    await project.save();
    return { id, projectId: String(project._id) };
  }

  it('streams a redis artifact snapshot back into the container (the prod 5ad025be case)', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = dumpingRunner();
    const { docker, execCalls, stdinCalls, restartCalls } = stubDocker();
    const result = await runRestore(
      projectId,
      id,
      { snapshotId: '5ad025be', overwrite: true },
      { resticRunner: runner, dockerClient: docker },
    );
    expect(result).toEqual({ status: 'pass', snapshotId: '5ad025be', target: 'thakaatprodredis' });
    // Never a filesystem restore for a DB artifact.
    expect(runner.restore).not.toHaveBeenCalled();
    expect(runner.dump).toHaveBeenCalledWith(['dump', '5ad025be1234', '/redis-dump.rdb']);
    expect(execCalls.map((c) => c.argv[0])).toEqual([
      'redis-cli',
      'redis-cli',
      'redis-cli',
      'mv',
      'mkdir',
      'cp',
      'rm',
      'mv',
    ]);
    expect(stdinCalls[0]).toMatchObject({
      container: 'thakaatprodredis',
      argv: ['dd', 'of=/data/dump.rdb.dockstash-restore'],
    });
    expect(restartCalls).toEqual(['thakaatprodredis']);
    const row = await Project.findById(projectId);
    expect(row?.lastRestoreStatus).toBe('pass');
  });

  it('tolerates a snapshot record with no paths field (vacuous pre-flight)', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1' },
      ]),
    });
    const result = await runRestore(
      projectId,
      id,
      { snapshotId: 'deadbeef', overwrite: true },
      { resticRunner: runner, dockerClient: stubDocker().docker },
    );
    expect(result.target).toBe('/');
    expect(runner.restore).toHaveBeenCalledWith(['restore', 'deadbeefcafe', '--target', '/']);
  });

  it('falls back to the plan type when inspect reports no image', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = dumpingRunner();
    const { docker, restartCalls } = stubDocker({
      inspect: { id: 'thakaatprodredis', running: true, env: [], cmd: [], image: '' },
    });
    await runRestore(
      projectId,
      id,
      { snapshotId: '5ad025be', overwrite: true },
      { resticRunner: runner, dockerClient: docker },
    );
    expect(restartCalls).toEqual(['thakaatprodredis']);
  });

  it('rejects an unknown snapshot id with a 400 and no failure stamp', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = stubRunner({ snapshotsDetailed: vi.fn(async () => []) });
    await expect(
      runRestore(
        projectId,
        id,
        { snapshotId: 'deadbeef', overwrite: true },
        { resticRunner: runner, dockerClient: stubDocker().docker },
      ),
    ).rejects.toMatchObject({ status: 400 });
    const row = await Project.findById(projectId);
    expect(row?.lastRestoreStatus ?? null).toBeNull();
  });

  it('resolves `latest` to the newest snapshot and accepts full-id prefixes', async () => {
    const { id, projectId } = await seedRedisProject();
    const snaps = [
      { id: 'aaaa1111aaaa', short_id: 'aaaa1111', time: '2026-07-01T00:00:00Z', paths: ['/redis-dump.rdb'] },
      { id: 'bbbb2222bbbb', short_id: 'bbbb2222', time: '2026-07-05T00:00:00Z', paths: ['/redis-dump.rdb'] },
    ];
    const runner = dumpingRunner({ snapshotsDetailed: vi.fn(async () => snaps) });
    const { docker } = stubDocker();
    await runRestore(
      projectId,
      id,
      { snapshotId: 'latest', overwrite: true },
      { resticRunner: runner, dockerClient: docker },
    );
    expect(runner.dump).toHaveBeenCalledWith(['dump', 'bbbb2222bbbb', '/redis-dump.rdb']);

    await runRestore(
      projectId,
      id,
      { snapshotId: 'aaaa1111aa', overwrite: true },
      { resticRunner: runner, dockerClient: docker },
    );
    expect(runner.dump).toHaveBeenCalledWith(['dump', 'aaaa1111aaaa', '/redis-dump.rdb']);
  });

  it('fails with a stamped 500 when no dockerClient is wired for a DB restore', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = dumpingRunner();
    await expect(
      runRestore(projectId, id, { snapshotId: '5ad025be', overwrite: true }, { resticRunner: runner }),
    ).rejects.toMatchObject({ status: 500 });
    const row = await Project.findById(projectId);
    expect(row?.lastRestoreStatus).toBe('fail');
  });

  it('refuses a stopped target container with a 400', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = dumpingRunner();
    const { docker } = stubDocker({
      inspect: { id: 'thakaatprodredis', running: false, env: [], cmd: [], image: 'redis:7-alpine' },
    });
    await expect(
      runRestore(
        projectId,
        id,
        { snapshotId: '5ad025be', overwrite: true },
        { resticRunner: runner, dockerClient: docker },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses an unsupported engine with a 400 pointing at restore-to-path', async () => {
    const { id } = await seedUser('ch@t.com');
    const project = await createProject(id, {
      name: 'chproj',
      path: '/var/www/ch',
      repoPassword: 'pw',
    });
    project.plan.databases = [
      { service: 'ch', type: 'clickhouse', container: 'c-ch', enabled: true },
    ] as typeof project.plan.databases;
    await project.save();
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'abcd1234abcd', short_id: 'abcd1234', time: 't1', paths: ['/ch.tar'] },
      ]),
    });
    const { docker } = stubDocker({
      inspect: { id: 'c-ch', running: true, env: [], cmd: [], image: 'clickhouse/clickhouse-server:24' },
    });
    await expect(
      runRestore(
        String(project._id),
        id,
        { snapshotId: 'abcd1234', overwrite: true },
        { resticRunner: runner, dockerClient: docker },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a paths overwrite whose snapshot paths fall outside the allowlist (old Fatal failure mode)', async () => {
    const { id, projectId } = await seedRedisProject();
    // A stray root-level file that matches no plan artifact → classified as
    // paths, then rejected by the pre-flight instead of hitting restic Fatal.
    const runner = stubRunner({
      snapshotsDetailed: vi.fn(async () => [
        { id: 'ffff0000ffff', short_id: 'ffff0000', time: 't1', paths: ['/stray-file.bin'] },
      ]),
    });
    await expect(
      runRestore(
        projectId,
        id,
        { snapshotId: 'ffff0000', overwrite: true },
        { resticRunner: runner, dockerClient: stubDocker().docker },
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(runner.restore).not.toHaveBeenCalled();
  });

  it('stamps failure + 500 with the per-engine message when the DB restore fails', async () => {
    const { id, projectId } = await seedRedisProject();
    const runner = dumpingRunner();
    const { docker } = stubDocker({ stdinResult: { exitCode: 1, stderr: 'dd: no space' } });
    await expect(
      runRestore(
        projectId,
        id,
        { snapshotId: '5ad025be', overwrite: true },
        { resticRunner: runner, dockerClient: docker },
      ),
    ).rejects.toMatchObject({ status: 500 });
    const row = await Project.findById(projectId);
    expect(row?.lastRestoreStatus).toBe('fail');
    expect(row?.lastRestoreDetail).toContain('restore redis (redis) in thakaatprodredis');
    expect(row?.lastRestoreDetail).toContain('dd: no space');
  });
});
