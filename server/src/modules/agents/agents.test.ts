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
import { Agent } from './agents.model.js';
import {
  EXPECTED_AGENT_VERSION,
  allowedRootsForAgent,
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
import { createProject } from '../backups/backups.service.js';
import { agentHeartbeatSchema } from './agent-api.schema.js';

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

  it('registerAgent rejects a duplicate (owner, host) with 409', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    await registerAgent(a.id, { name: 'first', host: 'dup.example' });
    await expect(
      registerAgent(a.id, { name: 'second', host: 'dup.example' }),
    ).rejects.toMatchObject({ status: 409 });
    // Only the first survives, and the same host under another owner is allowed.
    expect(await listAgentsForUser(a.id)).toHaveLength(1);
    const other = await registerAgent(b.id, { name: 'b-host', host: 'dup.example' });
    expect(String(other.agent.owner)).toBe(b.id);
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

  it('loadOwnedAgent enforces existence-cloak: 404 for both missing AND cross-owner', async () => {
    // Surface #2 / S2-01 — the DB filters by owner at query time, so a
    // foreign-owner id and a genuinely missing id both surface as 404 (no
    // ObjectId-enumeration oracle).
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    await expect(
      loadOwnedAgent('507f1f77bcf86cd799439011', a.id),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      loadOwnedAgent(String(agent._id), b.id),
    ).rejects.toMatchObject({ status: 404 });
    // A non-ObjectId string is 404 too — never a Mongoose CastError 500.
    await expect(
      loadOwnedAgent('not-an-object-id', a.id),
    ).rejects.toMatchObject({ status: 404 });
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
    // The fleet rollup must drop it too — this is the surface the UI polls.
    const fleetAfter = await request(app)
      .get('/api/agents/fleet')
      .set('Authorization', `JWT ${token}`);
    expect(fleetAfter.body.fleet).toHaveLength(0);
  });

  it('marks API responses Cache-Control: no-store so stale lists are never replayed', async () => {
    const { token } = await seedUser('a@t.com');
    const list = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(list.headers['cache-control']).toBe('no-store');
    const fleet = await request(app)
      .get('/api/agents/fleet')
      .set('Authorization', `JWT ${token}`);
    expect(fleet.headers['cache-control']).toBe('no-store');
  });

  it('rejects registering the same host twice with 409', async () => {
    const { token } = await seedUser('a@t.com');
    const first = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'prod', host: '10.0.0.9' });
    expect(first.status).toBe(201);
    const dup = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'prod-again', host: '10.0.0.9' });
    expect(dup.status).toBe(409);
    const list = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(list.body.agents).toHaveLength(1);
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

