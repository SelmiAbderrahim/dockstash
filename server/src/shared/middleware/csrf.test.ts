import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { issueCsrfToken, requireCsrf } from './csrf.js';
import { errorHandler } from './error-handler.js';

function buildApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/csrf', issueCsrfToken);
  app.post('/mutate', requireCsrf, (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('requireCsrf', () => {
  it('allows safe methods without a token', async () => {
    const app = buildApp();
    app.get('/read', requireCsrf, (_req, res) => {
      res.json({ ok: true });
    });
    const res = await request(app).get('/read');
    expect(res.status).toBe(200);
  });

  it('rejects a mutating request without a token', async () => {
    const res = await request(buildApp()).post('/mutate').send({});
    expect(res.status).toBe(403);
  });

  it('rejects a mutating request with mismatched cookie / header', async () => {
    const res = await request(buildApp())
      .post('/mutate')
      .set('Cookie', 'x-csrf-token=aaa')
      .set('x-csrf-token', 'bbb')
      .send({});
    expect(res.status).toBe(403);
  });

  it('accepts a matching double-submit token', async () => {
    const app = buildApp();
    const csrf = await request(app).get('/csrf');
    const token = csrf.body.csrfToken as string;
    const res = await request(app)
      .post('/mutate')
      .set('Cookie', `x-csrf-token=${token}`)
      .set('x-csrf-token', token)
      .send({});
    expect(res.status).toBe(200);
  });

  it('exempts bearer-token requests (Authorization header present)', async () => {
    const res = await request(buildApp())
      .post('/mutate')
      .set('Authorization', 'JWT some-token')
      .send({});
    expect(res.status).toBe(200);
  });
});
