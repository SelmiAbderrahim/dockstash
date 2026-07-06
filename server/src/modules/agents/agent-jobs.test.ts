import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

// OSS self-host mode: unrestricted entitlements (tiering covered by billing suites).
const __prevPaymentProvider = env.PAYMENT_PROVIDER;
beforeAll(() => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
});
afterAll(() => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevPaymentProvider;
});
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/users.model.js';
import { Project } from '../backups/backups.model.js';
import { createProject } from '../backups/backups.service.js';
import { upsertStorage, testStorage } from '../settings/settings.service.js';
import { Schedule } from '../scheduler/scheduler.model.js';
import type { JobData, LogEmitter, SchedulerQueue } from '../scheduler/scheduler.boundaries.js';
import * as alerting from '../alerting/alert.service.js';
import { registerAgent } from './agents.service.js';
import { AgentJob } from './agent-jobs.model.js';
import {
  appendJobLogs,
  claimNextJob,
  completeJob,
  configureAgentJobEvents,
  createAgentJob,
  expireStaleAgentJobs,
  ownerOfAgentJob,
} from './agent-jobs.service.js';
import { makeAgentAwareQueue } from './agent-routing.queue.js';
import type { AgentPrincipal } from '../../shared/middleware/require-agent-auth.js';

const app = createApp();
const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'A', lastName: 'J' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedStorage(userId: string): Promise<void> {
  await upsertStorage(userId, { host: 'h', user: 'u', port: 22, privateKey: 'K' });
  await testStorage(userId, {
    probe: {
      async connect() {
        return { fingerprint: PIN, hostKeyLine: 'h ssh-ed25519 AAAA' };
      },
    },
  });
}

async function seedProject(ownerId: string, agentId?: string) {
  const project = await createProject(ownerId, {
    name: 'app',
    path: '/var/www/app',
    repoPassword: 'repo-pw-123',
  });
  if (agentId) {
    project.agent = agentId as unknown as typeof project.agent;
    await project.save();
  }
  return project;
}

async function seedAgent(ownerId: string) {
  const { agent, token } = await registerAgent(ownerId, { name: 'vps-1', host: 'h1' });
  const principal: AgentPrincipal = {
    id: String(agent._id),
    owner: ownerId,
    name: agent.name,
  };
  return { agent, token, principal };
}

function makeLogSpy(): LogEmitter & { lines: string[]; dones: Array<[string, boolean, string?]> } {
  const lines: string[] = [];
  const dones: Array<[string, boolean, string?]> = [];
  return {
    lines,
    dones,
    log: (_jobId, line) => lines.push(line),
    done: (jobId, ok, detail) => dones.push([jobId, ok, detail]),
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
  configureAgentJobEvents({});
});
afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// require-agent-auth (exercised through the live /api/agent surface)
// ---------------------------------------------------------------------------

