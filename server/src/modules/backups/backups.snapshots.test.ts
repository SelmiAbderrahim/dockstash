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

  it('404s both unknown AND foreign projects before touching storage (surface #2)', async () => {
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
    // Surface #2 / S2-01: foreign owner returns 404 (existence-cloak).
    expect(foreign.status).toBe(404);
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

describe('GET /api/backups/:projectId/pitr', () => {
  // OSS self-host mode → business ceiling, so the Pro+ gate passes by default;
  // the free-tier denial test flips the provider on locally.
  let prevProvider: string;
  beforeEach(() => {
    prevProvider = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
  });
  afterEach(() => {
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prevProvider;
  });

  const EARLY = { id: 'early-full', short_id: 'early', time: '2026-07-01T00:00:00Z' };
  const LATE = { id: 'late-full', short_id: 'late', time: '2026-07-02T00:00:00Z' };

  it('requires auth', async () => {
    const res = await request(app).get(
      '/api/backups/507f1f77bcf86cd799439011/pitr?ts=2026-07-01T00:00:00Z',
    );
    expect(res.status).toBe(401);
  });

  it('400s a missing or unparseable ts', async () => {
    const a = await seedUser('pitr-bad-ts@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({ listSnapshots: async () => [EARLY] });
    const missing = await request(app)
      .get(`/api/backups/${project._id}/pitr`)
      .set('Authorization', `JWT ${a.token}`);
    expect(missing.status).toBe(400);
    const garbage = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=not-a-date`)
      .set('Authorization', `JWT ${a.token}`);
    expect(garbage.status).toBe(400);
  });

  it('resolves the newest snapshot at or before ts with the gap in seconds', async () => {
    const a = await seedUser('pitr-happy@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({ listSnapshots: async () => [LATE, EARLY] });
    const res = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:30:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.snapshot.id).toBe('early');
    expect(res.body.gapSeconds).toBe(1800);
    expect(res.body.target).toBe('2026-07-01T00:30:00.000Z');
  });

  it('404s when no snapshot predates ts', async () => {
    const a = await seedUser('pitr-none@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({ listSnapshots: async () => [LATE] });
    const res = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-06-01T00:00:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(404);
  });

  it('403s the free tier with the pitrLocked reason', async () => {
    const { __setPaymentProviderForTests } = await import('../billing/active-provider.js');
    const { PolarProvider } = await import('../billing/providers/polar.js');
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    __setPaymentProviderForTests(
      new PolarProvider({
        nowSeconds: () => 1_700_000_000,
        getWebhookSecret: () => 'test-webhook-secret',
      }),
    );
    try {
      const a = await seedUser('pitr-free@t.com');
      const project = await seedProject(a.id);
      configureSnapshotsController({ listSnapshots: async () => [EARLY] });
      const res = await request(app)
        .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:00:00Z`)
        .set('Authorization', `JWT ${a.token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.reason).toBe('pitrLocked');
    } finally {
      __setPaymentProviderForTests(null);
    }
  });

  it('503s when no lister is configured', async () => {
    const a = await seedUser('pitr-unconf@t.com');
    const project = await seedProject(a.id);
    const res = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:00:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(503);
  });

  it('502s when the lister fails and passes HttpErrors through', async () => {
    const a = await seedUser('pitr-fail@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({
      listSnapshots: async () => {
        throw new Error('repo gone');
      },
    });
    const broken = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:00:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(broken.status).toBe(502);
    expect(broken.body.error.message).toContain('repo gone');

    configureSnapshotsController(makeProductionSnapshotLister());
    // storage never configured → loadTransportForUser throws 400 (HttpError passthrough)
    const http = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:00:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(http.status).toBe(400);
  });

  it('502s with the stringified value on non-Error lister failures', async () => {
    const a = await seedUser('pitr-str@t.com');
    const project = await seedProject(a.id);
    configureSnapshotsController({
      listSnapshots: async () => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'pitr-string-boom';
      },
    });
    const res = await request(app)
      .get(`/api/backups/${project._id}/pitr?ts=2026-07-01T00:00:00Z`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain('pitr-string-boom');
  });
});
