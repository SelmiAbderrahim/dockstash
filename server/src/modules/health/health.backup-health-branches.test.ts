import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startMemoryMongo, stopMemoryMongo } from '../../shared/testing/mongo.js';
import { getProjectHealth } from './health.backup-health.service.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());

describe('getProjectHealth branch coverage', () => {
  it('404s an invalid (non-ObjectId) projectId before any DB read (existence-cloak)', async () => {
    await expect(
      getProjectHealth('not-an-objectid', '507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({ status: 404 });
  });
});