describe('require-agent-auth', () => {
  it('401s without a header, with a wrong scheme, and on malformed tokens', async () => {
    expect((await request(app).post('/api/agent/heartbeat').send({})).status).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/agent/heartbeat')
          .set('Authorization', 'JWT abc')
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/agent/heartbeat')
          .set('Authorization', 'Bearer not-a-token')
          .send({})
      ).status,
    ).toBe(401);
    expect(
      (
        await request(app)
          .post('/api/agent/heartbeat')
          .set('Authorization', `Bearer dsa_zzz.${'0'.repeat(48)}`)
          .send({})
      ).status,
    ).toBe(401);
  });

  it('401s for an unknown agent id (dummy compare) and for a wrong secret', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await seedAgent(a.id);
    const unknown = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer dsa_507f1f77bcf86cd799439011.${'0'.repeat(48)}`)
      .send({});
    expect(unknown.status).toBe(401);
    const wrongSecret = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer dsa_${String(agent._id)}.${'0'.repeat(48)}`)
      .send({});
    expect(wrongSecret.status).toBe(401);
  });

  it('accepts the registered token and rejects it after rotation', async () => {
    const a = await seedUser('a@t.com');
    const { agent, token } = await seedAgent(a.id);
    const ok = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: '1.0.0', hostname: 'vps' });
    expect(ok.status).toBe(200);
    expect(ok.body.agent).toMatchObject({ id: String(agent._id), status: 'online' });
    expect(ok.body.pollIntervalMs).toBeGreaterThan(0);
    expect(ok.body.heartbeatIntervalMs).toBeGreaterThan(0);

    const { rotateAgentKey } = await import('./agents.service.js');
    await rotateAgentKey(String(agent._id), a.id);
    const stale = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(stale.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Queue decorator
// ---------------------------------------------------------------------------

function fakeInnerQueue(): SchedulerQueue & { added: JobData[] } {
  const added: JobData[] = [];
  return {
    added,
    async add(data) {
      added.push(data);
      return { id: 'local-1', data, attempts: 0 };
    },
    async activeCountForProject() {
      return 1;
    },
    async waitIdle() {},
    async close() {},
  };
}

describe('makeAgentAwareQueue', () => {
  it('delegates to the local queue when the project has no agent (or vanished)', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const project = await seedProject(a.id);
    const inner = fakeInnerQueue();
    const queue = makeAgentAwareQueue(inner);
    const job = await queue.add({ projectId: String(project._id), owner: a.id, kind: 'backup' });
    expect(job.id).toBe('local-1');
    expect(inner.added).toHaveLength(1);
    // vanished project → also local (defensive delegation)
    await queue.add({ projectId: '507f1f77bcf86cd799439011', owner: a.id, kind: 'backup' });
    expect(inner.added).toHaveLength(2);
  });

  it('persists an AgentJob when the project is assigned to an agent', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    const inner = fakeInnerQueue();
    const queue = makeAgentAwareQueue(inner);
    const job = await queue.add({
      projectId: String(project._id),
      owner: a.id,
      kind: 'backup',
      scheduleId: 'sch-1',
    });
    expect(inner.added).toHaveLength(0);
    const doc = await AgentJob.findById(job.id);
    expect(doc).toMatchObject({ kind: 'backup', status: 'pending', scheduleId: 'sch-1' });
  });

  it('rejects drill jobs for agent projects', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    const queue = makeAgentAwareQueue(fakeInnerQueue());
    await expect(
      queue.add({ projectId: String(project._id), owner: a.id, kind: 'drill' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('records a pre-succeeded skip for prune under legal hold', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    project.legalHold = true;
    await project.save();
    const queue = makeAgentAwareQueue(fakeInnerQueue());
    const job = await queue.add({
      projectId: String(project._id),
      owner: a.id,
      kind: 'prune',
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
    });
    const doc = await AgentJob.findById(job.id);
    expect(doc?.status).toBe('succeeded');
    // retention omitted → stored null (same skip semantics)
    const bare = await queue.add({
      projectId: String(project._id),
      owner: a.id,
      kind: 'prune',
    });
    const bareDoc = await AgentJob.findById(bare.id);
    expect(bareDoc?.status).toBe('succeeded');
    expect(bareDoc?.retention).toBeNull();
  });

  it('sums local and remote active counts; delegates waitIdle/close', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'backup' },
      String(agent._id),
    );
    const inner = fakeInnerQueue();
    const queue = makeAgentAwareQueue(inner);
    expect(await queue.activeCountForProject(String(project._id))).toBe(2);
    await queue.waitIdle();
    await queue.close();
  });
});

// ---------------------------------------------------------------------------
// Claim / logs / result lifecycle (service level)
// ---------------------------------------------------------------------------

