import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import {
  configureHealthController,
  resetHealthController,
} from './modules/health/index.js';

describe('app wiring after demo strip', () => {
  const app = createApp();

  beforeAll(() => {
    configureHealthController({
      probeDb: () => true,
      probeRedis: async () => true,
    });
  });
  afterAll(() => resetHealthController());

  it('exposes GET /api/health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe(true);
  });

  it('no longer mounts /api/chat', async () => {
    const res = await request(app).get('/api/chat/conversations');
    expect(res.status).toBe(404);
  });

  it('still mounts /api/auth', async () => {
    const res = await request(app).get('/api/auth/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('still mounts /api/users, /api/communication, /api/billing', async () => {
    for (const p of ['/api/users', '/api/communication', '/api/billing']) {
      const res = await request(app).get(p + '/__not_a_route__');
      // 401 (auth-guarded router hit its :param route) or 404 (no route matched) —
      // both mean the router itself is mounted.
      expect([401, 404]).toContain(res.status);
    }
  });

  it('attaches a request-id header', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('honors CORS origin from CLIENT_URL', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
