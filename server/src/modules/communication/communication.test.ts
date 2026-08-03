import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import { contactFormRecipient } from './communication.service.js';
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

  it('rejects an oversized message body (length cap)', async () => {
    const res = await request(app).post('/api/communication/contact').send({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      subject: 'Hello',
      message: 'x'.repeat(5001),
    });
    expect(res.status).toBe(400);
  });

  it('rate-limits repeated contact submissions (429 after the bucket is spent)', async () => {
    // A fresh app instance gets its own limiter bucket, so this does not leak
    // into the shared `app` used by the other cases.
    const limitedApp = createApp();
    const payload = {
      firstName: 'Flood',
      lastName: 'Bot',
      email: 'flood@example.com',
      subject: 'spam',
      message: 'spam',
    };
    let sawLimited = false;
    for (let i = 0; i < 6; i++) {
      const res = await request(limitedApp).post('/api/communication/contact').send(payload);
      if (res.status === 429) sawLimited = true;
    }
    expect(sawLimited).toBe(true);
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

describe('contactFormRecipient', () => {
  it('prefers CONTACT_RECIPIENT when set', () => {
    const prev = env.CONTACT_RECIPIENT;
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = 'ops@dockstash.com';
    expect(contactFormRecipient()).toBe('ops@dockstash.com');
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = prev;
  });

  it('falls back to the placeholder and warns when Resend is configured', () => {
    const prevRecipient = env.CONTACT_RECIPIENT;
    const prevResend = env.RESEND_API_KEY;
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = undefined;
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 're_key';
    expect(contactFormRecipient()).toBe('you@example.com');
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = prevRecipient;
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = prevResend;
  });

  it('falls back silently when email is not configured at all', () => {
    const prevRecipient = env.CONTACT_RECIPIENT;
    const prevResend = env.RESEND_API_KEY;
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = undefined;
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = undefined;
    expect(contactFormRecipient()).toBe('you@example.com');
    (env as { CONTACT_RECIPIENT?: string }).CONTACT_RECIPIENT = prevRecipient;
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = prevResend;
  });
});
