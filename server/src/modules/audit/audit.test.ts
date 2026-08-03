import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { User } from '../users/users.model.js';
import { AuditLog } from './audit-log.model.js';
import { extractIp, recordAudit, listAuditForUser } from './audit.service.js';

const app = createApp();

function tokenFor(user: { id: string; email: string; role?: string }): string {
  return `JWT ${jwt.sign(
    { _id: user.id, id: user.id, email: user.email, role: user.role ?? 'Member' },
    env.JWT_SECRET,
    { expiresIn: 300 },
  )}`;
}

async function seedUser(email = 'a@x.co') {
  const user = await User.create({ email, password: 'p', emailVerified: true });
  return {
    id: String(user._id),
    email,
    token: tokenFor({ id: String(user._id), email }),
  };
}

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

describe('audit.service.recordAudit', () => {
  it('appends an AuditLog with actor, action, target, ip, metadata', async () => {
    const actor = new mongoose.Types.ObjectId().toString();
    await recordAudit({
      actorUserId: actor,
      action: 'backup.run',
      targetType: 'project',
      targetId: 'p1',
      ip: '1.2.3.4',
      metadata: { foo: 'bar' },
    });
    const entries = await AuditLog.find({});
    expect(entries).toHaveLength(1);
    expect(entries[0]?.action).toBe('backup.run');
    expect(entries[0]?.ip).toBe('1.2.3.4');
    expect(entries[0]?.metadata).toMatchObject({ foo: 'bar' });
    expect((entries[0] as unknown as { createdAt: Date }).createdAt).toBeInstanceOf(Date);
  });

  it('defaults ip and metadata when omitted', async () => {
    await recordAudit({
      actorUserId: new mongoose.Types.ObjectId().toString(),
      action: 'backup.restore',
      targetType: 'project',
      targetId: 's1',
    });
    const e = await AuditLog.findOne({});
    expect(e?.ip).toBe('');
    expect(e?.metadata).toEqual({});
  });

  it('is best-effort: a persistence error is swallowed', async () => {
    // Pass an invalid enum value to trigger validation error.
    await recordAudit({
      actorUserId: new mongoose.Types.ObjectId().toString(),
      // @ts-expect-error deliberate bad action
      action: 'not.a.real.action',
      targetType: 'project',
      targetId: 'x',
    });
    // No throw, no entry appended.
    const count = await AuditLog.countDocuments({});
    expect(count).toBe(0);
  });
});

describe('audit.service.extractIp', () => {
  it('reads the first x-forwarded-for entry as string', () => {
    const ip = extractIp({
      headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' },
      ip: '3.3.3.3',
    } as unknown as import('express').Request);
    expect(ip).toBe('1.1.1.1');
  });

  it('reads the first x-forwarded-for entry as array', () => {
    const ip = extractIp({
      headers: { 'x-forwarded-for': ['1.1.1.1, 9.9.9.9'] },
      ip: '3.3.3.3',
    } as unknown as import('express').Request);
    expect(ip).toBe('1.1.1.1');
  });

  it('falls back to req.ip when no forwarded header', () => {
    const ip = extractIp({
      headers: {},
      ip: '3.3.3.3',
    } as unknown as import('express').Request);
    expect(ip).toBe('3.3.3.3');
  });

  it('returns empty string when everything is missing', () => {
    const ip = extractIp({
      headers: {},
    } as unknown as import('express').Request);
    expect(ip).toBe('');
  });
});

describe('audit routes', () => {
  it('requires auth', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(401);
  });

  it('returns caller-scoped audit entries sorted newest first', async () => {
    const alice = await seedUser('alice@x.co');
    const bob = await seedUser('bob@x.co');
    await recordAudit({
      actorUserId: alice.id,
      action: 'backup.run',
      targetType: 'project',
      targetId: 'p1',
    });
    await new Promise((r) => setTimeout(r, 5));
    await recordAudit({
      actorUserId: alice.id,
      action: 'backup.restore',
      targetType: 'project',
      targetId: 's1',
    });
    await recordAudit({
      actorUserId: bob.id,
      action: 'backup.delete',
      targetType: 'project',
      targetId: 'p2',
    });

    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', alice.token);
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries[0].action).toBe('backup.restore');
    expect(res.body.entries[1].action).toBe('backup.run');
  });

  it('respects the limit query param and rejects invalid values', async () => {
    const alice = await seedUser();
    for (let i = 0; i < 5; i++) {
      await recordAudit({
        actorUserId: alice.id,
        action: 'backup.run',
        targetType: 'project',
        targetId: `p${i}`,
      });
    }
    const r1 = await request(app)
      .get('/api/audit?limit=2')
      .set('Authorization', alice.token);
    expect(r1.body.entries).toHaveLength(2);

    const r2 = await request(app)
      .get('/api/audit?limit=abc')
      .set('Authorization', alice.token);
    expect(r2.status).toBe(200);
    expect(r2.body.entries).toHaveLength(5);

    const r3 = await request(app)
      .get('/api/audit?limit=999')
      .set('Authorization', alice.token);
    expect(r3.status).toBe(200);
    expect(r3.body.entries).toHaveLength(5);
  });

  it('listAuditForUser is directly callable', async () => {
    const alice = await seedUser();
    await recordAudit({
      actorUserId: alice.id,
      action: 'backup.run',
      targetType: 'project',
      targetId: 'p1',
    });
    const entries = await listAuditForUser(alice.id);
    expect(entries).toHaveLength(1);
  });

  // Surface #2 / S2-01: cross-account isolation for audit trails.
  it('cross-account: another user cannot read the first user’s audit trail', async () => {
    const alice = await seedUser('alice-x@x.co');
    const bob = await seedUser('bob-x@x.co');
    await recordAudit({
      actorUserId: alice.id,
      action: 'backup.run',
      targetType: 'project',
      targetId: 'alice-only',
    });
    // Bob's JWT sees ONLY bob's rows (zero here) — never alice's.
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', bob.token);
    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(0);
    // Sanity: alice still sees her own row.
    const aliceRes = await request(app)
      .get('/api/audit')
      .set('Authorization', alice.token);
    expect(aliceRes.body.entries).toHaveLength(1);
    expect(aliceRes.body.entries[0].targetId).toBe('alice-only');
  });
});
