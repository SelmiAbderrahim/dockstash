import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { env } from '../../config/env.js';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Schedule } from './scheduler.model.js';
import { updateSchedule } from './scheduler.service.js';

// OSS self-host mode: business ceiling → schedules feature enabled + any-cron,
// so assertScheduleAllowed passes and the `enabling` re-assert branch runs.
const __prev = env.PAYMENT_PROVIDER;
beforeAll(async () => {
  await startMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
});
afterAll(async () => {
  await stopMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prev;
});
beforeEach(() => clearCollections());

async function user() {
  return User.create({
    email: 's@example.com',
    password: 'x'.repeat(60),
    profile: { firstName: 'S', lastName: 'C' },
    emailVerified: true,
  });
}

describe('updateSchedule branch coverage', () => {
  it('404s an invalid (non-ObjectId) scheduleId (existence-cloak)', async () => {
    const u = await user();
    await expect(updateSchedule('not-an-objectid', String(u._id), {})).rejects.toMatchObject({
      status: 404,
    });
  });

  it('re-asserts the tier gate when enabling a previously-disabled schedule', async () => {
    const u = await user();
    const schedule = await Schedule.create({
      owner: u._id,
      project: new mongoose.Types.ObjectId(),
      kind: 'backup',
      cron: '0 3 * * *',
      enabled: false,
    });
    const updated = await updateSchedule(String(schedule._id), String(u._id), { enabled: true });
    expect(updated.enabled).toBe(true);
  });
});
