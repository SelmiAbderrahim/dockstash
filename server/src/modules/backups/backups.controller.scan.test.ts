import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { clearCollections, startMemoryMongo, stopMemoryMongo } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import type * as BackupsScan from './backups.scan.js';

// The scan HTTP handler does not inject a scanner, so we stub the compose
// scanner at the module boundary to reach the 200 success response.
vi.mock('./backups.scan.js', async (importOriginal) => {
  const actual = await importOriginal<typeof BackupsScan>();
  return {
    ...actual,
    scanProject: vi.fn(async () => ({
      paths: ['/var/www/app'],
      databases: [{ service: 'db', type: 'postgres' as const, container: 'app_db_1', enabled: true }],
      configs: ['/etc/nginx'],
    })),
  };
});

const app = createApp();

async function seedUser(): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email: 'scan@test.com',
    password: 'irrelevant-hashed',
    profile: { firstName: 'S', lastName: 'S' },
    emailVerified: true,
  });
  const token = jwt.sign({ _id: u._id.toString(), id: u._id.toString() }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id: u._id.toString(), token };
}

describe('backups controller: POST /scan success', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('returns the scanned plan for an allowed path', async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .post('/api/backups/scan')
      .set('Authorization', `JWT ${token}`)
      .send({ path: '/var/www/app' });
    expect(res.status).toBe(200);
    expect(res.body.plan.databases).toHaveLength(1);
    expect(res.body.plan.configs).toContain('/etc/nginx');
  });
});
