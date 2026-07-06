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
import { serializeProject } from './backups.serialize.js';
import { __setPaymentProviderForTests } from '../billing/active-provider.js';
import { PolarProvider } from '../billing/providers/polar.js';
import { assertAlertsAllowed } from '../billing/entitlements.service.js';

const app = createApp();

// OSS self-host mode → business ceiling; tier-denial tests flip locally.
const __prevPaymentProvider = env.PAYMENT_PROVIDER;
beforeAll(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
  await startMemoryMongo();
});
afterAll(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevPaymentProvider;
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
    profile: { firstName: 'A', lastName: 'W' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

describe('PATCH /api/backups/:projectId/alerts', () => {
  it('sets and clears the per-project webhook', async () => {
    const a = await seedUser('wh@t.com');
    const project = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    const set = await request(app)
      .patch(`/api/backups/${project._id}/alerts`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ webhookUrl: 'https://hooks.example/dockstash' });
    expect(set.status).toBe(200);
    expect(set.body.project.alertWebhookUrl).toBe('https://hooks.example/dockstash');

    const clear = await request(app)
      .patch(`/api/backups/${project._id}/alerts`)
      .set('Authorization', `JWT ${a.token}`)
      .send({ webhookUrl: null });
    expect(clear.status).toBe(200);
    expect(clear.body.project.alertWebhookUrl).toBe('');
  });

  it('rejects invalid or non-http(s) URLs', async () => {
    const a = await seedUser('wh-bad@t.com');
    const project = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    for (const webhookUrl of ['not-a-url', 'ftp://x.example/hook']) {
      const res = await request(app)
        .patch(`/api/backups/${project._id}/alerts`)
        .set('Authorization', `JWT ${a.token}`)
        .send({ webhookUrl });
      expect(res.status).toBe(400);
    }
  });

  it('403s the free tier with the alertsLocked reason', async () => {
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    __setPaymentProviderForTests(
      new PolarProvider({
        nowSeconds: () => 1_700_000_000,
        getWebhookSecret: () => 'test-webhook-secret',
      }),
    );
    try {
      const a = await seedUser('wh-free@t.com');
      const project = await createProject(a.id, {
        name: 'p',
        path: '/var/www/p',
        repoPassword: 'password1',
      });
      const res = await request(app)
        .patch(`/api/backups/${project._id}/alerts`)
        .set('Authorization', `JWT ${a.token}`)
        .send({ webhookUrl: 'https://hooks.example/x' });
      expect(res.status).toBe(403);
      expect(res.body.error.details.reason).toBe('alertsLocked');
      // assertAlertsAllowed also resolves happily for the business ceiling.
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
      __setPaymentProviderForTests(null);
    }
  });

  it('assertAlertsAllowed resolves under the OSS business ceiling', async () => {
    const a = await seedUser('wh-oss@t.com');
    await expect(assertAlertsAllowed(a.id)).resolves.toMatchObject({
      slug: 'business',
    });
  });

  it('404s unknown AND foreign projects (surface #2 existence-cloak)', async () => {
    const a = await seedUser('wh-owner@t.com');
    const b = await seedUser('wh-other@t.com');
    const project = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    const missing = await request(app)
      .patch('/api/backups/507f1f77bcf86cd799439011/alerts')
      .set('Authorization', `JWT ${a.token}`)
      .send({ webhookUrl: '' });
    expect(missing.status).toBe(404);
    const foreign = await request(app)
      .patch(`/api/backups/${project._id}/alerts`)
      .set('Authorization', `JWT ${b.token}`)
      .send({ webhookUrl: '' });
    // Surface #2 / S2-01: foreign-owner returns 404 (not 403) — indistinguishable
    // from the missing case so an attacker cannot enumerate project ids.
    expect(foreign.status).toBe(404);
  });
});

describe('serializeProject alertWebhookUrl back-compat', () => {
  it('surfaces "" for legacy rows without the field', async () => {
    const a = await seedUser('legacy-wh@t.com');
    const raw = await Project.collection.insertOne({
      owner: (await User.findOne({ email: 'legacy-wh@t.com' }))?._id,
      name: 'legacy',
      path: '/var/www/l',
      plan: { paths: ['/var/www/l'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
      lastStatus: 'idle',
      paused: false,
      legalHold: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const doc = await Project.findById(raw.insertedId);
    expect(doc).not.toBeNull();
    // Field absent on the raw row; the serializer must not emit undefined.
    const serialized = serializeProject(doc!);
    expect(serialized.alertWebhookUrl).toBe('');
    void a;
  });
});
