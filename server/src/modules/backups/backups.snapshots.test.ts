import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { upsertStorage, testStorage } from '../settings/settings.service.js';
import { createProject } from './backups.service.js';
import {
  configureSnapshotsController,
  makeProductionSnapshotLister,
  resetSnapshotsController,
} from './backups.snapshots.controller.js';
import { serializeSnapshot } from './backups.serialize.js';
import { ProcessResticRunner } from './backups.restic-runner.js';

const app = createApp();
const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'S', lastName: 'N' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(ownerId: string) {
  return createProject(ownerId, {
    name: 'app',
    path: '/var/www/app',
    repoPassword: 'repo-pw',
  });
}

const DETAIL = {
  id: 'aabbccddeeff00112233',
  short_id: 'aabbccdd',
  time: '2026-07-01T10:00:00Z',
  hostname: 'api',
  tags: ['app'],
  summary: { total_bytes_processed: 4096 },
};

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});
afterEach(() => {
  resetSnapshotsController();
  vi.restoreAllMocks();
});

describe('GET /api/backups/:projectId/snapshots', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/backups/507f1f77bcf86cd799439011/snapshots');
    expect(res.status).toBe(401);
  });

  it('404s an unknown project and 403s a foreign one before touching storage', async () => {
    const a = await seedUser('a@t.com');
    const b = await seedUser('b@t.com');
    const project = await seedProject(a.id);
    const lister = { listSnapshots: vi.fn(async () => [DETAIL]) };
    configureSnapshotsController(lister);

    const missing = await request(app)
      .get('/api/backups/507f1f77bcf86cd799439011/snapshots')
      .set('Authorization', `JWT ${a.token}`);
    expect(missing.status).toBe(404);

    const foreign = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${b.token}`);
    expect(foreign.status).toBe(403);
    expect(lister.listSnapshots).not.toHaveBeenCalled();
  });

  it('503s when no lister is configured', async () => {
    const a = await seedUser('a@t.com');
    const project = await seedProject(a.id);
    const res = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(503);
  });

  it('returns serialized snapshots for the owner', async () => {
    const a = await seedUser('a@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({
      listSnapshots: async (projectId, owner) => {
        expect(projectId).toBe(String(project._id));
        expect(owner).toBe(a.id);
        return [DETAIL, { id: 'ffee', short_id: '', time: '2026-06-01T00:00:00Z' }];
      },
    });
    const res = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.snapshots).toEqual([
      {
        id: 'aabbccdd',
        projectId: String(project._id),
        time: '2026-07-01T10:00:00Z',
        sizeBytes: 4096,
        hostname: 'api',
        tags: ['app'],
      },
      {
        id: 'ffee',
        projectId: String(project._id),
        time: '2026-06-01T00:00:00Z',
        sizeBytes: 0,
      },
    ]);
  });

  it('502s with detail when the lister fails', async () => {
    const a = await seedUser('a@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({
      listSnapshots: async () => {
        throw new Error('repo unreachable');
      },
    });
    const res = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain('repo unreachable');
  });

  it('passes through HttpErrors from the lister (e.g. storage unconfigured)', async () => {
    const a = await seedUser('a@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController(makeProductionSnapshotLister());
    // storage never configured → loadTransportForUser throws 400
    const res = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(400);
  });

});

describe('makeProductionSnapshotLister', () => {
  it('reads detailed snapshots from the resolved process runner', async () => {
    const a = await seedUser('a@t.com');
    await upsertStorage(a.id, {
      host: 'h',
      user: 'u',
      port: 22,
      privateKey: 'K',
    });
    await testStorage(a.id, {
      probe: {
        async connect() {
          return { fingerprint: PIN, hostKeyLine: 'h ssh-ed25519 AAAA' };
        },
      },
    });
    const project = await seedProject(a.id);
    const spy = vi
      .spyOn(ProcessResticRunner.prototype, 'snapshotsDetailed')
      .mockResolvedValue([DETAIL]);
    const lister = makeProductionSnapshotLister();
    const records = await lister.listSnapshots(String(project._id), a.id);
    expect(records).toEqual([DETAIL]);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('serializeSnapshot', () => {
  it('falls back to the full id when short_id is empty and omits empty tags', () => {
    expect(
      serializeSnapshot({ id: 'full-id', short_id: '', time: 't', tags: [] }, 'p1'),
    ).toEqual({ id: 'full-id', projectId: 'p1', time: 't', sizeBytes: 0 });
  });
});

describe('lister non-Error failures', () => {
  it('502s with the stringified value', async () => {
    const a = await seedUser('str@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({
      listSnapshots: async () => {
        throw 'plain-string boom';
      },
    });
    const res = await request(app)
      .get(`/api/backups/${project._id}/snapshots`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain('plain-string boom');
  });
});
