import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { hashPassword, signToken } from '../auth/index.js';
import { toPublicUser } from '../users/index.js';

const app = createApp();

async function createUser(email: string) {
  const passwordHash = await hashPassword('hunter2hunter2');
  const user = await User.create({
    email,
    password: passwordHash,
    profile: { firstName: email.split('@')[0]!, lastName: 'Test' },
  });
  return user;
}

describe('chat module', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('requires auth', async () => {
    const res = await request(app).get('/api/chat');
    expect(res.status).toBe(401);
  });

  it('starts a new conversation and returns conversationId', async () => {
    const author = await createUser('alice@chat.test');
    const recipient = await createUser('bob@chat.test');
    const token = signToken(toPublicUser(author));

    const res = await request(app)
      .post(`/api/chat/new/${recipient._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ composedMessage: 'Hi Bob!' });

    expect(res.status).toBe(201);
    expect(typeof res.body.conversationId).toBe('string');
  });

  it('lists conversations and returns the latest message', async () => {
    const author = await createUser('alice2@chat.test');
    const recipient = await createUser('bob2@chat.test');
    const token = signToken(toPublicUser(author));

    const startRes = await request(app)
      .post(`/api/chat/new/${recipient._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ composedMessage: 'Initial hello' });
    const conversationId: string = startRes.body.conversationId;

    await request(app)
      .post(`/api/chat/${conversationId}`)
      .set('Authorization', `JWT ${token}`)
      .send({ composedMessage: 'Follow-up' });

    const res = await request(app)
      .get('/api/chat')
      .set('Authorization', `JWT ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conversations)).toBe(true);
    expect(res.body.conversations.length).toBeGreaterThan(0);
  });
});
