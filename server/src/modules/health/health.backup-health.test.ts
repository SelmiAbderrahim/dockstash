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
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { Agent } from '../agents/index.js';
import { Schedule } from '../scheduler/scheduler.model.js';
import { Alert } from './health.model.js';
import { computeProjectHealth, worstStatus } from './health.rules.js';
import {
  getHealthOverview,
  getProjectHealth,
  listAlerts,
  markAlertsRead,
  recordAlert,
  serializeAlert,
  ALERTS_PAGE_SIZE,
} from './health.backup-health.service.js';

const app = createApp();

const BASE_SIGNALS = {
  paused: false,
  lastStatus: 'success',
  lastSuccessAt: new Date('2026-07-05T00:00:00Z'),
  lastCheckStatus: null,
  lastDrillStatus: null,
  lastRestoreStatus: null,
  hasEnabledSchedule: true,
  agentStatus: null,
  staleAfterHours: 24,
  now: new Date('2026-07-05T12:00:00Z'),
} as const;

describe('health rules: computeProjectHealth', () => {
  it('healthy when everything is green', () => {
    expect(computeProjectHealth({ ...BASE_SIGNALS })).toEqual({
      status: 'healthy',
      reasons: [],
    });
  });

  it('critical on failed backup / drill / restore / offline agent', () => {
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, lastStatus: 'failed' }).status,
    ).toBe('critical');
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, lastDrillStatus: 'failed' }).reasons,
    ).toContain('drillFailed');
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, lastRestoreStatus: 'failed' }).reasons,
    ).toContain('restoreFailed');
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, agentStatus: 'offline' }).reasons,
    ).toContain('agentOffline');
  });

  it('critical when the last success is older than the heartbeat window', () => {
    const verdict = computeProjectHealth({
      ...BASE_SIGNALS,
      lastSuccessAt: new Date('2026-07-01T00:00:00Z'),
    });
    expect(verdict.status).toBe('critical');
    expect(verdict.reasons).toContain('backupStale');
  });

  it('degraded (not critical) when the project never backed up', () => {
    const verdict = computeProjectHealth({ ...BASE_SIGNALS, lastSuccessAt: null });
    expect(verdict.status).toBe('degraded');
    expect(verdict.reasons).toContain('neverBackedUp');
  });

  it('degraded on failed check or missing schedule; paused never goes stale-critical', () => {
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, lastCheckStatus: 'failed' }).status,
    ).toBe('degraded');
    expect(
      computeProjectHealth({ ...BASE_SIGNALS, hasEnabledSchedule: false }).reasons,
    ).toContain('noSchedule');
    const paused = computeProjectHealth({
      ...BASE_SIGNALS,
      paused: true,
      lastSuccessAt: null,
      hasEnabledSchedule: false,
    });
    expect(paused.status).toBe('degraded');
    expect(paused.reasons).toEqual(['paused']);
  });

  it('critical carries its degraded reasons along', () => {
    const verdict = computeProjectHealth({
      ...BASE_SIGNALS,
      lastStatus: 'failed',
      lastCheckStatus: 'failed',
    });
    expect(verdict.status).toBe('critical');
    expect(verdict.reasons).toEqual(['backupFailed', 'checkFailed']);
  });
});

