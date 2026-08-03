import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
import { createProject } from '../backups/backups.service.js';
import { MemoryQueue } from './scheduler.queue.memory.js';
import {
  configureSchedulerController,
  ensureConfigured,
  resetSchedulerController,
} from './scheduler.controller.js';
import type { SchedulerQueue } from './scheduler.boundaries.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'S', lastName: 'U' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(userId: string): Promise<string> {
  const p = await createProject(userId, {
    name: 'p',
    path: '/var/www/p',
    repoPassword: 'password1',
  });
  return p._id.toString();
}

describe('scheduler.controller wiring', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(async () => {
    resetSchedulerController();
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
    resetSchedulerController();
  });

  it('enqueue returns 500 when the controller is not configured', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    // deps is null (reset in beforeEach) → requireDeps() throws internal.
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'backup' });
    expect(res.status).toBe(500);
  });

  it('ensureConfigured is a no-op once deps already exist', () => {
    const queue: SchedulerQueue = {
      async add() {
        throw new Error('unused');
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    configureSchedulerController({ queue });
    // Should early-return without replacing the configured deps.
    expect(() => ensureConfigured()).not.toThrow();
    expect(() => ensureConfigured({ queue })).not.toThrow();
  });

  it('ensureConfigured installs a fallback whose queue.add throws 500', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    // No deps configured → ensureConfigured builds the internal fallback queue.
    ensureConfigured();
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'backup' });
    expect(res.status).toBe(500);
  });

  it('ensureConfigured accepts an explicit fallback queue', async () => {
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const kinds: string[] = [];
    const queue: SchedulerQueue = {
      async add(data) {
        kinds.push(data.kind);
        return { id: 'x', data, attempts: 0 };
      },
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
    };
    ensureConfigured({ queue });
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'backup' });
    expect(res.status).toBe(202);
    expect(kinds).toEqual(['backup']);
  });

  it('enqueue of a drill maps to the restore audit action', async () => {
    const queue = new MemoryQueue();
    queue.setProcessor(async () => {});
    configureSchedulerController({ queue });
    const a = await seedUser('a@t.com');
    const projectId = await seedProject(a.id);
    const res = await request(app)
      .post('/api/scheduler/enqueue')
      .set('Authorization', `JWT ${a.token}`)
      .send({ projectId, kind: 'drill' });
    expect(res.status).toBe(202);
    expect(res.body.job.kind).toBe('drill');
    await queue.close();
  });
});
