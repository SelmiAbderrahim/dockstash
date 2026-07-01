import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/index.js';
import { exportUserData, scheduleAccountDeletion, purgeAccount } from './legal.service.js';
import { encryptSecret } from '../../shared/crypto/index.js';

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

    it('respects legal hold on a project (keeps it, purges the rest)', async () => {
      const { userId, projectId } = await seedUserAndProjects();
      await User.updateOne({ _id: userId }, { deletionScheduledAt: new Date(Date.now() - 1000) });
      await Project.updateOne({ _id: projectId }, { legalHold: true });
      const purger = { purgeRepo: vi.fn(async () => undefined) };
      const res = await purgeAccount(userId, { resticRepoPurger: purger });
      expect(res.ok).toBe(true);
      // Held project skipped — purger never called.
      expect(purger.purgeRepo).not.toHaveBeenCalled();
      expect(await Project.findById(projectId)).not.toBeNull();
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
  });
});
