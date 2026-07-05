import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { Project } from '../backups/backups.model.js';
import { User } from '../users/users.model.js';
import { env } from '../../config/env.js';

// Force the in-app alert persistence to explode: both senders must swallow
// the failure — alert bookkeeping can never fail the job path.
vi.mock('../health/index.js', () => ({
  recordAlert: vi.fn(async () => {
    throw new Error('alert-store down');
  }),
}));

import { sendFailureAlert } from './alert.service.js';
import { runHeartbeatSweep } from './heartbeat.service.js';

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

async function seedProject(lastSuccessAt: Date | null) {
  const user = await User.create({
    email: `pf-${Date.now()}-${Math.floor(1e6 * Math.random())}@x.co`,
    password: 'hash',
    language: 'en',
  });
  const project = await Project.create({
    owner: user._id,
    name: 'pf-proj',
    path: '/var/www/x',
    plan: { paths: ['/var/www/x'], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
    lastSuccessAt,
  });
  return { user, project };
}

describe('alert-row persistence failure is swallowed', () => {
  it('sendFailureAlert resolves even when recordAlert throws', async () => {
    const { project } = await seedProject(null);
    await expect(
      sendFailureAlert(
        { projectId: String(project._id), kind: 'backup', error: 'e' },
        { emailAllowedFor: async () => false },
      ),
    ).resolves.toBeUndefined();
  });

  it('runHeartbeatSweep still counts the alert when recordAlert throws', async () => {
    const now = new Date('2027-02-01T00:00:00Z');
    const stale = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    await seedProject(stale);
    const res = await runHeartbeatSweep({
      now,
      thresholdHours: 24,
      emailAllowedFor: async () => false,
    });
    // Row persist failed (mocked), but the stall is still handled + deduped.
    expect(res.alertsSent).toBe(1);
  });
});
