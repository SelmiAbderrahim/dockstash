import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import * as mailgunShim from './mailers/mailgun.js';

const app = createApp();

describe('legacy mailgun shim', () => {
  it('re-exports the Resend transport for back-compat imports', () => {
    expect(typeof mailgunShim.sendEmail).toBe('function');
    expect(typeof mailgunShim.setResendTransport).toBe('function');
    expect(typeof mailgunShim.getResendTransport).toBe('function');
  });
});

describe('communication module', () => {
  it('rejects empty contact form payloads', async () => {
    const res = await request(app).post('/api/communication/contact').send({});
    expect(res.status).toBe(400);
  });

  it('accepts a well-formed contact form even without resend configured', async () => {
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

  it('localizes the contact confirmation via Accept-Language', async () => {
    const res = await request(app)
      .post('/api/communication/contact')
      .set('Accept-Language', 'fr')
      .send({
        firstName: 'Jean',
        lastName: 'Dupont',
        email: 'jean@example.com',
        subject: 'Bonjour',
        message: 'Salut.',
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/envoyé/i);
  });
});
