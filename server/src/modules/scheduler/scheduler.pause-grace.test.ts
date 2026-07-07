import { describe, expect, it, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { env } from '../../config/env.js';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/index.js';
import { Customer } from '../billing/customer.model.js';
import { Subscription } from '../billing/subscription.model.js';
import { GRACE_WINDOW_MS } from '../billing/lifecycle.service.js';
import { encryptSecret } from '../../shared/crypto/index.js';
import { runPrune, type RunPruneDeps } from './scheduler.prune.service.js';

const __prevProvider = env.PAYMENT_PROVIDER;

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevProvider;
});
beforeEach(() => clearCollections());
afterEach(() => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevProvider;
});

async function seedUser() {
  return User.create({
    email: 'p@example.com',
    password: 'x'.repeat(60),
    profile: { firstName: 'x', lastName: 'y' },
    emailVerified: true,
  });
}

async function seedProject(userId: string, paused: boolean) {
  return Project.create({
    owner: userId,
    name: 'p',
    path: '/var/www/p',
    plan: { paths: [], databases: [], configs: [] },
    repoPasswordEnc: encryptSecret('pw'),
    paused,
  });
}

function forgetSpy(): RunPruneDeps['resticRunner'] {
  return { forget: vi.fn(async () => undefined) } as unknown as RunPruneDeps['resticRunner'];
}

const RETENTION = { keepDaily: 30, keepWeekly: 8, keepMonthly: 12 };

describe('runPrune — F1 paused skip', () => {
  it('skips prune (no forget) when the project is paused; backups are retained', async () => {
    const u = await seedUser();
    const p = await seedProject(String(u._id), true);
    const runner = forgetSpy();
    const res = await runPrune(String(p._id), String(u._id), RETENTION, { resticRunner: runner });
    expect(res.ok).toBe(true);
    expect((runner as unknown as { forget: ReturnType<typeof vi.fn> }).forget).not.toHaveBeenCalled();
  });
});

describe('runPrune — F1 retention grandfather window', () => {
  async function seedGraceSub(userId: string, retentionGraceUntil: Date | null) {
    const c = await Customer.create({
      userId,
      provider: 'polar',
      providerCustomerId: 'pc',
      email: 'c@example.com',
    });
    await Subscription.create({
      userId,
      customerId: c._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_g',
      productId: 'prod_pro',
      planSlug: 'free',
      status: 'canceled',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      retentionGraceUntil,
    });
  }

  it('applies the stored (wider) policy UNCLAMPED during the grace window', async () => {
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    const u = await seedUser();
    const p = await seedProject(String(u._id), false);
    await seedGraceSub(String(u._id), new Date(Date.now() + GRACE_WINDOW_MS));
    const runner = forgetSpy();
    const clampPolicy = vi.fn(async () => ({ keepDaily: 7, keepWeekly: 1, keepMonthly: 1 }));
    const res = await runPrune(String(p._id), String(u._id), RETENTION, {
      resticRunner: runner,
      clampPolicy,
    });
    expect(res.ok).toBe(true);
    // The clamp is skipped entirely inside the window.
    expect(clampPolicy).not.toHaveBeenCalled();
    const args = (runner as unknown as { forget: ReturnType<typeof vi.fn> }).forget.mock.calls[0]?.[0];
    // 30 daily keeps survive (unclamped).
    expect(args).toContain('30');
  });

  it('clamps to the tier ceiling once the window has elapsed', async () => {
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
    const u = await seedUser();
    const p = await seedProject(String(u._id), false);
    await seedGraceSub(String(u._id), new Date(Date.now() - 1000));
    const runner = forgetSpy();
    const clampPolicy = vi.fn(async () => ({ keepDaily: 7, keepWeekly: 1, keepMonthly: 1 }));
    const res = await runPrune(String(p._id), String(u._id), RETENTION, {
      resticRunner: runner,
      clampPolicy,
    });
    expect(res.ok).toBe(true);
    expect(clampPolicy).toHaveBeenCalledOnce();
    const args = (runner as unknown as { forget: ReturnType<typeof vi.fn> }).forget.mock.calls[0]?.[0];
    expect(args).toContain('7');
  });
});