describe('agents: discovery endpoint', () => {
  it('requires auth', async () => {
    expect(
      (await request(app).get('/api/agents/507f1f77bcf86cd799439011/discovery')).status,
    ).toBe(401);
  });

  it('returns an empty view before a snapshot, then the browse view after a heartbeat', async () => {
    const { id, token } = await seedUser('disc@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'disc.example' });
    const agentId = String(agent._id);

    const empty = await request(app)
      .get(`/api/agents/${agentId}/discovery`)
      .set('Authorization', `JWT ${token}`);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({
      folders: [],
      containers: [],
      dockerAvailable: false,
      roots: ['/var/www'],
      snapshotAt: null,
      reported: false,
      errors: [],
    });

    await touchAgentHeartbeat(
      agentId,
      {
        discovery: {
          folders: [
            { name: 'app', path: '/var/www/app', hasCompose: true, composeFile: 'docker-compose.yml' },
          ],
          containers: [
            {
              id: 'a',
              names: ['/app_db_1'],
              image: 'postgres:16',
              state: 'running',
              labels: {
                'com.docker.compose.project': 'app',
                'com.docker.compose.project.working_dir': '/var/www/app',
                'com.docker.compose.service': 'db',
              },
            },
          ],
          dockerAvailable: true,
          roots: ['/var/www'],
          errors: [],
        },
      },
      { now: new Date('2026-07-03T00:00:00.000Z') },
    );

    const res = await request(app)
      .get(`/api/agents/${agentId}/discovery`)
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.dockerAvailable).toBe(true);
    expect(res.body.snapshotAt).toBe('2026-07-03T00:00:00.000Z');
    expect(res.body.reported).toBe(true);
    expect(res.body.errors).toEqual([]);
    // Folders must serialize as plain data even though they are stored as
    // Mongoose subdocuments (regression: a spread once shipped __parentArray).
    expect(res.body.folders[0]).toEqual({
      name: 'app',
      path: '/var/www/app',
      hasCompose: true,
      composeFile: 'docker-compose.yml',
      plan: { paths: ['/var/www/app'], databases: [], configs: [] },
    });
    const group = res.body.containers.find((c: { project: string }) => c.project === 'app');
    expect(group.plan.databases[0]).toMatchObject({ type: 'postgres', container: 'app_db_1' });
  });

  it("cloaks existence for another owner's agent discovery (404 not 403)", async () => {
    const a = await seedUser('own@t.com');
    const b = await seedUser('other@t.com');
    const { agent } = await registerAgent(a.id, { name: 'v', host: 'own.example' });
    const res = await request(app)
      .get(`/api/agents/${String(agent._id)}/discovery`)
      .set('Authorization', `JWT ${b.token}`);
    expect(res.status).toBe(404);
  });

  it('machine heartbeat accepts and stores a discovery snapshot end-to-end', async () => {
    const { id, token: userToken } = await seedUser('mh@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'mh.example' });
    const agentId = TOKEN_RE.exec(token)?.[1] as string;

    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: '0.1.0',
        hostname: 'vps',
        discovery: {
          folders: [],
          containers: [
            {
              id: 'a',
              names: ['/blog_cache_1'],
              image: 'redis:7',
              state: 'running',
              labels: {
                'com.docker.compose.project': 'blog',
                'com.docker.compose.project.working_dir': '/var/www/blog',
                'com.docker.compose.service': 'cache',
              },
            },
          ],
          dockerAvailable: true,
        },
      });
    expect(hb.status).toBe(200);

    const view = await request(app)
      .get(`/api/agents/${agentId}/discovery`)
      .set('Authorization', `JWT ${userToken}`);
    expect(view.body.dockerAvailable).toBe(true);
    expect(view.body.containers[0]).toMatchObject({ project: 'blog', addable: true });
  });

  it('salvages (does not reject) a snapshot that exceeds the label/value caps', () => {
    const labels = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, 'x'.repeat(600)]));
    const parsed = agentHeartbeatSchema.parse({
      discovery: {
        folders: [],
        containers: [{ id: 'a', names: [], image: '', state: '', labels }],
        dockerAvailable: true,
      },
    });
    const kept = parsed.discovery!.containers[0]!.labels;
    // Capped to 50 entries, each value truncated to 512 chars — never thrown away.
    expect(Object.keys(kept)).toHaveLength(50);
    expect(Object.values(kept)[0]).toHaveLength(512);
  });

  it('machine heartbeat SALVAGES an over-cap discovery: 200, online, stored ≤50 labels', async () => {
    const { id } = await seedUser('salv@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'salv.example' });
    const agentId = TOKEN_RE.exec(token)?.[1] as string;
    const labels = Object.fromEntries(Array.from({ length: 60 }, (_, i) => [`k${i}`, 'v']));

    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: '0.1.0',
        hostname: 'vps',
        discovery: {
          folders: [{ name: 'blog', path: '/var/www/blog', hasCompose: true, composeFile: 'docker-compose.yml' }],
          containers: [{ id: 'a', names: ['/c'], image: 'redis:7', state: 'running', labels }],
          dockerAvailable: true,
        },
      });
    expect(hb.status).toBe(200);
    expect(hb.body.agent.status).toBe('online');

    const agent = await Agent.findById(agentId);
    expect(Object.keys(agent!.discovery!.containers[0]!.labels as object)).toHaveLength(50);
    expect(agent!.discovery!.folders).toHaveLength(1);
  });

  it('machine heartbeat with a structurally-bogus discovery stays online and drops only discovery', async () => {
    const { id } = await seedUser('bogus@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'bogus.example' });
    const agentId = TOKEN_RE.exec(token)?.[1] as string;

    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      // folders as a string is not a valid array — must NOT 400 the heartbeat.
      .send({ version: '0.1.0', hostname: 'vps', discovery: { folders: 'nope', containers: [], dockerAvailable: false } });
    expect(hb.status).toBe(200);
    expect(hb.body.agent.status).toBe('online');

    const agent = await Agent.findById(agentId);
    expect(agent!.status).toBe('online');
    expect(agent!.discovery ?? null).toBeNull();
  });

  it('machine heartbeat stores discovery errors and the read endpoint surfaces them', async () => {
    const { id, token: userToken } = await seedUser('errs@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'errs.example' });
    const agentId = TOKEN_RE.exec(token)?.[1] as string;

    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({
        version: '0.1.0',
        hostname: 'vps',
        discovery: {
          folders: [],
          containers: [],
          dockerAvailable: false,
          errors: ['Docker socket is unreachable — check that the docker-socket-proxy is running.'],
        },
      });
    expect(hb.status).toBe(200);

    const view = await request(app)
      .get(`/api/agents/${agentId}/discovery`)
      .set('Authorization', `JWT ${userToken}`);
    expect(view.body.reported).toBe(true);
    expect(view.body.errors).toEqual([
      'Docker socket is unreachable — check that the docker-socket-proxy is running.',
    ]);
  });

  it('salvages an over-cap errors array instead of rejecting the heartbeat', () => {
    const errors = Array.from({ length: 30 }, (_, i) => `err-${i}`.repeat(50));
    const parsed = agentHeartbeatSchema.parse({
      discovery: { folders: [], containers: [], dockerAvailable: false, errors },
    });
    expect(parsed.discovery!.errors).toHaveLength(20);
    expect(parsed.discovery!.errors[0]!.length).toBeLessThanOrEqual(512);
  });

  it('defaults errors to [] when the agent omits the field entirely', () => {
    const parsed = agentHeartbeatSchema.parse({
      discovery: { folders: [], containers: [], dockerAvailable: false },
    });
    expect(parsed.discovery!.errors).toEqual([]);
  });
});

