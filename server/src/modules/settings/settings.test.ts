import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/users.model.js';
import { decryptSecret } from '../../shared/crypto/index.js';
import { StorageSettings } from './settings.model.js';
import {
  configureSettingsController,
  resetSettingsController,
} from './settings.controller.js';
import {
  loadTransportForUser,
  testStorage,
  upsertStorage,
  type SshProbe,
} from './settings.service.js';
import { serializeRetention, serializeStorage } from './settings.serialize.js';

const app = createApp();

const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';
const HOST_KEY_LINE = 'storage.example.com ssh-ed25519 AAAAC3Nza...';

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'S', lastName: 'T' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

const okProbe: SshProbe = {
  async connect() {
    return { fingerprint: PIN, hostKeyLine: HOST_KEY_LINE };
  },
};

const STORAGE_INPUT = {
  host: 'storage.example.com',
  user: 'backup',
  port: 22,
  privateKey: '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----',
};

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});
afterEach(() => {
  resetSettingsController();
});

describe('settings: storage CRUD', () => {
  it('requires auth on every route', async () => {
    expect((await request(app).get('/api/settings/storage')).status).toBe(401);
    expect((await request(app).put('/api/settings/storage')).status).toBe(401);
    expect((await request(app).post('/api/settings/storage/test')).status).toBe(401);
    expect((await request(app).get('/api/settings/retention')).status).toBe(401);
    expect((await request(app).put('/api/settings/retention')).status).toBe(401);
    expect((await request(app).put('/api/settings/encryption-password')).status).toBe(401);
  });

  it('returns an unconfigured default when no row exists', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .get('/api/settings/storage')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.storage).toEqual({
      host: '',
      user: '',
      port: 22,
      configured: false,
      passwordSet: false,
    });
  });

  it('saves storage config, encrypts the key, and never echoes it back', async () => {
    const { id, token } = await seedUser('a@t.com');
    const res = await request(app)
      .put('/api/settings/storage')
      .set('Authorization', `JWT ${token}`)
      .send(STORAGE_INPUT);
    expect(res.status).toBe(200);
    expect(res.body.storage).toMatchObject({
      host: 'storage.example.com',
      user: 'backup',
      port: 22,
      configured: true,
    });
    expect(JSON.stringify(res.body)).not.toContain('PRIVATE KEY');
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.sshKeyEnc?.ciphertext).toBeTruthy();
    expect(decryptSecret(row!.sshKeyEnc!)).toBe(STORAGE_INPUT.privateKey);
  });

  it('upserts on repeat save and keeps the pin when the host is unchanged', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    configureSettingsController({ probe: okProbe });
    await testStorage(id, { probe: okProbe });
    await upsertStorage(id, { ...STORAGE_INPUT, user: 'backup2' });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.user).toBe('backup2');
    expect(row?.hostKeyFingerprint).toBe(PIN);
    expect(await StorageSettings.countDocuments({ owner: id })).toBe(1);
  });

  it('drops a stale pin when the host changes', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    await testStorage(id, { probe: okProbe });
    await upsertStorage(id, { ...STORAGE_INPUT, host: 'other.example.com' });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.hostKeyFingerprint).toBe('');
    expect(row?.hostKeyLine).toBe('');
  });

  it('accepts an explicit fingerprint and custom path on save', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, {
      ...STORAGE_INPUT,
      path: '/srv/backups',
      hostKeyFingerprint: PIN,
    });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.basePath).toBe('/srv/backups');
    expect(row?.hostKeyFingerprint).toBe(PIN);
  });

  it('rejects invalid bodies at the zod layer', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .put('/api/settings/storage')
      .set('Authorization', `JWT ${token}`)
      .send({ host: '', user: 'u', port: 22, privateKey: 'k' });
    expect(res.status).toBe(400);
  });
});

describe('settings: connection test + pinning', () => {
  it('400s when storage is not configured', async () => {
    const { token } = await seedUser('a@t.com');
    configureSettingsController({ probe: okProbe });
    const res = await request(app)
      .post('/api/settings/storage/test')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(400);
  });

  it('pins the host key on first successful test', async () => {
    const { id, token } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    configureSettingsController({ probe: okProbe });
    const res = await request(app)
      .post('/api/settings/storage/test')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.hostKeyFingerprint).toBe(PIN);
    expect(row?.hostKeyLine).toBe(HOST_KEY_LINE);
    expect(row?.lastTestOk).toBe(true);
    expect(row?.lastTestAt).toBeInstanceOf(Date);
  });

  it('rejects a changed host key after pinning (no auto-accept)', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    await testStorage(id, { probe: okProbe });
    const evilProbe: SshProbe = {
      async connect() {
        return { fingerprint: 'sha256:DIFFERENT', hostKeyLine: 'evil line' };
      },
    };
    await expect(testStorage(id, { probe: evilProbe })).rejects.toMatchObject({
      status: 500,
    });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.hostKeyFingerprint).toBe(PIN);
    expect(row?.lastTestOk).toBe(false);
  });

  it('records a failed probe as a 400 with lastTestOk=false', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    const downProbe: SshProbe = {
      async connect() {
        throw new Error('connection refused');
      },
    };
    await expect(testStorage(id, { probe: downProbe })).rejects.toMatchObject({
      status: 400,
    });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.lastTestOk).toBe(false);
  });

  it('stringifies non-Error probe failures', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    const weirdProbe: SshProbe = {
      async connect() {
        throw 'plain-string failure';
      },
    };
    await expect(testStorage(id, { probe: weirdProbe })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('honors an injected clock', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    const now = new Date('2027-03-01T00:00:00Z');
    const row = await testStorage(id, { probe: okProbe, now });
    expect(row.lastTestAt?.toISOString()).toBe('2027-03-01T00:00:00.000Z');
  });

  it('503s via the fallback probe when boot never configured one', async () => {
    const { id, token } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    // no configureSettingsController call — ensureConfigured installs a
    // throwing fallback probe
    const res = await request(app)
      .post('/api/settings/storage/test')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('connection test failed');
  });
});