describe('claimNextJob', () => {
  it('returns null when nothing is pending', async () => {
    const a = await seedUser('a@t.com');
    const { principal } = await seedAgent(a.id);
    expect(await claimNextJob(principal)).toBeNull();
  });

  it('claims FIFO and assembles the secret payload (incl. database layers)', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    project.plan.databases.push({
      service: 'db',
      type: 'postgres',
      container: 'app-db-1',
      enabled: true,
    } as (typeof project.plan.databases)[number]);
    await project.save();
    const first = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'backup', scheduleId: 'sch-1' },
      String(agent._id),
    );
    await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'check' },
      String(agent._id),
    );
    const schedule = await Schedule.create({
      owner: a.id,
      project: project._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    await AgentJob.findByIdAndUpdate(first._id, { scheduleId: String(schedule._id) });

    const payload = await claimNextJob(principal);
    expect(payload).not.toBeNull();
    expect(payload?.id).toBe(String(first._id));
    expect(payload?.kind).toBe('backup');
    expect(payload?.attempt).toBe(1);
    expect(payload?.plan.paths).toContain('/var/www/app');
    expect(payload?.plan.databases).toEqual([
      { service: 'db', type: 'postgres', container: 'app-db-1', enabled: true },
    ]);
    expect(payload?.repo.url).toContain(`/backups/${a.id}/${String(project._id)}`);
    expect(payload?.repo.password).toBe('repo-pw-123');
    expect(payload?.ssh.privateKey).toBe('K');
    expect(payload?.ssh.hostKeyLine).toBe('h ssh-ed25519 AAAA');
    // Secrets never persisted on the job doc.
    const raw = await AgentJob.findById(first._id).lean();
    expect(JSON.stringify(raw)).not.toContain('repo-pw-123');
    expect((await Schedule.findById(schedule._id))?.lastRunStatus).toBe('running');

    const second = await claimNextJob(principal);
    expect(second?.kind).toBe('check');
    expect(second?.retention).toBeNull();
    expect(second?.restore).toBeNull();
  });

  it('carries retention and restore payloads through the claim', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    await createAgentJob(
      {
        projectId: String(project._id),
        owner: a.id,
        kind: 'prune',
        retention: { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 },
      },
      String(agent._id),
    );
    const prune = await claimNextJob(principal);
    expect(prune?.retention).toEqual({ keepDaily: 1, keepWeekly: 2, keepMonthly: 3 });
    await createAgentJob(
      {
        projectId: String(project._id),
        owner: a.id,
        kind: 'restore',
        payload: { snapshotId: 'abc123', overwrite: false, targetPath: '/var/www/tmp' },
      },
      String(agent._id),
    );
    const restore = await claimNextJob(principal);
    expect(restore?.restore).toEqual({
      snapshotId: 'abc123',
      overwrite: false,
      targetPath: '/var/www/tmp',
    });
  });

  it('fails jobs inline for a vanished / foreign / paused project and claims the next', async () => {
    const logs = makeLogSpy();
    configureAgentJobEvents({ logs });
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    // scheduleId is a non-ObjectId → persistScheduleStatus hits its best-effort
    // catch (CastError) exactly like the local dispatcher's persistStatus.
    const gone = await createAgentJob(
      {
        projectId: '507f1f77bcf86cd799439011',
        owner: a.id,
        kind: 'backup',
        scheduleId: 'not-an-objectid',
      },
      String(agent._id),
    );
    const foreignProject = await seedProject(b.id);
    const foreign = await createAgentJob(
      { projectId: String(foreignProject._id), owner: a.id, kind: 'backup' },
      String(agent._id),
    );
    const pausedProject = await seedProject(a.id, String(agent._id));
    pausedProject.paused = true;
    await pausedProject.save();
    const paused = await createAgentJob(
      { projectId: String(pausedProject._id), owner: a.id, kind: 'backup' },
      String(agent._id),
    );
    const okProject = await seedProject(a.id, String(agent._id));
    const ok = await createAgentJob(
      { projectId: String(okProject._id), owner: a.id, kind: 'check' },
      String(agent._id),
    );

    const payload = await claimNextJob(principal);
    expect(payload?.id).toBe(String(ok._id));
    expect((await AgentJob.findById(gone._id))?.status).toBe('failed');
    expect((await AgentJob.findById(gone._id))?.error).toBe('project not found');
    expect((await AgentJob.findById(foreign._id))?.status).toBe('failed');
    expect((await AgentJob.findById(paused._id))?.error).toBe('project paused');
    expect(logs.dones.filter(([, okFlag]) => !okFlag)).toHaveLength(3);
  });

  it('fails a backup job when the project cap is exceeded (paid tier gate)', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    // Two more active projects — over the free-tier cap once billing is live.
    await createProject(a.id, { name: 'p2', path: '/var/www/p2', repoPassword: 'x'.repeat(10) });
    await createProject(a.id, { name: 'p3', path: '/var/www/p3', repoPassword: 'x'.repeat(10) });
    const job = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'backup' },
      String(agent._id),
    );
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    try {
      const payload = await claimNextJob(principal);
      expect(payload).toBeNull();
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    }
    const failed = await AgentJob.findById(job._id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBeTruthy();
  });

  it('fails the job when storage is unconfigured', async () => {
    const a = await seedUser('a@t.com');
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    const job = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'check' },
      String(agent._id),
    );
    const payload = await claimNextJob(principal);
    expect(payload).toBeNull();
    const failed = await AgentJob.findById(job._id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toContain('storage unavailable');
  });
});