describe('agents: discovery refresh', () => {
  it('requires auth', async () => {
    expect(
      (await request(app).post('/api/agents/507f1f77bcf86cd799439011/discovery/refresh')).status,
    ).toBe(401);
  });

  it("cloaks existence for another owner's agent refresh (404 not 403)", async () => {
    const a = await seedUser('rfa@t.com');
    const b = await seedUser('rfb@t.com');
    const { agent } = await registerAgent(a.id, { name: 'v', host: 'rf.example' });
    const res = await request(app)
      .post(`/api/agents/${String(agent._id)}/discovery/refresh`)
      .set('Authorization', `JWT ${b.token}`);
    expect(res.status).toBe(404);
  });

  it('sets discoveryRequestedAt, and the next machine heartbeat signals refreshDiscovery once then clears it', async () => {
    const { id, token: userToken } = await seedUser('rf@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'rf2.example' });
    const agentId = TOKEN_RE.exec(token)?.[1] as string;

    const refresh = await request(app)
      .post(`/api/agents/${agentId}/discovery/refresh`)
      .set('Authorization', `JWT ${userToken}`);
    expect(refresh.status).toBe(204);

    const stored = await Agent.findById(agentId);
    expect(stored!.discoveryRequestedAt).not.toBeNull();

    const hb1 = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: '0.1.0', hostname: 'vps' });
    expect(hb1.body.refreshDiscovery).toBe(true);

    // Consumed atomically — flag cleared, so the very next heartbeat omits it.
    const clearedAgent = await Agent.findById(agentId);
    expect(clearedAgent!.discoveryRequestedAt).toBeNull();

    const hb2 = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: '0.1.0', hostname: 'vps' });
    expect(hb2.body.refreshDiscovery).toBeUndefined();
  });

  it('omits refreshDiscovery from the heartbeat response when no refresh was requested', async () => {
    const { token } = await registerAgent(
      (await seedUser('norf@t.com')).id,
      { name: 'v', host: 'norf.example' },
    );
    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: '0.1.0', hostname: 'vps' });
    expect(hb.body.refreshDiscovery).toBeUndefined();
  });
});

