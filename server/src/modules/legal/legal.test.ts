import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/index.js';
import type { NextFunction, Request, Response } from 'express';
import { exportUserData, scheduleAccountDeletion, purgeAccount } from './legal.service.js';
import {
  configureLegalController,
  resetLegalController,
  exportMyData,
  deleteMyAccount,
} from './legal.controller.js';
import { encryptSecret } from '../../shared/crypto/index.js';

/** Drives an asyncHandler-wrapped controller and resolves with the value passed to next(). */
function invokeHandler(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
): Promise<unknown> {
  return new Promise((resolve) => {
    handler(req as Request, {} as unknown as Response, ((err?: unknown) => resolve(err)) as NextFunction);
  });
}

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

async function seedUserAndProjects(): Promise<{ userId: string; projectId: string }> {
  const user = await User.create({
    email: 'gdpr@example.com',
    password: 'hash',
    profile: { firstName: 'Alice', lastName: 'A' },
    role: 'Member',
  });
  const project = await Project.create({
    owner: user._id,
    name: 'app',
    path: '/var/www/app',
    plan: { paths: ['/var/www/app'], databases: [], configs: [] },
    repoPasswordEnc: encryptSecret('restic-pw'),
  });
  return { userId: user._id.toString(), projectId: project._id.toString() };
}

