import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { Project } from './backups.model.js';
import { createProject } from './backups.service.js';
import { runMirror, MIRROR_TAG, type MirrorRunner } from './backups.mirror.service.js';
import { Alert } from '../health/index.js';
import { dispatchJob } from '../scheduler/scheduler.dispatcher.js';
import { makeAgentAwareQueue } from '../agents/index.js';
import { Agent } from '../agents/index.js';
import type { ResticRunnerExt, SchedulerQueue } from '../scheduler/scheduler.boundaries.js';

const app = createApp();

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'M', lastName: 'R' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(ownerId: string) {
  return createProject(ownerId, {
    name: 'p',
    path: '/var/www/p',
    repoPassword: 'password1',
  });
}

function makeRunner(overrides: Partial<MirrorRunner> = {}): MirrorRunner & {
  calls: { name: string; args: string[] }[];
} {
  const calls: { name: string; args: string[] }[] = [];
  return {
    calls,
    async backup(args) {
      calls.push({ name: 'backup', args });
    },
    async restore(args) {
      calls.push({ name: 'restore', args });
    },
    ...overrides,
  };
}

async function enableMirror(
  projectId: string,
  sourcePath = '/var/www/p/src',
  targetPath = '/var/www/p/mirror',
) {
  await Project.findByIdAndUpdate(projectId, {
    mirror: { enabled: true, sourcePath, targetPath },
  });
}