describe('backups: create with agent assignment', () => {
  it('assigns the project to an owned agent (service)', async () => {
    const { id } = await seedUser('ca@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'ca.example' });
    const project = await createProject(id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
      agentId: String(agent._id),
    });
    expect(String(project.agent)).toBe(String(agent._id));
  });

  it('rejects assigning to an agent the user does not own with 404 (existence-cloak)', async () => {
    const a = await seedUser('ca2@t.com');
    const b = await seedUser('cb2@t.com');
    const { agent } = await registerAgent(a.id, { name: 'v', host: 'ca2.example' });
    await expect(
      createProject(b.id, {
        name: 'p',
        path: '/var/www/p',
        repoPassword: 'password1',
        agentId: String(agent._id),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('POST /api/backups with agentId assigns at creation', async () => {
    const { id, token } = await seedUser('httpca@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'httpca.example' });
    const res = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'p', path: '/var/www/p', repoPassword: 'password1', agentId: String(agent._id) });
    expect(res.status).toBe(201);
    expect(res.body.project.agentId).toBe(String(agent._id));
  });

  it('accepts a path under the agent-reported roots and rejects one outside them', async () => {
    const { id } = await seedUser('roots@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'roots.example' });
    await touchAgentHeartbeat(String(agent._id), {
      discovery: {
        folders: [],
        containers: [],
        dockerAvailable: true,
        roots: ['/opt/projects'],
        errors: [],
      },
    });

    const ok = await createProject(id, {
      name: 'in-roots',
      path: '/opt/projects/shop',
      repoPassword: 'password1',
      agentId: String(agent._id),
    });
    expect(ok.path).toBe('/opt/projects/shop');

    await expect(
      createProject(id, {
        name: 'out-of-roots',
        path: '/var/www/shop',
        repoPassword: 'password1',
        agentId: String(agent._id),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('falls back to /var/www for agents that never reported roots', async () => {
    const { id } = await seedUser('legacyroots@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'legacyroots.example' });

    const ok = await createProject(id, {
      name: 'legacy',
      path: '/var/www/legacy',
      repoPassword: 'password1',
      agentId: String(agent._id),
    });
    expect(ok.path).toBe('/var/www/legacy');

    await expect(
      createProject(id, {
        name: 'outside',
        path: '/opt/projects/shop',
        repoPassword: 'password1',
        agentId: String(agent._id),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates plan paths and configs against the agent roots too', async () => {
    const { id } = await seedUser('planroots@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'planroots.example' });
    await touchAgentHeartbeat(String(agent._id), {
      discovery: {
        folders: [],
        containers: [],
        dockerAvailable: true,
        roots: ['/opt/projects'],
        errors: [],
      },
    });
    await expect(
      createProject(id, {
        name: 'smuggle',
        path: '/opt/projects/shop',
        repoPassword: 'password1',
        agentId: String(agent._id),
        plan: { paths: ['/opt/projects/shop'], databases: [], configs: ['/root/.ssh'] },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('agents: heartbeat roots sanitization + version reporting', () => {
  it('sanitizes agent-reported roots: normalizes, dedups, drops denied/invalid entries', () => {
    const parsed = agentHeartbeatSchema.parse({
      discovery: {
        folders: [],
        containers: [],
        dockerAvailable: true,
        roots: ['/opt/', '/opt', '/etc/nginx', 'relative', '/srv//apps/', '/'],
      },
    });
    expect(parsed.discovery!.roots).toEqual(['/opt', '/srv/apps']);
  });

  it('defaults roots to [] when the agent omits the field (pre-0.2.0 daemons)', () => {
    const parsed = agentHeartbeatSchema.parse({
      discovery: { folders: [], containers: [], dockerAvailable: false },
    });
    expect(parsed.discovery!.roots).toEqual([]);
  });

  it('heartbeat response advertises the expected agent version', async () => {
    const { id } = await seedUser('latest@t.com');
    const { token } = await registerAgent(id, { name: 'v', host: 'latest.example' });
    const hb = await request(app)
      .post('/api/agent/heartbeat')
      .set('Authorization', `Bearer ${token}`)
      .send({ version: '0.1.0', hostname: 'vps' });
    expect(hb.status).toBe(200);
    expect(hb.body.latestVersion).toBe(EXPECTED_AGENT_VERSION);
  });

  it('GET /api/agents flags an old daemon as outdated and a current one as not', async () => {
    const { id, token: userToken } = await seedUser('outd@t.com');
    const { agent: oldAgent } = await registerAgent(id, { name: 'old', host: 'old.example' });
    const { agent: newAgent } = await registerAgent(id, { name: 'new', host: 'new.example' });
    await touchAgentHeartbeat(String(oldAgent._id), { version: '0.1.0' });
    await touchAgentHeartbeat(String(newAgent._id), { version: EXPECTED_AGENT_VERSION });

    const res = await request(app).get('/api/agents').set('Authorization', `JWT ${userToken}`);
    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      (res.body.agents as Array<{ name: string; agentVersion: string; outdated: boolean }>).map(
        (a) => [a.name, a],
      ),
    );
    expect(byName['old']).toMatchObject({ agentVersion: '0.1.0', outdated: true });
    expect(byName['new']).toMatchObject({
      agentVersion: EXPECTED_AGENT_VERSION,
      outdated: false,
    });
  });

  it('fleet rollup carries agentVersion + outdated; never-reported agents are not outdated', async () => {
    const { id } = await seedUser('fleetv@t.com');
    const { agent } = await registerAgent(id, { name: 'silent', host: 'silent.example' });
    const fleet = await computeFleet(id);
    expect(fleet[0]).toMatchObject({
      id: String(agent._id),
      agentVersion: '',
      outdated: false,
    });
  });

  it('allowedRootsForAgent returns reported roots or the /var/www default', async () => {
    const { id } = await seedUser('rootsvc@t.com');
    const { agent } = await registerAgent(id, { name: 'v', host: 'rootsvc.example' });
    expect(allowedRootsForAgent(agent)).toEqual(['/var/www']);
    const touched = await touchAgentHeartbeat(String(agent._id), {
      discovery: {
        folders: [],
        containers: [],
        dockerAvailable: true,
        roots: ['/opt'],
        errors: [],
      },
    });
    expect(allowedRootsForAgent(touched!)).toEqual(['/opt']);
  });
});

describe('agents: project job history endpoint', () => {
  it('requires auth', async () => {
    const res = await request(app).get(
      '/api/agents/jobs?projectId=507f1f77bcf86cd799439011',
    );
    expect(res.status).toBe(401);
  });

  it('rejects a malformed projectId', async () => {
    const { token } = await seedUser('jobs-bad@t.com');
    const res = await request(app)
      .get('/api/agents/jobs?projectId=not-an-id')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(400);
  });

  it('404s for both missing AND foreign projects (surface #2 existence-cloak)', async () => {
    const { token } = await seedUser('jobs-owner@t.com');
    const missing = await request(app)
      .get('/api/agents/jobs?projectId=507f1f77bcf86cd799439011')
      .set('Authorization', `JWT ${token}`);
    expect(missing.status).toBe(404);

    const other = await seedUser('jobs-other@t.com');
    const project = await seedProject(other.id, null, 0, 0);
    const foreign = await request(app)
      .get(`/api/agents/jobs?projectId=${project._id}`)
      .set('Authorization', `JWT ${token}`);
    // Surface #2 / S2-01: foreign owner is 404 (same body as missing) so an
    // attacker cannot enumerate a target tenant's project directory.
    expect(foreign.status).toBe(404);
  });

  it('returns [] for an agent-less project (local jobs are not persisted)', async () => {
    const { id, token } = await seedUser('jobs-local@t.com');
    const project = await seedProject(id, null, 0, 0);
    const res = await request(app)
      .get(`/api/agents/jobs?projectId=${project._id}`)
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.jobs).toEqual([]);
  });

  it('lists jobs newest-first with restore payload, lifecycle timestamps, and log tail', async () => {
    const { id, token } = await seedUser('jobs-list@t.com');
    const { agent } = await registerAgent(id, { name: 'j', host: 'jobs.example' });
    const project = await seedProject(id, String(agent._id), 0, 0);

    const older = await AgentJob.create({
      owner: id,
      agent: agent._id,
      project: project._id,
      kind: 'backup',
      status: 'succeeded',
      claimedAt: new Date('2026-07-01T00:00:01Z'),
      finishedAt: new Date('2026-07-01T00:00:05Z'),
      logTail: ['backup done'],
      createdAt: new Date('2026-07-01T00:00:00Z'),
    });
    const newer = await AgentJob.create({
      owner: id,
      agent: agent._id,
      project: project._id,
      kind: 'restore',
      status: 'failed',
      error: 'restic restore exit 1',
      restorePayload: { snapshotId: '5ad025be', overwrite: true, targetPath: null },
      logTail: ['attempt 1/3 failed'],
      createdAt: new Date('2026-07-02T00:00:00Z'),
    });

    const res = await request(app)
      .get(`/api/agents/jobs?projectId=${project._id}`)
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.jobs.map((j: { id: string }) => j.id)).toEqual([
      String(newer._id),
      String(older._id),
    ]);
    expect(res.body.jobs[0]).toMatchObject({
      kind: 'restore',
      status: 'failed',
      error: 'restic restore exit 1',
      restore: { snapshotId: '5ad025be', overwrite: true, targetPath: null },
      logTail: ['attempt 1/3 failed'],
      startedAt: null,
      finishedAt: null,
    });
    expect(res.body.jobs[1]).toMatchObject({
      kind: 'backup',
      status: 'succeeded',
      restore: null,
      startedAt: '2026-07-01T00:00:01.000Z',
      finishedAt: '2026-07-01T00:00:05.000Z',
    });
    // Secrets never appear in the history payload.
    expect(JSON.stringify(res.body)).not.toContain('password');
    expect(JSON.stringify(res.body)).not.toContain('privateKey');
  });

  it('caps the history at 50 jobs', async () => {
    const { id, token } = await seedUser('jobs-cap@t.com');
    const { agent } = await registerAgent(id, { name: 'c', host: 'cap.example' });
    const project = await seedProject(id, String(agent._id), 0, 0);
    await AgentJob.insertMany(
      Array.from({ length: 55 }, (_, i) => ({
        owner: id,
        agent: agent._id,
        project: project._id,
        kind: 'backup',
        status: 'succeeded',
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, i)),
      })),
    );
    const res = await request(app)
      .get(`/api/agents/jobs?projectId=${project._id}`)
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(50);
  });
});