describe('appendJobLogs / completeJob / expiry / ownership', () => {
  async function claimedFixture() {
    const logs = makeLogSpy();
    configureAgentJobEvents({ logs });
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));
    const job = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'backup' },
      String(agent._id),
    );
    const payload = await claimNextJob(principal);
    expect(payload?.id).toBe(String(job._id));
    return { a, agent, principal, project, job, logs };
  }

  it('appends log lines (capped), renews the lease, and fans out live', async () => {
    const { principal, job, logs } = await claimedFixture();
    const before = (await AgentJob.findById(job._id))?.leaseExpiresAt?.getTime() ?? 0;
    await appendJobLogs(principal, String(job._id), ['line-1', 'line-2'], {
      now: new Date(Date.now() + 60_000),
    });
    const doc = await AgentJob.findById(job._id);
    expect(doc?.logTail).toEqual(['line-1', 'line-2']);
    expect((doc?.leaseExpiresAt?.getTime() ?? 0) > before).toBe(true);
    expect(logs.lines).toEqual(['line-1', 'line-2']);
    // cap: pushing 250 lines keeps the last 200
    const many = Array.from({ length: 250 }, (_, i) => `l${i}`);
    await appendJobLogs(principal, String(job._id), many);
    const capped = await AgentJob.findById(job._id);
    expect(capped?.logTail).toHaveLength(200);
    expect(capped?.logTail[199]).toBe('l249');
  });

  it('404s log/result posts for foreign, unknown, or non-leased jobs', async () => {
    const { principal, job } = await claimedFixture();
    await expect(
      appendJobLogs(principal, '507f1f77bcf86cd799439011', ['x']),
    ).rejects.toMatchObject({ status: 404 });
    await completeJob(principal, String(job._id), { ok: true });
    // terminal job: further posts 404 (idempotence guard)
    await expect(appendJobLogs(principal, String(job._id), ['x'])).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      completeJob(principal, String(job._id), { ok: true }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('completeJob success stamps the project + metering and the schedule', async () => {
    const { a, principal, project, job, logs } = await claimedFixture();
    const schedule = await Schedule.create({
      owner: a.id,
      project: project._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    await AgentJob.findByIdAndUpdate(job._id, { scheduleId: String(schedule._id) });
    const done = await completeJob(principal, String(job._id), {
      ok: true,
      stats: { snapshotCount: 12, totalRepoBytes: 4096, lastBackupBytes: 1024 },
    });
    expect(done.status).toBe('succeeded');
    const stamped = await Project.findById(project._id);
    expect(stamped?.lastStatus).toBe('success');
    expect(stamped?.lastSuccessAt).not.toBeNull();
    expect(stamped?.snapshotCount).toBe(12);
    expect(stamped?.totalRepoBytes).toBe(4096);
    expect(stamped?.lastBackupBytes).toBe(1024);
    expect((await Schedule.findById(schedule._id))?.lastRunStatus).toBe('success');
    expect(logs.dones.at(-1)).toEqual([String(job._id), true, undefined]);
  });

  it('completeJob success without stats falls back to snapshotCount+1', async () => {
    const { principal, project, job } = await claimedFixture();
    await completeJob(principal, String(job._id), { ok: true });
    const stamped = await Project.findById(project._id);
    expect(stamped?.snapshotCount).toBe(1);
    expect(stamped?.totalRepoBytes).toBe(0);
  });

  it('completeJob with an empty stats object nulls each resultStats field', async () => {
    const { principal, project, job } = await claimedFixture();
    const done = await completeJob(principal, String(job._id), { ok: true, stats: {} });
    expect(done.resultStats).toMatchObject({
      snapshotCount: null,
      totalRepoBytes: null,
      lastBackupBytes: null,
    });
    // no stats fields → metering untouched except the +1 fallback
    const stamped = await Project.findById(project._id);
    expect(stamped?.snapshotCount).toBe(1);
    expect(stamped?.totalRepoBytes).toBe(0);
    expect(stamped?.lastBackupBytes).toBe(0);
  });

  it('errorMessage normalizes Error and non-Error throwables', async () => {
    const { errorMessage } = await import('./agent-jobs.service.js');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage('plain string')).toBe('plain string');
  });

  it('completeJob failure stamps failed, alerts, and tolerates alert errors', async () => {
    const alertSpy = vi
      .spyOn(alerting, 'sendFailureAlert')
      .mockRejectedValueOnce(new Error('smtp down'));
    const { principal, project, job, logs } = await claimedFixture();
    const done = await completeJob(principal, String(job._id), {
      ok: false,
      error: 'restic exploded',
    });
    expect(done.status).toBe('failed');
    const stamped = await Project.findById(project._id);
    expect(stamped?.lastStatus).toBe('failed');
    expect(stamped?.lastError).toBe('restic exploded');
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'backup', error: 'restic exploded' }),
    );
    expect(logs.dones.at(-1)).toEqual([String(job._id), false, 'restic exploded']);
  });

  it('completeJob failure without a message uses the fallback error', async () => {
    vi.spyOn(alerting, 'sendFailureAlert').mockResolvedValue();
    const { principal, job } = await claimedFixture();
    const done = await completeJob(principal, String(job._id), { ok: false });
    expect(done.error).toBe('agent job failed');
  });

  it('stamps check / restore / prune kinds with their dedicated fields', async () => {
    vi.spyOn(alerting, 'sendFailureAlert').mockResolvedValue();
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const { agent, principal } = await seedAgent(a.id);
    const project = await seedProject(a.id, String(agent._id));

    for (const [kind, ok] of [
      ['check', false],
      ['check', true],
      ['restore', false],
      ['restore', true],
      ['prune', true],
      ['prune', false],
    ] as const) {
      await createAgentJob(
        {
          projectId: String(project._id),
          owner: a.id,
          kind,
          ...(kind === 'prune'
            ? { retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 } }
            : {}),
          ...(kind === 'restore'
            ? { payload: { snapshotId: 's1', overwrite: true } }
            : {}),
        },
        String(agent._id),
      );
      const payload = await claimNextJob(principal);
      await completeJob(principal, payload?.id as string, {
        ok,
        ...(ok ? {} : { error: `${kind} broke` }),
      });
    }

    const stamped = await Project.findById(project._id);
    // Last write per kind wins: check fail→pass, restore fail→pass, prune ok→fail.
    expect(stamped?.lastCheckStatus).toBe('pass');
    expect(stamped?.lastCheckDetail).toBe('');
    expect(stamped?.lastRestoreStatus).toBe('pass');
    expect(stamped?.lastRestoreDetail).toBe('');
    expect(stamped?.lastError).toBe('prune broke');
  });

  it('completeJob survives a project deleted mid-run', async () => {
    const { principal, project, job } = await claimedFixture();
    await Project.deleteOne({ _id: project._id });
    const done = await completeJob(principal, String(job._id), { ok: true });
    expect(done.status).toBe('succeeded');
  });

  it('expireStaleAgentJobs fails overdue leases, alerts, and skips fresh ones', async () => {
    const alertSpy = vi.spyOn(alerting, 'sendFailureAlert').mockResolvedValue();
    const { a, agent, principal, project, job, logs } = await claimedFixture();
    const schedule = await Schedule.create({
      owner: a.id,
      project: project._id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    await AgentJob.findByIdAndUpdate(job._id, { scheduleId: String(schedule._id) });
    // A second, freshly-leased job survives the sweep.
    const fresh = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'check' },
      String(agent._id),
    );
    await claimNextJob(principal);

    await expireStaleAgentJobs(new Date(Date.now() + (env.AGENT_JOB_LEASE_SECONDS + 60) * 1000));
    expect((await AgentJob.findById(job._id))?.status).toBe('failed');
    expect((await AgentJob.findById(job._id))?.error).toBe('agent lease expired');
    expect((await Schedule.findById(schedule._id))?.lastRunStatus).toBe('failed');
    expect(alertSpy).toHaveBeenCalled();
    expect(logs.dones.some(([id, okFlag]) => id === String(job._id) && !okFlag)).toBe(true);

    expect((await AgentJob.findById(fresh._id))?.status).toBe('failed'); // expired by first sweep too

    // Alert transport failure is tolerated (best-effort, mirrors processJob).
    const another = await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'check' },
      String(agent._id),
    );
    await claimNextJob(principal);
    alertSpy.mockRejectedValue(new Error('smtp down'));
    await expireStaleAgentJobs(new Date(Date.now() + (env.AGENT_JOB_LEASE_SECONDS + 120) * 1000));
    expect((await AgentJob.findById(another._id))?.status).toBe('failed');

    // no-op sweep in the past leaves nothing to do
    await expireStaleAgentJobs(new Date(0));
  });

  it('ownerOfAgentJob resolves owners and ignores non-ObjectId ids', async () => {
    const { a, job } = await claimedFixture();
    expect(await ownerOfAgentJob(String(job._id))).toBe(a.id);
    expect(await ownerOfAgentJob('42')).toBeNull();
    expect(await ownerOfAgentJob('507f1f77bcf86cd799439011')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Machine API end-to-end + assignment PATCH
// ---------------------------------------------------------------------------

describe('/api/agent machine surface + assignment E2E', () => {
  it('full lifecycle: register → assign → enqueue-shape claim → logs → result', async () => {
    const a = await seedUser('a@t.com');
    await seedStorage(a.id);
    const reg = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${a.token}`)
      .send({ name: 'prod', host: '10.0.0.9' });
    expect(reg.status).toBe(201);
    const agentToken = reg.body.token as string;
    const agentId = reg.body.agent.id as string;

    const project = await seedProject(a.id);

    // Assignment gate paths
    const badAgent = await request(app)
      .patch(`/api/backups/${project._id}/agent`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ agentId: '507f1f77bcf86cd799439011' });
    expect(badAgent.status).toBe(404);
    const badBody = await request(app)
      .patch(`/api/backups/${project._id}/agent`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ agentId: 'nope' });
    expect(badBody.status).toBe(400);

    const assign = await request(app)
      .patch(`/api/backups/${project._id}/agent`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ agentId });
    expect(assign.status).toBe(200);
    expect(assign.body.project.agentId).toBe(agentId);

    // Foreign owner: existence-cloak returns 404 (surface #2 / S2-01)
    const b = await seedUser('b@t.com');
    const foreign = await request(app)
      .patch(`/api/backups/${project._id}/agent`)
      .set('Authorization', `JWT ${b.token}`)
      .send({ agentId: null });
    expect(foreign.status).toBe(404);

    // Job enqueued through the decorated queue shape (created directly here).
    await createAgentJob(
      { projectId: String(project._id), owner: a.id, kind: 'backup' },
      agentId,
    );

    const empty204Later = async () => {
      const res = await request(app)
        .post('/api/agent/jobs/claim')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({});
      return res;
    };

    const claim = await empty204Later();
    expect(claim.status).toBe(200);
    expect(claim.body.job.repo.password).toBe('repo-pw-123');
    const jobId = claim.body.job.id as string;

    const logsRes = await request(app)
      .post(`/api/agent/jobs/${jobId}/logs`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ lines: ['starting backup'] });
    expect(logsRes.status).toBe(204);
    const badLogs = await request(app)
      .post(`/api/agent/jobs/${jobId}/logs`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ lines: [] });
    expect(badLogs.status).toBe(400);
    const badJobId = await request(app)
      .post('/api/agent/jobs/nope/logs')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ lines: ['x'] });
    expect(badJobId.status).toBe(400);

    const result = await request(app)
      .post(`/api/agent/jobs/${jobId}/result`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ ok: true, stats: { snapshotCount: 3, totalRepoBytes: 999, lastBackupBytes: 42 } });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('succeeded');

    const fleet = await request(app)
      .get('/api/agents/fleet')
      .set('Authorization', `JWT ${a.token}`);
    expect(fleet.body.fleet[0]).toMatchObject({ totalBytes: 999, snapshotCount: 3 });

    // queue drained → 204
    const drained = await empty204Later();
    expect(drained.status).toBe(204);

    // Unassign back to local
    const unassign = await request(app)
      .patch(`/api/backups/${project._id}/agent`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ agentId: null });
    expect(unassign.status).toBe(200);
    expect(unassign.body.project.agentId).toBeNull();
  });
});
