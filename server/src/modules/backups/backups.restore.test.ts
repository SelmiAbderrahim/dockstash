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
import type { ResticRunnerExt } from '../scheduler/scheduler.boundaries.js';
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
    const runner = stubRunner();
    const result = await runRestore(
      String(project._id),
      id,
      { snapshotId: 'deadbeef', overwrite: true },
      { resticRunner: runner },
    );
    expect(runner.restore).toHaveBeenCalledWith(['restore', 'deadbeef', '--target', '/']);
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
    ).rejects.toMatchObject({ status: 403 });
  });

  it('stamps failure, alerts, and rethrows a translated 500 on restic errors', async () => {
    const { id } = await seedUser('r@t.com');
    const project = await createProject(id, {
      name: 'app',
      path: '/var/www/app',
      repoPassword: 'pw',
    });
    const runner = stubRunner({
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
    const runner = stubRunner();
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
    expect(runner.restore).toHaveBeenCalledWith(['restore', 'deadbeef', '--target', '/']);
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