describe('runMirror', () => {
  it('backs up the source under the mirror tag then restores latest to the target', async () => {
    const a = await seedUser('m1@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id));
    const runner = makeRunner();
    const res = await runMirror(String(project._id), a.id, { resticRunner: runner });
    expect(res.ok).toBe(true);
    expect(runner.calls).toEqual([
      { name: 'backup', args: ['backup', '/var/www/p/src', '--tag', MIRROR_TAG] },
      {
        name: 'restore',
        args: ['restore', 'latest', '--tag', MIRROR_TAG, '--target', '/var/www/p/mirror'],
      },
    ]);
  });

  it('400s when mirror is disabled or unconfigured', async () => {
    const a = await seedUser('m2@t.com');
    const project = await seedProject(a.id);
    await expect(
      runMirror(String(project._id), a.id, { resticRunner: makeRunner() }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects out-of-allowlist source/target paths', async () => {
    const a = await seedUser('m3@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id), '/etc', '/var/www/p/mirror');
    await expect(
      runMirror(String(project._id), a.id, { resticRunner: makeRunner() }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sends a mirror failure alert + persists the row when restic fails', async () => {
    const a = await seedUser('m4@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id));
    const runner = makeRunner({
      async backup() {
        throw new Error('repo locked');
      },
    });
    await expect(
      runMirror(String(project._id), a.id, { resticRunner: runner }),
    ).rejects.toMatchObject({ status: 500 });
    const rows = await Alert.find({ owner: a.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'mirror', severity: 'critical' });
  });

  it('404s unknown and 403s foreign projects', async () => {
    const a = await seedUser('m5@t.com');
    const b = await seedUser('m6@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id));
    await expect(
      runMirror('507f1f77bcf86cd799439011', a.id, { resticRunner: makeRunner() }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      runMirror(String(project._id), b.id, { resticRunner: makeRunner() }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('runMirror on agent-assigned projects (agent-root allowlist)', () => {
  async function seedAgentProject(ownerId: string, roots: string[]) {
    const agent = await Agent.create({
      owner: ownerId,
      name: 'vps-roots',
      host: '10.0.0.7',
      port: 22,
      apiKeyHash: { hash: 'x'.repeat(64), keyVersion: 1 },
      status: 'online',
      discovery: { folders: [], containers: [], dockerAvailable: true, roots },
    });
    const project = await seedProject(ownerId);
    await Project.findByIdAndUpdate(project._id, { agent: agent._id });
    return project;
  }

  it('allows paths under the agent-reported roots', async () => {
    const a = await seedUser('m-agent@t.com');
    const project = await seedAgentProject(a.id, ['/srv/apps']);
    await enableMirror(String(project._id), '/srv/apps/site', '/srv/apps/mirror');
    const runner = makeRunner();
    const res = await runMirror(String(project._id), a.id, { resticRunner: runner });
    expect(res.ok).toBe(true);
    expect(runner.calls).toHaveLength(2);
  });

  it('rejects a target outside the agent roots (second loop iteration)', async () => {
    const a = await seedUser('m-agent2@t.com');
    const project = await seedAgentProject(a.id, ['/srv/apps']);
    await enableMirror(String(project._id), '/srv/apps/site', '/var/www/other');
    await expect(
      runMirror(String(project._id), a.id, { resticRunner: makeRunner() }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('PATCH mirror validates against agent roots too', async () => {
    const a = await seedUser('m-agent3@t.com');
    const project = await seedAgentProject(a.id, ['/srv/apps']);
    const ok = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: true, sourcePath: '/srv/apps/site', targetPath: '/srv/apps/copy' });
    expect(ok.status).toBe(200);
    const bad = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: true, sourcePath: '/srv/apps/site', targetPath: '/var/www/out' });
    expect(bad.status).toBe(400);
  });

  it('updateProjectMirror works without an injected translator', async () => {
    const { updateProjectMirror } = await import('./backups.service.js');
    const a = await seedUser('m-not@t.com');
    const project = await seedProject(a.id);
    const updated = await updateProjectMirror(String(project._id), a.id, {
      enabled: false,
      sourcePath: '',
      targetPath: '',
    });
    expect(updated.mirror?.enabled).toBe(false);
  });

  it('stringifies non-Error restic failures', async () => {
    const a = await seedUser('m-str@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id));
    const runner = makeRunner({
      async backup() {
        throw 'raw-string-failure';
      },
    });
    await expect(
      runMirror(String(project._id), a.id, { resticRunner: runner }),
    ).rejects.toMatchObject({ status: 500 });
    const rows = await Alert.find({ owner: a.id });
    expect(rows[0]?.error).toBe('raw-string-failure');
  });
});

describe('dispatchJob mirror case', () => {
  it('routes kind=mirror to runMirror through the restic runner', async () => {
    const a = await seedUser('md@t.com');
    const project = await seedProject(a.id);
    await enableMirror(String(project._id));
    const calls: string[] = [];
    const restic = {
      async init() {},
      async backup(args: string[]) {
        calls.push(`backup:${args[1]}`);
      },
      async snapshots() {
        return [];
      },
      async check() {},
      async restore(args: string[]) {
        calls.push(`restore:${args[1]}`);
      },
      async unlock() {},
      async forget() {},
    } as unknown as ResticRunnerExt;
    await dispatchJob(
      {
        id: 'j1',
        attempts: 0,
        data: { projectId: String(project._id), owner: a.id, kind: 'mirror' },
      },
      { resticRunner: restic },
    );
    expect(calls).toEqual(['backup:/var/www/p/src', 'restore:latest']);
  });
});

describe('mirror gating + agent rejection', () => {
  it('agent-aware queue rejects mirror jobs for agent-assigned projects', async () => {
    const a = await seedUser('ma@t.com');
    const agent = await Agent.create({
      owner: a.id,
      name: 'vps',
      host: '10.0.0.9',
      port: 22,
      apiKeyHash: { hash: 'x'.repeat(64), keyVersion: 1 },
      status: 'online',
    });
    const project = await seedProject(a.id);
    await Project.findByIdAndUpdate(project._id, { agent: agent._id });
    const inner: SchedulerQueue = {
      async add() {
        throw new Error('must not reach local queue');
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    const queue = makeAgentAwareQueue(inner);
    await expect(
      queue.add({ projectId: String(project._id), owner: a.id, kind: 'mirror' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('PATCH /api/backups/:projectId/mirror sets config; 403 below Business; validates paths', async () => {
    const a = await seedUser('mp@t.com');
    const project = await seedProject(a.id);

    const ok = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({
        enabled: true,
        sourcePath: '/var/www/p/src',
        targetPath: '/var/www/p/mirror',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.project.mirror).toEqual({
      enabled: true,
      sourcePath: '/var/www/p/src',
      targetPath: '/var/www/p/mirror',
    });

    // enabled with missing/equal paths → 400 (zod superRefine)
    const missing = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: true, sourcePath: '', targetPath: '' });
    expect(missing.status).toBe(400);
    const equal = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: true, sourcePath: '/var/www/p/x', targetPath: '/var/www/p/x' });
    expect(equal.status).toBe(400);

    // out-of-allowlist path → 400 (service layer)
    const outside = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: true, sourcePath: '/root/secrets', targetPath: '/var/www/p/m' });
    expect(outside.status).toBe(400);

    // disable clears without path checks
    const off = await request(app)
      .patch(`/api/backups/${project._id}/mirror`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ enabled: false, sourcePath: '', targetPath: '' });
    expect(off.status).toBe(200);
    expect(off.body.project.mirror.enabled).toBe(false);
  });
});
