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
import { Project } from '../backups/backups.model.js';
import { decryptSecret } from '../../shared/crypto/index.js';
import {
  computeFleet,
  heartbeatAgent,
  listAgentsForUser,
  loadOwnedAgent,
  registerAgent,
} from './agents.service.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'A', lastName: 'G' },
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
  it('registerAgent encrypts the API key and returns it once', async () => {
    const { id } = await seedUser('a@t.com');
    const { agent, apiKey } = await registerAgent(id, { name: 'prod', host: '10.0.0.1' });
    expect(apiKey).toMatch(/^[a-f0-9]{48}$/);
    expect(agent.apiKeyEnc.ciphertext).not.toContain(apiKey);
    expect(decryptSecret(agent.apiKeyEnc)).toBe(apiKey);
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

  it('heartbeatAgent marks the agent online with a timestamp', async () => {
    const a = await seedUser('a@t.com');
    const { agent } = await registerAgent(a.id, { name: 'a1', host: 'h' });
    const now = new Date('2027-01-01T00:00:00Z');
    const beat = await heartbeatAgent(String(agent._id), a.id, { now });
    expect(beat.status).toBe('online');
    expect(beat.lastSeenAt?.toISOString()).toBe('2027-01-01T00:00:00.000Z');
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
});

describe('agents: HTTP routes', () => {
  it('requires auth on every route', async () => {
    expect((await request(app).get('/api/agents')).status).toBe(401);
    expect((await request(app).post('/api/agents')).status).toBe(401);
    expect((await request(app).get('/api/agents/fleet')).status).toBe(401);
    expect(
      (await request(app).post('/api/agents/507f1f77bcf86cd799439011/heartbeat')).status,
    ).toBe(401);
  });

  it('registers, lists, heartbeats an agent and reads the fleet (Business default)', async () => {
    const { id, token } = await seedUser('a@t.com');
    const reg = await request(app)
      .post('/api/agents')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'prod', host: '10.0.0.9', port: 2200 });
    expect(reg.status).toBe(201);
    expect(reg.body.apiKey).toMatch(/^[a-f0-9]{48}$/);
    expect(JSON.stringify(reg.body.agent)).not.toContain(reg.body.apiKey);
    const agentId = reg.body.agent.id;

    await seedProject(id, agentId, 2048, 4);

    const list = await request(app)
      .get('/api/agents')
      .set('Authorization', `JWT ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.agents).toHaveLength(1);

    const beat = await request(app)
      .post(`/api/agents/${agentId}/heartbeat`)
      .set('Authorization', `JWT ${token}`);
    expect(beat.status).toBe(200);
    expect(beat.body.agent.status).toBe('online');

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
  });

  it('rejects an invalid agent id at the zod layer', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .post('/api/agents/not-an-id/heartbeat')
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