describe('legal / GDPR', () => {
  describe('exportUserData', () => {
    it('returns the user account + projects with secrets as ciphertext only', async () => {
      const { userId } = await seedUserAndProjects();
      const data = await exportUserData(userId);
      expect(data.account.email).toBe('gdpr@example.com');
      expect(data.projects).toHaveLength(1);
      // The exported project MUST carry the AES-GCM envelope, NOT the plaintext
      // restic password.
      const firstProject = data.projects[0];
      if (!firstProject) throw new Error('missing project');
      const secret = firstProject.repoPasswordEnc as {
        ciphertext: string;
        keyVersion: number;
      };
      expect(secret.keyVersion).toBe(1);
      expect(secret.ciphertext).toBeTypeOf('string');
      const raw = JSON.stringify(data);
      expect(raw).not.toContain('restic-pw');
    });

    it('404s a missing user', async () => {
      await expect(exportUserData('507f1f77bcf86cd799439011')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('exportUserData branch coverage', () => {
    it('handles a user with no profile / language and a project with status fields set', async () => {
      const user = await User.create({ email: 'bare@example.com', password: 'hash' });
      await Project.create({
        owner: user._id,
        name: 'withstatus',
        path: '/var/www/withstatus',
        plan: { paths: ['/var/www/withstatus'], databases: [], configs: [] },
        repoPasswordEnc: encryptSecret('pw'),
        lastStatus: 'success',
        lastRunAt: new Date('2026-05-05T00:00:00Z'),
      });
      const data = await exportUserData(user._id.toString());
      expect(data.account.firstName).toBe('');
      expect(data.account.lastName).toBe('');
      expect(data.account.language).toBeNull();
      expect(data.projects[0]?.lastStatus).toBe('success');
      expect(data.projects[0]?.lastRunAt).toBe('2026-05-05T00:00:00.000Z');
    });

    it('serializes a user language and account timestamps when present', async () => {
      const user = await User.create({
        email: 'lang@example.com',
        password: 'hash',
        profile: { firstName: 'Li', lastName: 'L' },
        language: 'fr',
      });
      const data = await exportUserData(user._id.toString());
      expect(data.account.language).toBe('fr');
      expect(data.account.createdAt).toBeTypeOf('string');
    });
  });

  describe('scheduleAccountDeletion', () => {
    it('marks the user, enqueues a purge, and sends the warning email', async () => {
      const { userId } = await seedUserAndProjects();
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      const mailer = { sendDeletionWarning: vi.fn(async () => undefined) };
      const result = await scheduleAccountDeletion(userId, {
        graceHours: 24,
        queue,
        mailer,
        now: () => new Date('2026-01-01T00:00:00Z'),
      });
      expect(result.purgeAt).toBe('2026-01-02T00:00:00.000Z');
      expect(result.warningEmailQueued).toBe(true);
      expect(queue.enqueuePurge).toHaveBeenCalledOnce();
      expect(mailer.sendDeletionWarning).toHaveBeenCalledOnce();
      const user = await User.findById(userId);
      expect(user?.deletionScheduledAt).toBeInstanceOf(Date);
      expect(user?.deletionWarningSentAt).toBeInstanceOf(Date);
    });

    it('blocks when a legal hold is active', async () => {
      const { userId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { legalHold: true });
      const queue = { enqueuePurge: vi.fn() };
      await expect(
        scheduleAccountDeletion(userId, { graceHours: 24, queue }),
      ).rejects.toMatchObject({ status: 403 });
      expect(queue.enqueuePurge).not.toHaveBeenCalled();
    });

    it('refuses to schedule twice', async () => {
      const { userId } = await seedUserAndProjects();
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      await scheduleAccountDeletion(userId, { graceHours: 24, queue });
      await expect(
        scheduleAccountDeletion(userId, { graceHours: 24, queue }),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('404s a missing user', async () => {
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      await expect(
        scheduleAccountDeletion('507f1f77bcf86cd799439011', { graceHours: 24, queue }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('keeps the schedule intact when the warning email fails (non-fatal)', async () => {
      // User with no profile → also exercises the `firstName ?? ''` fallback.
      const user = await User.create({ email: 'nomail@example.com', password: 'hash' });
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      const mailer = {
        sendDeletionWarning: vi.fn(async () => {
          throw new Error('smtp down');
        }),
      };
      const result = await scheduleAccountDeletion(user._id.toString(), {
        graceHours: 24,
        queue,
        mailer,
      });
      expect(result.warningEmailQueued).toBe(false);
      expect(queue.enqueuePurge).toHaveBeenCalledOnce();
      const reloaded = await User.findById(user._id);
      expect(reloaded?.deletionScheduledAt).toBeInstanceOf(Date);
      // Warning stamp not written because the send failed.
      expect(reloaded?.deletionWarningSentAt ?? null).toBeNull();
    });

    it('prefers an explicit locale over the user language for the warning', async () => {
      const user = await User.create({
        email: 'loc@example.com',
        password: 'hash',
        profile: { firstName: 'Lo', lastName: 'C' },
        language: 'de',
      });
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      const mailer = { sendDeletionWarning: vi.fn(async () => undefined) };
      await scheduleAccountDeletion(user._id.toString(), {
        graceHours: 24,
        queue,
        mailer,
        locale: 'es',
      });
      expect(mailer.sendDeletionWarning).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'es', firstName: 'Lo' }),
      );
    });

    it('falls back to the user language for the warning locale when none is passed', async () => {
      const user = await User.create({
        email: 'loc2@example.com',
        password: 'hash',
        profile: { firstName: 'Lo', lastName: 'C' },
        language: 'ru',
      });
      const queue = { enqueuePurge: vi.fn(async () => undefined) };
      const mailer = { sendDeletionWarning: vi.fn(async () => undefined) };
      await scheduleAccountDeletion(user._id.toString(), {
        graceHours: 24,
        queue,
        mailer,
      });
      expect(mailer.sendDeletionWarning).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'ru' }),
      );
    });
  });

  describe('purgeAccount', () => {
    it('purges due accounts and removes non-held projects', async () => {
      const { userId, projectId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { deletionScheduledAt: new Date(Date.now() - 1000) });
      const purger = { purgeRepo: vi.fn(async () => undefined) };
      const res = await purgeAccount(userId, { resticRepoPurger: purger });
      expect(res.ok).toBe(true);
      expect(res.projectsPurged).toBe(1);
      expect(purger.purgeRepo).toHaveBeenCalledWith({
        id: projectId,
        owner: userId,
        path: '/var/www/app',
      });
      expect(await Project.findById(projectId)).toBeNull();
      expect(await User.findById(userId)).toBeNull();
    });

    it('respects legal hold on a user', async () => {
      const { userId } = await seedUserAndProjects();
      await User.updateOne(
        { _id: userId },
        { legalHold: true, deletionScheduledAt: new Date(Date.now() - 1000) },
      );
      const res = await purgeAccount(userId);
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('legalHold');
    });

    it('defers the account purge when a project is held — keeps BOTH rows (F8 no orphan)', async () => {
      const { userId, projectId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { deletionScheduledAt: new Date(Date.now() - 1000) });
      await Project.updateOne({ _id: projectId }, { legalHold: true });
      const purger = { purgeRepo: vi.fn(async () => undefined) };
      const res = await purgeAccount(userId, { resticRepoPurger: purger });
      // A held project blocks the account purge — deleting the User anyway would
      // orphan that project. The purge is deferred, not partially applied.
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('legalHold');
      expect(res.projectsPurged).toBe(0);
      expect(purger.purgeRepo).not.toHaveBeenCalled();
      // Held project AND user survive; the deletion schedule stays so a later
      // sweep retries once the hold lifts.
      expect(await Project.findById(projectId)).not.toBeNull();
      const user = await User.findById(userId);
      expect(user).not.toBeNull();
      expect(user?.deletionScheduledAt).toBeInstanceOf(Date);
    });

    it('purges non-held projects but still defers when one is held (F8)', async () => {
      const { userId, projectId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { deletionScheduledAt: new Date(Date.now() - 1000) });
      await Project.updateOne({ _id: projectId }, { legalHold: true });
      const free = await Project.create({
        owner: userId,
        name: 'free',
        path: '/var/www/free',
        plan: { paths: [], databases: [], configs: [] },
        repoPasswordEnc: encryptSecret('pw2'),
      });
      const purger = { purgeRepo: vi.fn(async () => undefined) };
      const res = await purgeAccount(userId, { resticRepoPurger: purger });
      expect(res.ok).toBe(false);
      expect(res.reason).toBe('legalHold');
      expect(res.projectsPurged).toBe(1);
      // Non-held project purged; held project + user kept.
      expect(await Project.findById(free._id)).toBeNull();
      expect(await Project.findById(projectId)).not.toBeNull();
      expect(await User.findById(userId)).not.toBeNull();
    });

    it('returns notDue when the grace window has not elapsed', async () => {
      const { userId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { deletionScheduledAt: new Date(Date.now() + 60_000) });
      const res = await purgeAccount(userId);
      expect(res.reason).toBe('notDue');
    });

    it('returns notScheduled when no deletion was requested', async () => {
      const { userId } = await seedUserAndProjects();
      const res = await purgeAccount(userId);
      expect(res.reason).toBe('notScheduled');
    });

    it('returns notFound for a missing user', async () => {
      const res = await purgeAccount('507f1f77bcf86cd799439011');
      expect(res.reason).toBe('notFound');
    });

    it('surfaces a 500 when the restic repo purge fails', async () => {
      const { userId } = await seedUserAndProjects();
      await User.updateOne(
        { _id: userId },
        { deletionScheduledAt: new Date(Date.now() - 1000) },
      );
      const purger = {
        purgeRepo: vi.fn(async () => {
          throw new Error('restic forget failed');
        }),
      };
      await expect(
        purgeAccount(userId, {
          resticRepoPurger: purger,
          now: () => new Date(),
        }),
      ).rejects.toMatchObject({ status: 500 });
    });

    it('surfaces a 500 when the restic repo purge throws a non-Error', async () => {
      const { userId } = await seedUserAndProjects();
      await User.updateOne(
        { _id: userId },
        { deletionScheduledAt: new Date(Date.now() - 1000) },
      );
      const purger = {
        purgeRepo: vi.fn(async () => {
          throw 'restic forget string failure';
        }),
      };
      await expect(
        purgeAccount(userId, { resticRepoPurger: purger }),
      ).rejects.toMatchObject({ status: 500 });
    });

    it('purges without a restic purger configured', async () => {
      const { userId, projectId } = await seedUserAndProjects();
      await User.updateOne(
        { _id: userId },
        { deletionScheduledAt: new Date(Date.now() - 1000) },
      );
      // No resticRepoPurger → exercises the `if (deps.resticRepoPurger)` false path.
      const res = await purgeAccount(userId);
      expect(res.ok).toBe(true);
      expect(res.projectsPurged).toBe(1);
      expect(await Project.findById(projectId)).toBeNull();
    });
  });

  describe('HTTP controller (/api/legal)', () => {
    const app = createApp();
    afterEachController();

    function token(userId: string): string {
      return `JWT ${jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' })}`;
    }

    it('POST /export returns the user data envelope', async () => {
      const { userId } = await seedUserAndProjects();
      const res = await request(app)
        .post('/api/legal/export')
        .set('Authorization', token(userId));
      expect(res.status).toBe(200);
      expect(res.body.account.email).toBe('gdpr@example.com');
      expect(res.body.projects).toHaveLength(1);
    });

    it('rate-limits repeated /export calls (429 once the bucket is spent)', async () => {
      // Fresh app → isolated limiter bucket, so this cannot leak into the
      // shared `app` used by the other cases.
      const limitedApp = createApp();
      const { userId } = await seedUserAndProjects();
      let sawLimited = false;
      for (let i = 0; i < 11; i++) {
        const res = await request(limitedApp)
          .post('/api/legal/export')
          .set('Authorization', token(userId));
        if (res.status === 429) sawLimited = true;
      }
      expect(sawLimited).toBe(true);
    });

    it('POST /delete-account returns 500 when the purge queue is not configured', async () => {
      const { userId } = await seedUserAndProjects();
      resetLegalController();
      const res = await request(app)
        .post('/api/legal/delete-account')
        .set('Authorization', token(userId));
      expect(res.status).toBe(500);
    });

    it('POST /delete-account schedules deletion (202) once configured', async () => {
      const { userId } = await seedUserAndProjects();
      const enqueued: unknown[] = [];
      configureLegalController({
        queue: { enqueuePurge: async (payload) => void enqueued.push(payload) },
      });
      const res = await request(app)
        .post('/api/legal/delete-account')
        .set('Authorization', token(userId));
      expect(res.status).toBe(202);
      expect(enqueued).toHaveLength(1);
    });
  });

  describe('controller guard branches (no req.user / no translator)', () => {
    beforeEach(() => resetLegalController());

    const translator = ((k: string) => `T:${k}`) as unknown as Request['t'];

    it('exportMyData throws 401 when unauthenticated and no translator is present', async () => {
      const err = await invokeHandler(exportMyData, {});
      expect(err).toMatchObject({ status: 401 });
    });

    it('exportMyData translates the 401 message when unauthenticated and a translator is present', async () => {
      const err = await invokeHandler(exportMyData, { t: translator });
      expect(err).toMatchObject({ status: 401, message: 'T:errors.unauthorized' });
    });

    it('deleteMyAccount throws 401 when unauthenticated and no translator is present', async () => {
      const err = await invokeHandler(deleteMyAccount, {});
      expect(err).toMatchObject({ status: 401 });
    });

    it('deleteMyAccount translates the 401 message when unauthenticated and a translator is present', async () => {
      const err = await invokeHandler(deleteMyAccount, { t: translator });
      expect(err).toMatchObject({ status: 401, message: 'T:errors.unauthorized' });
    });

    it('deleteMyAccount falls back to the literal message when the queue is unconfigured and no translator is present', async () => {
      resetLegalController();
      const err = await invokeHandler(deleteMyAccount, {
        user: { id: '507f1f77bcf86cd799439011' } as Express.User,
      });
      expect(err).toMatchObject({
        status: 500,
        message: 'Deletion queue is not configured.',
      });
    });
  });
});

function afterEachController(): void {
  // Reset injected deps after each controller test so leakage can't mask a
  // missing-configuration path in another test.
  beforeEach(() => resetLegalController());
}