describe('health rules: worstStatus', () => {
  it('worst project wins; empty fleet is healthy', () => {
    expect(worstStatus([])).toBe('healthy');
    expect(worstStatus(['healthy', 'degraded'])).toBe('degraded');
    expect(worstStatus(['degraded', 'critical', 'healthy'])).toBe('critical');
  });
});

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'H', lastName: 'C' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(
  ownerId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const p = await Project.create({
    owner: ownerId,
    name: (overrides.name as string) ?? 'proj',
    path: '/var/www/x',
    plan: { paths: ['/var/www/x'], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
    lastStatus: 'success',
    lastSuccessAt: new Date(),
    paused: false,
    ...overrides,
  });
  return p._id.toString();
}

describe('backup-health service + endpoints', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('getHealthOverview aggregates per-project verdicts + unread count', async () => {
    const a = await seedUser('ov@t.com');
    await seedProject(a.id, { name: 'good' });
    const badId = await seedProject(a.id, { name: 'bad', lastStatus: 'failed' });
    await recordAlert({
      owner: a.id,
      projectId: badId,
      projectName: 'bad',
      kind: 'backup',
      severity: 'critical',
      error: 'boom',
    });
    const overview = await getHealthOverview(a.id);
    expect(overview.status).toBe('critical');
    expect(overview.projects).toHaveLength(2);
    expect(overview.unreadAlerts).toBe(1);
    const bad = overview.projects.find((p) => p.name === 'bad');
    expect(bad?.status).toBe('critical');
    // No enabled schedule seeded → degraded reason present on the good project.
    const good = overview.projects.find((p) => p.name === 'good');
    expect(good?.reasons).toContain('noSchedule');
  });

  it('overview reflects enabled schedules and agent status', async () => {
    const a = await seedUser('ag@t.com');
    const agent = await Agent.create({
      owner: a.id,
      name: 'vps-1',
      host: '10.0.0.5',
      port: 22,
      apiKeyHash: { hash: 'x'.repeat(64), keyVersion: 1 },
      status: 'offline',
    });
    const projectId = await seedProject(a.id, { agent: agent._id });
    await Schedule.create({
      project: projectId,
      owner: a.id,
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: true,
    });
    const overview = await getHealthOverview(a.id);
    const entry = overview.projects[0];
    expect(entry?.hasEnabledSchedule).toBe(true);
    expect(entry?.agentStatus).toBe('offline');
    expect(entry?.status).toBe('critical');
  });

  it('covers never-backed-up, dangling-agent, and check/drill status branches', async () => {
    const a = await seedUser('edge@t.com');
    // Agent id that exists in no Agent row → status map miss → 'offline'.
    const danglingAgent = new (await import('mongoose')).default.Types.ObjectId();
    const projectId = await seedProject(a.id, {
      name: 'edge',
      lastSuccessAt: null,
      lastCheckStatus: 'fail',
      lastDrillStatus: 'pass',
      agent: danglingAgent,
    });
    const entry = await getProjectHealth(projectId, a.id);
    expect(entry.agentStatus).toBe('offline');
    expect(entry.lastSuccessAt).toBeNull();
    expect(entry.lastCheckStatus).toBe('fail');
    expect(entry.lastDrillStatus).toBe('pass');
    expect(entry.status).toBe('critical'); // dangling agent counts as offline
  });

  it('getProjectHealth 404s both unknown AND foreign projects (surface #2 existence-cloak)', async () => {
    const a = await seedUser('own@t.com');
    const b = await seedUser('other@t.com');
    const projectId = await seedProject(a.id);
    await expect(
      getProjectHealth('507f1f77bcf86cd799439011', a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(getProjectHealth(projectId, b.id)).rejects.toMatchObject({
      status: 404,
    });
    const entry = await getProjectHealth(projectId, a.id);
    expect(entry.projectId).toBe(projectId);
  });

  it('listAlerts filters unread and caps at the page size', async () => {
    const a = await seedUser('list@t.com');
    const projectId = await seedProject(a.id);
    for (let i = 0; i < ALERTS_PAGE_SIZE + 3; i += 1) {
      await recordAlert({
        owner: a.id,
        projectId,
        projectName: 'proj',
        kind: 'backup',
        severity: 'critical',
        error: `err-${i}`,
      });
    }
    const all = await listAlerts(a.id);
    expect(all).toHaveLength(ALERTS_PAGE_SIZE);
    await markAlertsRead(a.id, [all[0]!.id]);
    const unread = await listAlerts(a.id, { unreadOnly: true });
    expect(unread.find((x) => x.id === all[0]!.id)).toBeUndefined();
  });

  it('markAlertsRead marks all when ids omitted and reports the count', async () => {
    const a = await seedUser('read@t.com');
    const projectId = await seedProject(a.id);
    await recordAlert({
      owner: a.id,
      projectId,
      projectName: 'proj',
      kind: 'heartbeat',
      severity: 'warning',
    });
    await recordAlert({
      owner: a.id,
      projectId,
      projectName: 'proj',
      kind: 'backup',
      severity: 'critical',
      error: 'x',
    });
    expect(await markAlertsRead(a.id)).toBe(2);
    expect(await markAlertsRead(a.id)).toBe(0);
  });

  it('serializeAlert exposes the read flag and ISO timestamp', async () => {
    const a = await seedUser('ser@t.com');
    const projectId = await seedProject(a.id);
    const row = await recordAlert({
      owner: a.id,
      projectId,
      projectName: 'proj',
      kind: 'drill',
      severity: 'critical',
      error: 'diff mismatch',
    });
    const pub = serializeAlert(row);
    expect(pub).toMatchObject({
      projectId,
      projectName: 'proj',
      kind: 'drill',
      severity: 'critical',
      error: 'diff mismatch',
      read: false,
    });
    expect(new Date(pub.createdAt).toISOString()).toBe(pub.createdAt);
  });

  it('GET /api/health/overview requires auth and returns the snapshot', async () => {
    const anon = await request(app).get('/api/health/overview');
    expect(anon.status).toBe(401);
    const a = await seedUser('http-ov@t.com');
    await seedProject(a.id);
    const res = await request(app)
      .get('/api/health/overview')
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.unreadAlerts).toBe(0);
  });

  it('GET /api/health/projects/:projectId returns the single-project verdict', async () => {
    const a = await seedUser('http-proj@t.com');
    const projectId = await seedProject(a.id, { lastStatus: 'failed' });
    const res = await request(app)
      .get(`/api/health/projects/${projectId}`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.project.status).toBe('critical');
    const missing = await request(app)
      .get('/api/health/projects/507f1f77bcf86cd799439011')
      .set('Authorization', `JWT ${a.token}`);
    expect(missing.status).toBe(404);
  });

  it('GET /api/health/alerts lists rows; POST /alerts/read marks them', async () => {
    const a = await seedUser('http-alerts@t.com');
    const projectId = await seedProject(a.id);
    await recordAlert({
      owner: a.id,
      projectId,
      projectName: 'proj',
      kind: 'backup',
      severity: 'critical',
      error: 'boom',
    });
    const list = await request(app)
      .get('/api/health/alerts?unread=true')
      .set('Authorization', `JWT ${a.token}`);
    expect(list.status).toBe(200);
    expect(list.body.alerts).toHaveLength(1);

    const bad = await request(app)
      .post('/api/health/alerts/read')
      .set('Authorization', `JWT ${a.token}`)
      .send({ ids: ['nope'] });
    expect(bad.status).toBe(400);

    const read = await request(app)
      .post('/api/health/alerts/read')
      .set('Authorization', `JWT ${a.token}`)
      .send({});
    expect(read.status).toBe(200);
    expect(read.body.marked).toBe(1);

    const after = await request(app)
      .get('/api/health/alerts')
      .set('Authorization', `JWT ${a.token}`);
    expect(after.body.alerts[0].read).toBe(true);
  });

  it('alerts are owner-scoped', async () => {
    const a = await seedUser('scope-a@t.com');
    const b = await seedUser('scope-b@t.com');
    const projectId = await seedProject(a.id);
    await recordAlert({
      owner: a.id,
      projectId,
      projectName: 'proj',
      kind: 'backup',
      severity: 'critical',
      error: 'boom',
    });
    const res = await request(app)
      .get('/api/health/alerts')
      .set('Authorization', `JWT ${b.token}`);
    expect(res.body.alerts).toHaveLength(0);
    expect(await Alert.countDocuments({})).toBe(1);
  });

  /**
   * S1-01 — authenticated `/api/health/*` sub-routers must sit behind the
   * `verified` chain, same as every other product surface. Pre-fix: an
   * authenticated-but-unverified session got 200s from these endpoints and
   * silently violated the "unverified users can't reach product data"
   * invariant. Post-fix: 403 EMAIL_NOT_VERIFIED on every authenticated
   * health surface (list + overview + detail + alerts + read).
   */
  describe('S1-01: unverified accounts are blocked from authenticated health surfaces', () => {
    async function seedUnverifiedUser(email: string): Promise<{ id: string; token: string }> {
      const u = await User.create({
        email,
        password: 'x'.repeat(60),
        profile: { firstName: 'U', lastName: 'V' },
        emailVerified: false,
      });
      return { id: u._id.toString(), token: signToken(u._id.toString()) };
    }

    it('GET /api/health/projects → 403 EMAIL_NOT_VERIFIED for unverified users', async () => {
      const u = await seedUnverifiedUser('unv-proj@t.com');
      const res = await request(app)
        .get('/api/health/projects')
        .set('Authorization', `JWT ${u.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('GET /api/health/overview → 403 EMAIL_NOT_VERIFIED for unverified users', async () => {
      const u = await seedUnverifiedUser('unv-ov@t.com');
      const res = await request(app)
        .get('/api/health/overview')
        .set('Authorization', `JWT ${u.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('GET /api/health/projects/:id → 403 EMAIL_NOT_VERIFIED for unverified users', async () => {
      const u = await seedUnverifiedUser('unv-detail@t.com');
      const res = await request(app)
        .get('/api/health/projects/507f1f77bcf86cd799439011')
        .set('Authorization', `JWT ${u.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('GET /api/health/alerts + POST /alerts/read → 403 EMAIL_NOT_VERIFIED for unverified users', async () => {
      const u = await seedUnverifiedUser('unv-alerts@t.com');
      const list = await request(app)
        .get('/api/health/alerts')
        .set('Authorization', `JWT ${u.token}`);
      expect(list.status).toBe(403);
      expect(list.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
      const post = await request(app)
        .post('/api/health/alerts/read')
        .set('Authorization', `JWT ${u.token}`)
        .send({});
      expect(post.status).toBe(403);
      expect(post.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('unauthenticated liveness stays public (`/api/health` + `/api/metrics` never gate)', async () => {
      // Sanity check: verify the public liveness/metrics routes are NOT
      // caught by the `verified` gate — 200 with no token.
      const live = await request(app).get('/api/health');
      expect(live.status).toBe(200);
      const met = await request(app).get('/api/metrics');
      expect(met.status).toBe(200);
    });
  });
});