describe('settings: retention', () => {
  it('returns defaults when no row exists', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .get('/api/settings/retention')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.retention).toEqual({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 });
  });

  it('saves and rereads a retention policy', async () => {
    const { token } = await seedUser('a@t.com');
    const put = await request(app)
      .put('/api/settings/retention')
      .set('Authorization', `JWT ${token}`)
      .send({ keepDaily: 14, keepWeekly: 8, keepMonthly: 12 });
    expect(put.status).toBe(200);
    expect(put.body.retention).toEqual({ keepDaily: 14, keepWeekly: 8, keepMonthly: 12 });
    const get = await request(app)
      .get('/api/settings/retention')
      .set('Authorization', `JWT ${token}`);
    expect(get.body.retention).toEqual({ keepDaily: 14, keepWeekly: 8, keepMonthly: 12 });
  });

  it('rejects negative values at the zod layer', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .put('/api/settings/retention')
      .set('Authorization', `JWT ${token}`)
      .send({ keepDaily: -1, keepWeekly: 4, keepMonthly: 6 });
    expect(res.status).toBe(400);
  });
});

describe('settings: encryption password', () => {
  it('stores the default repo password encrypted', async () => {
    const { id, token } = await seedUser('a@t.com');
    const res = await request(app)
      .put('/api/settings/encryption-password')
      .set('Authorization', `JWT ${token}`)
      .send({ password: 'correct-horse-battery' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const row = await StorageSettings.findOne({ owner: id });
    expect(row?.defaultRepoPasswordEnc?.ciphertext).toBeTruthy();
    expect(decryptSecret(row!.defaultRepoPasswordEnc!)).toBe('correct-horse-battery');
  });

  it('reflects passwordSet in the serialized storage before and after setting it', async () => {
    const { token } = await seedUser('a@t.com');
    const before = await request(app)
      .get('/api/settings/storage')
      .set('Authorization', `JWT ${token}`);
    expect(before.body.storage.passwordSet).toBe(false);
    await request(app)
      .put('/api/settings/encryption-password')
      .set('Authorization', `JWT ${token}`)
      .send({ password: 'correct-horse-battery' });
    const after = await request(app)
      .get('/api/settings/storage')
      .set('Authorization', `JWT ${token}`);
    expect(after.body.storage.passwordSet).toBe(true);
  });

  it('rejects a short password', async () => {
    const { token } = await seedUser('a@t.com');
    const res = await request(app)
      .put('/api/settings/encryption-password')
      .set('Authorization', `JWT ${token}`)
      .send({ password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('settings: loadTransportForUser', () => {
  it('throws 400 when unconfigured', async () => {
    const { id } = await seedUser('a@t.com');
    await expect(loadTransportForUser(id)).rejects.toMatchObject({ status: 400 });
  });

  it('throws 400 when configured but never pinned', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    await expect(loadTransportForUser(id)).rejects.toMatchObject({ status: 400 });
  });

  it('builds a pinned transport with port and basePath applied', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT, port: 2222, path: '/srv/backups' });
    await testStorage(id, { probe: okProbe });
    const { transport, settings } = await loadTransportForUser(id);
    expect(settings.owner.toString()).toBe(id);
    expect(transport.pinnedFingerprint).toBe(PIN);
    expect(transport.repoUrl({ id: 'p1', owner: id })).toBe(
      `sftp://backup@storage.example.com:2222//srv/backups/${id}/p1`,
    );
  });

  it('uses the legacy sftp: form on the default port', async () => {
    const { id } = await seedUser('a@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    await testStorage(id, { probe: okProbe });
    const { transport } = await loadTransportForUser(id);
    expect(transport.repoUrl({ id: 'p1', owner: id })).toBe(
      `sftp:backup@storage.example.com:/backups/${id}/p1`,
    );
  });
});

describe('settings: serializers', () => {
  it('serializeStorage exposes the pinned fingerprint once present', async () => {
    const { id, token } = await seedUser('fp@t.com');
    await upsertStorage(id, { ...STORAGE_INPUT });
    await testStorage(id, { probe: okProbe });
    const res = await request(app)
      .get('/api/settings/storage')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.storage.keyFingerprint).toBe(PIN);
  });

  it('serializeStorage(null) and serializeRetention(null) return defaults', () => {
    expect(serializeStorage(null)).toEqual({
      host: '',
      user: '',
      port: 22,
      configured: false,
      passwordSet: false,
    });
    expect(serializeRetention(null)).toEqual({
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 6,
    });
  });
});
