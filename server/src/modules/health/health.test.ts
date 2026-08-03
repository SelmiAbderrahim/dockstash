import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { User } from '../users/users.model.js';
import { Project } from '../backups/backups.model.js';
import {
  configureHealthController,
  resetHealthController,
  runHealthCheck,
  pingRedis,
  redisProbe,
  type RedisPingClient,
} from './index.js';

const app = createApp();

function tokenFor(user: { id: string; email: string }): string {
  return `JWT ${jwt.sign(
    { _id: user.id, id: user.id, email: user.email, role: 'Member' },
    env.JWT_SECRET,
    { expiresIn: 300 },
  )}`;
}

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(async () => {
  await clearCollections();
  resetHealthController();
});

describe('runHealthCheck', () => {
  it('reports ok when db + redis probes pass', async () => {
    const res = await runHealthCheck({
      probeDb: () => true,
      probeRedis: async () => true,
      now: () => new Date('2027-01-01T00:00:00Z'),
    });
    expect(res.status).toBe('ok');
    expect(res.db).toBe(true);
    expect(res.redis).toBe(true);
    expect(res.timestamp).toBe('2027-01-01T00:00:00.000Z');
  });

  it('reports degraded when db is down', async () => {
    const res = await runHealthCheck({
      probeDb: () => false,
      probeRedis: async () => true,
    });
    expect(res.status).toBe('degraded');
    expect(res.db).toBe(false);
  });

  it('reports degraded when db is up but redis is down', async () => {
    const res = await runHealthCheck({
      probeDb: () => true,
      probeRedis: async () => false,
    });
    expect(res.status).toBe('degraded');
    expect(res.db).toBe(true);
    expect(res.redis).toBe(false);
  });

  it('uses default probes when none provided', async () => {
    const res = await runHealthCheck();
    // in tests mongoose is connected via memory server → ok
    expect(res.status).toBe('ok');
  });

  it('probes the configured Redis via the default probe', async () => {
    const original = env.REDIS_URL;
    (env as { REDIS_URL?: string }).REDIS_URL = 'redis://localhost:6379';
    const spy = vi.spyOn(redisProbe, 'pingRedis').mockResolvedValue(true);
    try {
      const res = await runHealthCheck({ probeDb: () => true });
      expect(res.redis).toBe(true);
      expect(res.redisConfigured).toBe(true);
      expect(spy).toHaveBeenCalledWith('redis://localhost:6379');
    } finally {
      spy.mockRestore();
      (env as { REDIS_URL?: string }).REDIS_URL = original;
    }
  });
});

describe('pingRedis', () => {
  function fakeClient(overrides: Partial<RedisPingClient>): RedisPingClient {
    return {
      ping: overrides.ping ?? (async () => 'PONG'),
      quit: overrides.quit ?? (async () => undefined),
    };
  }

  it('returns true when the client answers PONG', async () => {
    const ok = await pingRedis('redis://x', () => fakeClient({ ping: async () => 'PONG' }));
    expect(ok).toBe(true);
  });

  it('returns false when the reply is not PONG', async () => {
    const ok = await pingRedis('redis://x', () => fakeClient({ ping: async () => 'nope' }));
    expect(ok).toBe(false);
  });

  it('returns false when the ping throws', async () => {
    const ok = await pingRedis('redis://x', () =>
      fakeClient({
        ping: async () => {
          throw new Error('unreachable');
        },
      }),
    );
    expect(ok).toBe(false);
  });

  it('swallows a quit() failure in the finally cleanup', async () => {
    const ok = await pingRedis('redis://x', () =>
      fakeClient({
        ping: async () => 'PONG',
        quit: async () => {
          throw new Error('quit failed');
        },
      }),
    );
    expect(ok).toBe(true);
  });
});

describe('/api/health', () => {
  it('returns 200 with ok status when probes pass', async () => {
    configureHealthController({
      probeDb: () => true,
      probeRedis: async () => true,
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns 503 when a probe fails', async () => {
    configureHealthController({
      probeDb: () => false,
      probeRedis: async () => true,
    });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
  });

  it('does not require auth', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).not.toBe(401);
  });
});

describe('/api/metrics', () => {
  it('exposes aggregate project counters', async () => {
    const owner = await User.create({ email: 'o@x.co', password: 'p' });
    await Project.create({
      owner: owner._id,
      name: 'a',
      path: '/var/www/a',
      plan: { paths: ['/var/www/a'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
      lastStatus: 'failed',
    });
    await Project.create({
      owner: owner._id,
      name: 'b',
      path: '/var/www/b',
      plan: { paths: ['/var/www/b'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
      lastStatus: 'success',
    });
    const res = await request(app).get('/api/metrics');
    expect(res.status).toBe(200);
    expect(res.body.projects.total).toBe(2);
    expect(res.body.projects.failed).toBe(1);
    expect(res.body.projects.succeeded).toBe(1);
  });
});

describe('/api/health/projects', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/health/projects');
    expect(res.status).toBe(401);
  });

  it('surfaces owner-scoped lastSuccessAt and lastDrillAt', async () => {
    const alice = await User.create({ email: 'alice@x.co', password: 'p', emailVerified: true });
    const bob = await User.create({ email: 'bob@x.co', password: 'p', emailVerified: true });
    const success = new Date('2027-01-01T00:00:00Z');
    await Project.create({
      owner: alice._id,
      name: 'ap',
      path: '/var/www/a',
      plan: { paths: ['/var/www/a'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
      lastSuccessAt: success,
      lastDrillAt: success,
      lastDrillStatus: 'pass',
    });
    await Project.create({
      owner: bob._id,
      name: 'bp',
      path: '/var/www/b',
      plan: { paths: ['/var/www/b'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
    });
    const token = tokenFor({ id: String(alice._id), email: alice.email });
    const res = await request(app)
      .get('/api/health/projects')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('ap');
    expect(res.body.projects[0].lastSuccessAt).toBe('2027-01-01T00:00:00.000Z');
    expect(res.body.projects[0].lastDrillStatus).toBe('pass');
  });

  it('serializes the complementary date fields (lastRunAt/lastCheckAt present, others null)', async () => {
    const carol = await User.create({ email: 'carol@x.co', password: 'p', emailVerified: true });
    const at = new Date('2027-02-02T00:00:00Z');
    await Project.create({
      owner: carol._id,
      name: 'cp',
      path: '/var/www/c',
      plan: { paths: ['/var/www/c'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
      lastRunAt: at,
      lastCheckAt: at,
      lastCheckStatus: 'pass',
    });
    const token = tokenFor({ id: String(carol._id), email: carol.email });
    const res = await request(app)
      .get('/api/health/projects')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    const project = res.body.projects[0];
    expect(project.lastRunAt).toBe('2027-02-02T00:00:00.000Z');
    expect(project.lastCheckAt).toBe('2027-02-02T00:00:00.000Z');
    // Absent fields serialize to null.
    expect(project.lastSuccessAt).toBeNull();
    expect(project.lastDrillAt).toBeNull();
  });
});
