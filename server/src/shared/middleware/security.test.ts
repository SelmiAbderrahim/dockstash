import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp } from '../../app.js';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../testing/mongo.js';
import { createAuthRateLimiter } from './rate-limit.js';
import {
  CSP_INLINE_THEME_HASH,
  securityHeaders,
} from './security-headers.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

describe('security middleware wiring', () => {
  const app = createApp();

  it('sets helmet security headers on responses', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-dns-prefetch-control']).toBeDefined();
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('emits Content-Security-Policy on API responses (SEC-11)', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(res.headers['content-security-policy-report-only']).toBeUndefined();
    // Every directive from the starter policy present, in the same order the
    // middleware emits them.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain(
      `script-src 'self' '${CSP_INLINE_THEME_HASH}'`,
    );
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("font-src 'self' data:");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it('applies CORS locked to CLIENT_URL (no wildcard)', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://evil.example.com');
    expect(res.headers['access-control-allow-origin']).not.toBe('*');
    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });

  it('rate-limits after the configured N attempts (scoped bucket)', async () => {
    const limited = express();
    limited.use(securityHeaders);
    limited.use(createAuthRateLimiter({ max: 3, windowMs: 60_000 }));
    limited.post('/login', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(limited).post('/login').send({});
      statuses.push(res.status);
    }
    expect(statuses.some((s) => s === 429)).toBe(true);
  });

  it('issues a CSRF token cookie on GET /api/security/csrf-token', async () => {
    const res = await request(app).get('/api/security/csrf-token');
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined;
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    expect(cookies.some((c: string) => c.toLowerCase().startsWith('x-csrf-token='))).toBe(true);
  });
});
