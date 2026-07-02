import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

// Feature suite runs in OSS self-host mode (PAYMENT_PROVIDER=none) so paid-tier
// entitlements (multi-VPS fleet, schedules, email alerts, restore drills) are
// unrestricted here — billing tiering itself is covered by the billing suites.
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
import { verifyApiSecret } from '../../shared/crypto/index.js';
import { AgentJob } from './agent-jobs.model.js';
import {
  computeFleet,
  deleteAgent,
  effectiveAgentStatus,
  listAgentsForUser,
  loadOwnedAgent,
  registerAgent,
  rotateAgentKey,
  sweepOfflineAgents,
  touchAgentHeartbeat,
} from './agents.service.js';

const app = createApp();

const TOKEN_RE = /^dsa_([a-f0-9]{24})\.([a-f0-9]{48})$/;

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'A', lastName: 'G' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(ownerId: string, agentId: string | null, bytes: number, snaps: number) {
  return Project.create({
    owner: ownerId,
    name: `p-${bytes}`,
    path: '/var/www/p',
    agent: agentId,
    plan: { paths: ['/var/www/p'], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
    totalRepoBytes: bytes,
    snapshotCount: snaps,
  });
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

describe('agents: service', () => {
  it('registerAgent hashes the API secret and returns the composite token once', async () => {
    const { id } = await seedUser('a@t.com');
    const { agent, token } = await registerAgent(id, { name: 'prod', host: '10.0.0.1' });
    const match = TOKEN_RE.exec(token);
    expect(match).not.toBeNull();
    expect(match?.[1]).toBe(String(agent._id));
    const secret = match?.[2] as string;
    // Non-reversible at rest: only the HMAC verifies, the secret never appears.
    expect(agent.apiKeyHash.hash).not.toContain(secret);
    expect(verifyApiSecret(secret, agent.apiKeyHash)).toBe(true);
    expect(verifyApiSecret('0'.repeat(48), agent.apiKeyHash)).toBe(false);
    expect(agent.port).toBe(22);
    expect(agent.status).toBe('offline');
  });

  it('listAgentsForUser returns only the caller agents', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    await registerAgent(a.id, { name: 'a1', host: 'h', port: 2222 });
    await registerAgent(b.id, { name: 'b1', host: 'h' });
    const forA = await listAgentsForUser(a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0]?.name).toBe('a1');
    expect(forA[0]?.port).toBe(2222);
  });

  it('loadOwnedAgent enforces existence and ownership', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    await expect(
      loadOwnedAgent('507f1f77bcf86cd799439011', a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      loadOwnedAgent(String(agent._id), b.id),
    ).rejects.toMatchObject({ status: 403 });
    const ok = await loadOwnedAgent(String(agent._id), a.id);
    expect(ok.name).toBe('a1');
  });

  it('rotateAgentKey mints a new secret and invalidates the old one', async () => {
    const a = await seedUser('a@t.com');
    const reg = await registerAgent(a.id, { name: 'a1', host: 'h' });
    const oldSecret = TOKEN_RE.exec(reg.token)?.[2] as string;
    const rotated = await rotateAgentKey(String(reg.agent._id), a.id);
    const newSecret = TOKEN_RE.exec(rotated.token)?.[2] as string;
    expect(newSecret).not.toBe(oldSecret);
    expect(verifyApiSecret(oldSecret, rotated.agent.apiKeyHash)).toBe(false);
    expect(verifyApiSecret(newSecret, rotated.agent.apiKeyHash)).toBe(true);
  });

  it('deleteAgent unassigns projects and fails queued jobs', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    const project = await seedProject(a.id, String(agent._id), 10, 1);
    const pending = await AgentJob.create({
      owner: a.id,
      agent: agent._id,
      project: project._id,
      kind: 'backup',
      status: 'pending',
    });
    const done = await AgentJob.create({
      owner: a.id,
      agent: agent._id,
      project: project._id,
      kind: 'backup',
      status: 'succeeded',
    });
    await deleteAgent(String(agent._id), a.id, { now: new Date('2027-01-01T00:00:00Z') });
    expect(await loadOwnedAgent(String(agent._id), a.id).catch((e) => e.status)).toBe(404);
    const reloaded = await Project.findById(project._id);
    expect(reloaded?.agent).toBeNull();
    const failed = await AgentJob.findById(pending._id);
    expect(failed?.status).toBe('failed');
    expect(failed?.error).toBe('agent deleted');
    const untouched = await AgentJob.findById(done._id);
    expect(untouched?.status).toBe('succeeded');
  });

  it('touchAgentHeartbeat marks the agent online and records host info', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    const now = new Date('2027-01-01T00:00:00Z');
    const beat = await touchAgentHeartbeat(
      String(agent._id),
      { version: '1.2.3', hostname: 'vps-9' },
      { now },
    );
    expect(beat?.status).toBe('online');
    expect(beat?.lastSeenAt?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(beat?.agentVersion).toBe('1.2.3');
    expect(beat?.hostname).toBe('vps-9');
    const noInfo = await touchAgentHeartbeat(String(agent._id), {}, { now });
    expect(noInfo?.agentVersion).toBe('1.2.3');
  });

  it('effectiveAgentStatus computes liveness from lastSeenAt freshness', () => {
    const now = new Date('2027-01-01T00:10:00Z');
    const fresh = new Date(now.getTime() - 10_000);
    const stale = new Date(now.getTime() - (env.AGENT_OFFLINE_AFTER_SECONDS + 5) * 1000);
    expect(effectiveAgentStatus({ status: 'online', lastSeenAt: fresh }, now)).toBe('online');
    expect(effectiveAgentStatus({ status: 'online', lastSeenAt: stale }, now)).toBe('offline');
    expect(effectiveAgentStatus({ status: 'online', lastSeenAt: null }, now)).toBe('offline');
    expect(effectiveAgentStatus({ status: 'offline', lastSeenAt: fresh }, now)).toBe('offline');
  });

  it('sweepOfflineAgents persists offline for stale online rows', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    const past = new Date(Date.now() - (env.AGENT_OFFLINE_AFTER_SECONDS + 60) * 1000);
    await touchAgentHeartbeat(String(agent._id), {}, { now: past });
    await sweepOfflineAgents();
    const swept = await loadOwnedAgent(String(agent._id), a.id);
    expect(swept.status).toBe('offline');
  });

  it('computeFleet rolls up per-agent project storage and snapshots', async () => {
    const a = await seedUser('a@t.com');
    const { agent: a1 } = await registerAgent(a.id, { name: 'vps-1', host: 'h1' });
    await registerAgent(a.id, { name: 'vps-2', host: 'h2' });
    await seedProject(a.id, String(a1._id), 1000, 2);
    await seedProject(a.id, String(a1._id), 500, 3);
    await seedProject(a.id, null, 9999, 9); // unassigned — not counted per-agent
    const fleet = await computeFleet(a.id);
    const first = fleet.find((f) => f.name === 'vps-1');
    expect(first).toMatchObject({ projectCount: 2, totalBytes: 1500, snapshotCount: 5 });
    const second = fleet.find((f) => f.name === 'vps-2');
    expect(second).toMatchObject({ projectCount: 0, totalBytes: 0, snapshotCount: 0 });
    expect(second?.lastSeenAt).toBeNull();
  });

  it('computeFleet reports a fresh heartbeat as online with an ISO lastSeenAt', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await registerAgent(a.id, { name: 'vps-1', host: 'h1' });
    await touchAgentHeartbeat(String(agent._id), {}, { now: new Date() });
    const fleet = await computeFleet(a.id);
    expect(fleet[0]?.status).toBe('online');
    expect(fleet[0]?.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('agents: HTTP routes', () => {
  it('requires auth on every route', async () => {
    expect((await request(app).get('/api/agents')).status).toBe(401);
    expect((await request(app).post('/api/agents')).status).toBe(401);
    expect((await request(app).get('/api/agents/fleet')).status).toBe(401);
    expect(
      (await request(app).post('/api/agents/507f1f77bcf86cd799439011/rotate-key')).status,
    ).toBe(401);
    expect(
      (await request(app).delete('/api/agents/507f1f77bcf86cd799439011')).status,
    ).toBe(401);
  });

  it('the removed user-JWT heartbeat route now 404s', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/agents/507f1f77bcf86cd799439011/heartbeat')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(404);
  });

  it('registers, lists, rotates, deletes an agent and reads the fleet', async () => {
    const { id, token } = await seedUser('a@t.com');
    const reg = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'prod', host: '10.0.0.9', port: 2200 });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toMatch(TOKEN_RE);
    expect(JSON.stringify(reg.body.agent)).not.toContain(
      TOKEN_RE.exec(reg.body.token)?.[2],
    );
    const agentId = reg.body.agent.id;

    await seedProject(id, agentId, 2048, 4);

    const list = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.agents).toHaveLength(1);
    expect(list.body.agents[0].status).toBe('offline');
    expect(list.body.agents[0].lastSeenAt).toBeNull();

    // After a heartbeat the serializer reports the ISO timestamp.
    await touchAgentHeartbeat(agentId, {}, { now: new Date() });
    const seen = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(seen.body.agents[0].lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(seen.body.agents[0].status).toBe('online');

    const rotate = await request(app)
      .post(`/api/agents/${agentId}/rotate-key`)
      .set('Authorization', `JWT ${token}`);
    expect(rotate.status).toBe(200);
    expect(rotate.body.token).toMatch(TOKEN_RE);
    expect(rotate.body.token).not.toBe(reg.body.token);

    const fleet = await request(app)
      .get('/api/agents/fleet')
      .set('Authorization', `JWT ${token}`);
    expect(fleet.status).toBe(200);
    expect(fleet.body.fleet[0]).toMatchObject({
      name: 'prod',
      projectCount: 1,
      totalBytes: 2048,
      snapshotCount: 4,
    });

    const del = await request(app)
      .delete(`/api/agents/${agentId}`)
      .set('Authorization', `JWT ${token}`);
    expect(del.status).toBe(204);
    const after = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(after.body.agents).toHaveLength(0);
  });

  it('rejects an invalid agent id at the zod layer', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/agents/not-an-id/rotate-key')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(400);
  });

  it('rejects a missing name at the zod layer', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${token}`)
      .send({ host: 'h' });
    expect(res.status).toBe(400);
  });
});
