import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword, signToken } from '../auth/index.js';
import { LoginChallenge } from '../auth/login-challenge.model.js';
import { AuditLog, recordAudit } from '../audit/index.js';
import { Customer, Subscription } from '../billing/index.js';
import { Project } from '../backups/index.js';
import { Schedule } from '../scheduler/index.js';
import type { PurgeQueue } from '../legal/index.js';
import {
  ROLE_ADMIN,
  ROLE_MEMBER,
  ROLE_OWNER,
  ROLE_SUPERADMIN,
  User,
  toPublicUser,
  type UserHydrated,
} from '../users/index.js';
import {
  configureSuperadminController,
  resetSuperadminController,
} from './superadmin.controller.js';
import { collectStats, getSystemSummary } from './superadmin.service.js';

const app = createApp();

async function createUser(
  email: string,
  role: string,
  extra: Record<string, unknown> = {},
): Promise<UserHydrated> {
  return (await User.create({
    email,
    password: await hashPassword('hunter2hunter2'),
    role,
    emailVerified: true,
    ...extra,
  })) as UserHydrated;
}

function tokenFor(user: UserHydrated): string {
  return `JWT ${signToken(toPublicUser(user))}`;
}

const ENC = { ciphertext: 'ct', iv: 'iv', authTag: 'tag', keyVersion: 1 };

