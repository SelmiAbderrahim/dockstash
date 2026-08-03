import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Schedule } from './scheduler.model.js';
import { updateSchedule } from './scheduler.service.js';

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
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
