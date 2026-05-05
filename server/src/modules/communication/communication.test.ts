import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

const app = createApp();

describe('communication module', () => {
  it('rejects empty contact form payloads', async () => {
    const res = await request(app).post('/api/communication/contact').send({});
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed contact form even without mailgun configured', async () => {
    const res = await request(app).post('/api/communication/contact').send({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      subject: 'Hello',
      message: 'Just checking in.',
    });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/has been sent/i);
  });
});