describe('superadmin module', () => {
  let superadmin: UserHydrated;
  let admin: UserHydrated;
  let superToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
    resetSuperadminController();
    superadmin = await createUser('root@dockstash.test', ROLE_SUPERADMIN);
    admin = await createUser('admin@dockstash.test', ROLE_ADMIN);
    superToken = tokenFor(superadmin);
    adminToken = tokenFor(admin);
  });

  afterEach(() => {
    resetSuperadminController();
  });

  describe('gating', () => {
    const routes: Array<[method: 'get' | 'patch' | 'post' | 'delete', path: string]> = [
      ['get', '/api/superadmin/stats'],
      ['get', '/api/superadmin/users'],
      ['patch', '/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718/role'],
      ['post', '/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718/verify'],
      ['patch', '/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718/legal-hold'],
      ['delete', '/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718'],
      ['get', '/api/superadmin/billing'],
      ['get', '/api/superadmin/audit'],
      ['get', '/api/superadmin/system'],
    ];

    it('rejects unauthenticated requests with 401', async () => {
      for (const [method, path] of routes) {
        const res = await request(app)[method](path);
        expect(res.status, `${method} ${path}`).toBe(401);
      }
    });

    it('rejects an Admin-role token with 403 on every route', async () => {
      for (const [method, path] of routes) {
        const res = await request(app)[method](path).set('Authorization', adminToken);
        expect(res.status, `${method} ${path}`).toBe(403);
      }
    });

    it('rejects an unverified superadmin (uniform requireVerified gate)', async () => {
      const unverified = await createUser('root2@dockstash.test', ROLE_SUPERADMIN, {
        emailVerified: false,
      });
      const res = await request(app)
        .get('/api/superadmin/stats')
        .set('Authorization', tokenFor(unverified));
      expect(res.status).toBe(403);
      expect(res.body.error.details?.code).toBe('EMAIL_NOT_VERIFIED');
    });
  });

  describe('GET /api/superadmin/stats', () => {
    it('returns zeros for an empty database (verifiedPct 0-total branch)', async () => {
      // Only the two fixture users exist; wipe them for the true-empty case.
      await User.deleteMany({});
      // Re-create just the superadmin to authenticate with.
      superadmin = await createUser('root@dockstash.test', ROLE_SUPERADMIN);
      const res = await request(app)
        .get('/api/superadmin/stats')
        .set('Authorization', tokenFor(superadmin));
      expect(res.status).toBe(200);
      expect(res.body.users.total).toBe(1);
      expect(res.body.subscriptions).toEqual([]);
      expect(res.body.projects).toEqual({ total: 0, paused: 0 });
      expect(res.body.backups).toEqual({ projectsWithSuccess: 0 });
      expect(res.body.snapshots).toEqual({ total: 0, repoBytes: 0 });
    });

    it('reports verifiedPct 0 when no users exist at all (direct service call)', async () => {
      await User.deleteMany({});
      const stats = await collectStats();
      expect(stats.users).toEqual({ total: 0, new7d: 0, new30d: 0, verifiedPct: 0 });
    });

    it('computes user, subscription, project, backup, and snapshot numbers', async () => {
      const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
      const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const member = await createUser('m1@dockstash.test', ROLE_MEMBER, {
        emailVerified: false,
      });
      // createdAt is immutable through Mongoose — backdate via the native driver.
      await User.collection.updateOne({ _id: member._id }, { $set: { createdAt: old } });
      await createUser('m2@dockstash.test', ROLE_MEMBER);
      await User.collection.updateMany(
        { email: { $in: ['root@dockstash.test', 'admin@dockstash.test', 'm2@dockstash.test'] } },
        { $set: { createdAt: recent } },
      );

      const customer = await Customer.create({
        userId: member._id,
        provider: 'polar',
        providerCustomerId: 'cus_1',
        email: member.email,
      });
      await Subscription.create([
        {
          userId: member._id,
          customerId: customer._id,
          provider: 'polar',
          providerSubscriptionId: 'sub_1',
          productId: 'prod_1',
          planSlug: 'pro',
          status: 'active',
        },
        {
          userId: member._id,
          customerId: customer._id,
          provider: 'polar',
          providerSubscriptionId: 'sub_2',
          productId: 'prod_2',
          planSlug: 'business',
          status: 'canceled',
        },
        // Same plan as sub_1, different status — exercises the status
        // tie-breaker in the sorted stats output.
        {
          userId: member._id,
          customerId: customer._id,
          provider: 'polar',
          providerSubscriptionId: 'sub_3',
          productId: 'prod_1',
          planSlug: 'pro',
          status: 'canceled',
        },
      ]);

      await Project.create([
        {
          owner: member._id,
          name: 'p1',
          path: '/var/www/p1',
          repoPasswordEnc: ENC,
          snapshotCount: 3,
          totalRepoBytes: 1000,
          lastSuccessAt: new Date(),
        },
        {
          owner: member._id,
          name: 'p2',
          path: '/var/www/p2',
          repoPasswordEnc: ENC,
          snapshotCount: 2,
          totalRepoBytes: 500,
          paused: true,
        },
      ]);

      const res = await request(app)
        .get('/api/superadmin/stats')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body.users.total).toBe(4);
      expect(res.body.users.new7d).toBe(3);
      expect(res.body.users.new30d).toBe(3);
      expect(res.body.users.verifiedPct).toBe(75);
      expect(res.body.subscriptions).toEqual([
        { planSlug: 'business', status: 'canceled', count: 1 },
        { planSlug: 'pro', status: 'active', count: 1 },
        { planSlug: 'pro', status: 'canceled', count: 1 },
      ]);
      expect(res.body.projects).toEqual({ total: 2, paused: 1 });
      expect(res.body.backups).toEqual({ projectsWithSuccess: 1 });
      expect(res.body.snapshots).toEqual({ total: 5, repoBytes: 1500 });
    });
  });

  describe('GET /api/superadmin/users', () => {
    it('paginates with defaults and computes pages', async () => {
      const res = await request(app)
        .get('/api/superadmin/users')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.page).toBe(1);
      expect(res.body.pages).toBe(1);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0]).toMatchObject({
        legalHold: false,
        deletionScheduledAt: null,
        language: null,
      });
    });

    it('serializes language and a scheduled deletion timestamp when set', async () => {
      await createUser('fr-user@dockstash.test', ROLE_MEMBER, {
        language: 'fr',
        deletionScheduledAt: new Date('2026-08-01T00:00:00Z'),
      });
      const res = await request(app)
        .get('/api/superadmin/users?search=fr-user')
        .set('Authorization', superToken);
      expect(res.body.users[0]).toMatchObject({
        language: 'fr',
        deletionScheduledAt: '2026-08-01T00:00:00.000Z',
      });
    });

    it('serves later pages', async () => {
      for (let i = 0; i < 3; i += 1) {
        await createUser(`extra${i}@dockstash.test`, ROLE_MEMBER);
      }
      const res = await request(app)
        .get('/api/superadmin/users?page=2&limit=3')
        .set('Authorization', superToken);
      expect(res.body.page).toBe(2);
      expect(res.body.pages).toBe(2);
      expect(res.body.users).toHaveLength(2);
    });

    it('searches by email and name, escaping regex metacharacters', async () => {
      await createUser('needle@dockstash.test', ROLE_MEMBER, {
        profile: { firstName: 'Nadia', lastName: 'Needleworth' },
      });
      const byEmail = await request(app)
        .get('/api/superadmin/users?search=needle%40')
        .set('Authorization', superToken);
      expect(byEmail.body.total).toBe(1);

      const byName = await request(app)
        .get('/api/superadmin/users?search=nadia')
        .set('Authorization', superToken);
      expect(byName.body.total).toBe(1);

      const hostile = await request(app)
        .get(`/api/superadmin/users?search=${encodeURIComponent('a+b(')}`)
        .set('Authorization', superToken);
      expect(hostile.status).toBe(200);
      expect(hostile.body.total).toBe(0);
    });

    it('rejects an out-of-range limit', async () => {
      const res = await request(app)
        .get('/api/superadmin/users?limit=101')
        .set('Authorization', superToken);
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/superadmin/users/:id/role', () => {
    it('changes the role and records an audit entry', async () => {
      const res = await request(app)
        .patch(`/api/superadmin/users/${admin._id}/role`)
        .set('Authorization', superToken)
        .set('X-Forwarded-For', '203.0.113.5')
        .send({ role: ROLE_OWNER });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User role updated.');
      expect(res.body.user.role).toBe(ROLE_OWNER);

      const audit = await AuditLog.findOne({ action: 'superadmin.role.change' });
      expect(audit?.targetId).toBe(admin._id.toString());
      expect(audit?.ip).toBe('203.0.113.5');
      expect(audit?.metadata).toMatchObject({ role: ROLE_OWNER });
    });

    it('refuses to touch a superadmin target', async () => {
      const other = await createUser('root3@dockstash.test', ROLE_SUPERADMIN);
      const res = await request(app)
        .patch(`/api/superadmin/users/${other._id}/role`)
        .set('Authorization', superToken)
        .send({ role: ROLE_MEMBER });
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Superadmin accounts cannot be modified or deleted.');
    });

    it('rejects promoting to Superadmin at the schema layer', async () => {
      const res = await request(app)
        .patch(`/api/superadmin/users/${admin._id}/role`)
        .set('Authorization', superToken)
        .send({ role: ROLE_SUPERADMIN });
      expect(res.status).toBe(400);
    });

    it('404s an unknown user and 400s a malformed id', async () => {
      const unknown = await request(app)
        .patch('/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718/role')
        .set('Authorization', superToken)
        .send({ role: ROLE_MEMBER });
      expect(unknown.status).toBe(404);

      const malformed = await request(app)
        .patch('/api/superadmin/users/nope/role')
        .set('Authorization', superToken)
        .send({ role: ROLE_MEMBER });
      expect(malformed.status).toBe(400);
    });
  });

  describe('POST /api/superadmin/users/:id/verify', () => {
    it('force-verifies and clears the pending token', async () => {
      const pending = await createUser('pending@dockstash.test', ROLE_MEMBER, {
        emailVerified: false,
        emailVerificationToken: 'tok',
        emailVerificationExpires: new Date(Date.now() + 1000),
      });
      const res = await request(app)
        .post(`/api/superadmin/users/${pending._id}/verify`)
        .set('Authorization', superToken)
        .send();
      expect(res.status).toBe(200);
      expect(res.body.user.emailVerified).toBe(true);

      const reloaded = await User.findById(pending._id);
      expect(reloaded?.emailVerified).toBe(true);
      expect(reloaded?.emailVerificationToken).toBeUndefined();
      expect(await AuditLog.countDocuments({ action: 'superadmin.user.verify' })).toBe(1);
    });

    it('404s an unknown user', async () => {
      const res = await request(app)
        .post('/api/superadmin/users/64b2f8f0a1b2c3d4e5f60718/verify')
        .set('Authorization', superToken)
        .send();
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/superadmin/users/:id/legal-hold', () => {
    it('toggles the hold both ways with audit entries', async () => {
      const on = await request(app)
        .patch(`/api/superadmin/users/${admin._id}/legal-hold`)
        .set('Authorization', superToken)
        .send({ legalHold: true });
      expect(on.status).toBe(200);
      expect(on.body.user.legalHold).toBe(true);

      const off = await request(app)
        .patch(`/api/superadmin/users/${admin._id}/legal-hold`)
        .set('Authorization', superToken)
        .send({ legalHold: false });
      expect(off.body.user.legalHold).toBe(false);
      expect(await AuditLog.countDocuments({ action: 'superadmin.user.legalHold' })).toBe(2);
    });

    it('refuses a superadmin target', async () => {
      const res = await request(app)
        .patch(`/api/superadmin/users/${superadmin._id}/legal-hold`)
        .set('Authorization', superToken)
        .send({ legalHold: true });
      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/superadmin/users/:id', () => {
    function mockQueue(): PurgeQueue & { calls: unknown[] } {
      const calls: unknown[] = [];
      return {
        calls,
        enqueuePurge: async (input) => {
          calls.push(input);
        },
      };
    }

    it('schedules deletion via the legal service, audits, and responds 202', async () => {
      const queue = mockQueue();
      configureSuperadminController({ queue });
      const res = await request(app)
        .delete(`/api/superadmin/users/${admin._id}`)
        .set('Authorization', superToken);
      expect(res.status).toBe(202);
      expect(res.body.message).toBe('Account deletion scheduled.');
      expect(typeof res.body.purgeAt).toBe('string');
      expect(queue.calls).toHaveLength(1);

      const reloaded = await User.findById(admin._id);
      expect(reloaded?.deletionScheduledAt).not.toBeNull();
      expect(await AuditLog.countDocuments({ action: 'superadmin.user.delete' })).toBe(1);
    });

    it('passes the warning mailer through when configured', async () => {
      const sendDeletionWarning = vi.fn(async () => undefined);
      configureSuperadminController({ queue: mockQueue(), mailer: { sendDeletionWarning } });
      const res = await request(app)
        .delete(`/api/superadmin/users/${admin._id}`)
        .set('Authorization', superToken);
      expect(res.status).toBe(202);
      expect(res.body.warningEmailQueued).toBe(true);
      expect(sendDeletionWarning).toHaveBeenCalledOnce();
    });

    it('500s when the purge queue is not configured', async () => {
      const res = await request(app)
        .delete(`/api/superadmin/users/${admin._id}`)
        .set('Authorization', superToken);
      expect(res.status).toBe(500);
      expect(res.body.error.message).toBe('Deletion queue is not configured.');
    });

    it('refuses a superadmin target before touching the legal service', async () => {
      configureSuperadminController({ queue: mockQueue() });
      const res = await request(app)
        .delete(`/api/superadmin/users/${superadmin._id}`)
        .set('Authorization', superToken);
      expect(res.status).toBe(403);
      expect(res.body.error.message).toBe('Superadmin accounts cannot be modified or deleted.');
    });

    it('409s when deletion is already scheduled and 403s a legal-held target', async () => {
      configureSuperadminController({ queue: mockQueue() });
      await User.updateOne({ _id: admin._id }, { $set: { deletionScheduledAt: new Date() } });
      const conflict = await request(app)
        .delete(`/api/superadmin/users/${admin._id}`)
        .set('Authorization', superToken);
      expect(conflict.status).toBe(409);

      const held = await createUser('held@dockstash.test', ROLE_MEMBER, { legalHold: true });
      const blocked = await request(app)
        .delete(`/api/superadmin/users/${held._id}`)
        .set('Authorization', superToken);
      expect(blocked.status).toBe(403);
    });
  });

  describe('GET /api/superadmin/billing', () => {
    it('returns an empty page when no customers exist', async () => {
      const res = await request(app)
        .get('/api/superadmin/billing')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ customers: [], total: 0, page: 1, pages: 0 });
    });

    it('lists customers with their subscriptions, paginated', async () => {
      const c1 = await Customer.create({
        userId: admin._id,
        provider: 'polar',
        providerCustomerId: 'cus_a',
        email: admin.email,
      });
      const c2 = await Customer.create({
        userId: superadmin._id,
        provider: 'polar',
        providerCustomerId: 'cus_b',
        email: superadmin.email,
      });
      await Subscription.create([
        {
          userId: admin._id,
          customerId: c1._id,
          provider: 'polar',
          providerSubscriptionId: 'sub_a',
          productId: 'prod',
          planSlug: 'pro',
          status: 'active',
          currentPeriodEnd: new Date('2026-08-01T00:00:00Z'),
        },
        // No currentPeriodEnd — serializes as null.
        {
          userId: admin._id,
          customerId: c1._id,
          provider: 'polar',
          providerSubscriptionId: 'sub_b',
          productId: 'prod',
          planSlug: 'free',
          status: 'canceled',
        },
      ]);

      const res = await request(app)
        .get('/api/superadmin/billing?limit=1&page=1')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.pages).toBe(2);
      expect(res.body.customers).toHaveLength(1);

      const all = await request(app)
        .get('/api/superadmin/billing')
        .set('Authorization', superToken);
      const withSub = all.body.customers.find(
        (customer: { id: string }) => customer.id === c1._id.toString(),
      );
      expect(withSub.subscriptions).toEqual(
        expect.arrayContaining([
          {
            id: expect.any(String),
            planSlug: 'pro',
            status: 'active',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: '2026-08-01T00:00:00.000Z',
          },
          {
            id: expect.any(String),
            planSlug: 'free',
            status: 'canceled',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
          },
        ]),
      );
      expect(withSub.subscriptions).toHaveLength(2);
      const withoutSub = all.body.customers.find(
        (customer: { id: string }) => customer.id === c2._id.toString(),
      );
      expect(withoutSub.subscriptions).toEqual([]);
    });
  });

  describe('GET /api/superadmin/audit', () => {
    async function seedAudit(): Promise<void> {
      await recordAudit({
        actorUserId: admin._id.toString(),
        action: 'backup.run',
        targetType: 'project',
        targetId: 'p1',
        ip: '10.0.0.1',
      });
      await recordAudit({
        actorUserId: superadmin._id.toString(),
        action: 'superadmin.role.change',
        targetType: 'user',
        targetId: admin._id.toString(),
      });
    }

    it('lists everything unfiltered', async () => {
      await seedAudit();
      const res = await request(app)
        .get('/api/superadmin/audit')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.entries[0]).toMatchObject({
        actorUserId: expect.any(String),
        createdAt: expect.any(String),
      });
    });

    it('filters by action, actor, and date range in every combination', async () => {
      await seedAudit();
      const byAction = await request(app)
        .get('/api/superadmin/audit?action=backup.run')
        .set('Authorization', superToken);
      expect(byAction.body.total).toBe(1);
      expect(byAction.body.entries[0].action).toBe('backup.run');

      const byActor = await request(app)
        .get(`/api/superadmin/audit?actorUserId=${superadmin._id}`)
        .set('Authorization', superToken);
      expect(byActor.body.total).toBe(1);

      const past = new Date(Date.now() - 60_000).toISOString();
      const future = new Date(Date.now() + 60_000).toISOString();
      const fromOnly = await request(app)
        .get(`/api/superadmin/audit?from=${encodeURIComponent(past)}`)
        .set('Authorization', superToken);
      expect(fromOnly.body.total).toBe(2);

      const toOnly = await request(app)
        .get(`/api/superadmin/audit?to=${encodeURIComponent(past)}`)
        .set('Authorization', superToken);
      expect(toOnly.body.total).toBe(0);

      const both = await request(app)
        .get(
          `/api/superadmin/audit?from=${encodeURIComponent(past)}&to=${encodeURIComponent(future)}`,
        )
        .set('Authorization', superToken);
      expect(both.body.total).toBe(2);
    });

    it('rejects an unknown action value', async () => {
      const res = await request(app)
        .get('/api/superadmin/audit?action=not.an.action')
        .set('Authorization', superToken);
      expect(res.status).toBe(400);
    });

    it('paginates', async () => {
      await seedAudit();
      const res = await request(app)
        .get('/api/superadmin/audit?limit=1&page=2')
        .set('Authorization', superToken);
      expect(res.body.entries).toHaveLength(1);
      expect(res.body.pages).toBe(2);
    });
  });

  describe('GET /api/superadmin/system', () => {
    it('reports health, scheduler counts, and sanitized security data', async () => {
      const project = await Project.create({
        owner: admin._id,
        name: 'p1',
        path: '/var/www/p1',
        repoPasswordEnc: ENC,
      });
      await Schedule.create([
        { project: project._id, owner: admin._id, kind: 'backup', cron: '0 3 * * *' },
        {
          project: project._id,
          owner: admin._id,
          kind: 'check',
          cron: '0 4 * * *',
          enabled: false,
        },
      ]);
      await LoginChallenge.create({
        userId: superadmin._id,
        codeHash: 'hash',
        secret: 'sec',
        ip: '10.1.1.1',
        expiresAt: new Date(Date.now() + 60_000),
      });
      await recordAudit({
        actorUserId: superadmin._id.toString(),
        action: 'auth.otp.challenge',
        targetType: 'user',
        targetId: superadmin._id.toString(),
      });
      await recordAudit({
        actorUserId: admin._id.toString(),
        action: 'backup.run',
        targetType: 'project',
        targetId: 'p1',
      });

      const res = await request(app)
        .get('/api/superadmin/system')
        .set('Authorization', superToken);
      expect(res.status).toBe(200);
      expect(res.body.health.db).toBe(true);
      expect(res.body.scheduler).toEqual({ schedules: 2, enabled: 1 });

      expect(res.body.security.recentChallenges).toHaveLength(1);
      const challenge = res.body.security.recentChallenges[0];
      expect(challenge).toMatchObject({ ip: '10.1.1.1', attempts: 0, consumedAt: null });
      expect(challenge.codeHash).toBeUndefined();
      expect(challenge.secret).toBeUndefined();

      // Only auth.* security events surface here; backup.run is filtered out.
      expect(res.body.security.recentEvents).toHaveLength(1);
      expect(res.body.security.recentEvents[0].action).toBe('auth.otp.challenge');
    });

    it('serializes a consumed challenge timestamp (direct service call, injected probes)', async () => {
      await LoginChallenge.create({
        userId: superadmin._id,
        codeHash: 'hash',
        secret: 'sec',
        consumedAt: new Date('2026-07-01T00:00:00Z'),
        expiresAt: new Date(Date.now() + 60_000),
      });
      const summary = await getSystemSummary({
        probeDb: () => false,
        probeRedis: async () => false,
      });
      expect(summary.health.status).toBe('degraded');
      expect(summary.security.recentChallenges[0]?.consumedAt).toBe('2026-07-01T00:00:00.000Z');
    });
  });
});
