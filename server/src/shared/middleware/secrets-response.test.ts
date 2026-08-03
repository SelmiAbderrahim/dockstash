import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../testing/mongo.js';
import { User } from '../../modules/users/users.model.js';
import { StorageSettings } from '../../modules/settings/settings.model.js';
import { createProject } from '../../modules/backups/backups.service.js';
import { encryptSecret } from '../crypto/index.js';

/**
 * Surface #7 STEP 4 runtime proof: no owner-facing GET endpoint returns a
 * plaintext secret. Complements the schema-level static guard in
 * `secrets-meta.test.ts`. A regression that adds a serializer field for
 * `password`, `repoPassword`, `sshKey`, or the envelope's ciphertext fails
 * loudly here.
 */

const app = createApp();
const PROJECT_PW = 'HORSE-BATTERY-STAPLE';
const SSH_KEY = '-----BEGIN OPENSSH-PRIVATE-KEY-----\nAAAA\n-----END OPENSSH-PRIVATE-KEY-----';
const USER_PW_HASH = 'x'.repeat(60);

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<string> {
  const u = await User.create({
    email,
    password: USER_PW_HASH,
    profile: { firstName: 'A', lastName: 'B' },
    emailVerified: true,
  });
  return u._id.toString();
}

describe('surface #7 — no plaintext secret in owner-facing responses', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('GET /api/users/:id never returns the password field', async () => {
    const uid = await seedUser('u@t.com');
    const res = await request(app)
      .get(`/api/users/${uid}`)
      .set('Authorization', `JWT ${signToken(uid)}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    // Neither the hash nor a literal "password" field escapes to the wire.
    expect(res.body.user.password).toBeUndefined();
    expect(body).not.toContain(USER_PW_HASH);
  });

  it('GET /api/backups/:id never returns repoPasswordEnc or the plaintext repo password', async () => {
    const uid = await seedUser('backups@t.com');
    const project = await createProject(uid, {
      name: 'demo',
      path: '/var/www/demo',
      repoPassword: PROJECT_PW,
    });
    const res = await request(app)
      .get(`/api/backups/${project._id.toString()}`)
      .set('Authorization', `JWT ${signToken(uid)}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(PROJECT_PW);
    expect(res.body.project.repoPasswordEnc).toBeUndefined();
    // And the envelope's ciphertext/iv/authTag stay in the DB, not on the wire.
    expect(body).not.toMatch(/ciphertext/);
    expect(body).not.toMatch(/authTag/);
  });

  it('GET /api/settings never returns the sshKeyEnc envelope or a plaintext private key', async () => {
    const uid = await seedUser('settings@t.com');
    // Direct-write the envelope so the API round-trip stays hermetic — the
    // service's real upsertStorage does the same via encryptSecret internally.
    await StorageSettings.create({
      owner: uid,
      host: 'storage.example.com',
      user: 'backup',
      port: 22,
      sshKeyEnc: encryptSecret(SSH_KEY),
    });
    const res = await request(app)
      .get('/api/settings/storage')
      .set('Authorization', `JWT ${signToken(uid)}`);
    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(SSH_KEY);
    expect(res.body.storage.sshKeyEnc).toBeUndefined();
    expect(res.body.storage.privateKey).toBeUndefined();
  });
});
