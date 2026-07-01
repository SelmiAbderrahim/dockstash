import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/index.js';
import { encryptSecret } from '../../shared/crypto/index.js';
import { runPrune } from './scheduler.prune.service.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

async function seed(legalHold: boolean): Promise<{ userId: string; projectId: string }> {
  const user = await User.create({
    email: 'x@example.com',
    password: 'h',
    profile: { firstName: 'x', lastName: 'y' },
    role: 'Member',
    emailVerified: true,
  });
  const project = await Project.create({
    owner: user._id,
    name: 'p',
    path: '/var/www/p',
    plan: { paths: [], databases: [], configs: [] },
    repoPasswordEnc: encryptSecret('pw'),
    legalHold,
  });
  return { userId: user._id.toString(), projectId: project._id.toString() };
}

describe('runPrune legal-hold gate', () => {
  it('skips prune when the project is under legal hold', async () => {
    const { userId, projectId } = await seed(true);
    const forget = vi.fn(async () => undefined);
    const result = await runPrune(
      projectId,
      userId,
      { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
      { resticRunner: { forget } as unknown as Parameters<typeof runPrune>[3]['resticRunner'] },
    );
    expect(result.ok).toBe(true);
    expect(forget).not.toHaveBeenCalled();
  });

  it('prunes a non-held project as usual', async () => {
    const { userId, projectId } = await seed(false);
    const forget = vi.fn(async () => undefined);
    const result = await runPrune(
      projectId,
      userId,
      { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
      { resticRunner: { forget } as unknown as Parameters<typeof runPrune>[3]['resticRunner'] },
    );
    expect(result.ok).toBe(true);
    expect(forget).toHaveBeenCalledOnce();
  });
});
