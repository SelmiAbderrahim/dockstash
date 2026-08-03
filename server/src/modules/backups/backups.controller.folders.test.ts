import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import type * as BackupsDiscover from './backups.discover.js';

// The listFolders HTTP handler does not inject its discoverer, so we stub the
// module boundary to reach the 200 success response independently of whether
// `/var/www` exists in the test env (it does not in a plain node:20-bookworm
// container). Kept in its own file to isolate the vi.mock — sibling tests
// exercise the real discoverer directly.
vi.mock('./backups.discover.js', async (importOriginal) => {
  const actual = await importOriginal<typeof BackupsDiscover>();
  return {
    ...actual,
    discoverFolders: vi.fn(async () => [
      { name: 'demo', path: '/var/www/demo', hasCompose: true, composeFile: 'docker-compose.yml' },
    ]),
  };
});

const app = createApp();

async function seedUser(): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email: 'folders@test.com',
    password: 'irrelevant-hashed',
    profile: { firstName: 'F', lastName: 'F' },
    emailVerified: true,
  });
  const token = jwt.sign({ _id: u._id.toString(), id: u._id.toString() }, env.JWT_SECRET, {
    expiresIn: '1h',
  });
  return { id: u._id.toString(), token };
}

describe('backups controller: GET /discover/folders success', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('returns a 200 folders array (mocks the discoverer)', async () => {
    const { token } = await seedUser();
    const res = await request(app)
      .get('/api/backups/discover/folders')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.folders).toHaveLength(1);
    expect(res.body.folders[0].name).toBe('demo');
  });
});
