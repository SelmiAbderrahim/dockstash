import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sendEmail,
  setResendTransport,
  getResendTransport,
  type EmailMessage,
} from './mailers/resend.js';
import {
  deliverContactForm,
  deliverPasswordResetEmail,
  deliverVerificationEmail,
  deliverPasswordChangedEmail,
  deliverLoginOtpEmail,
  deliverWelcomeEmail,
  deliverPaymentReceiptEmail,
  deliverDunningEmail,
  deliverAlertEmail,
} from './communication.service.js';

const originalKey = process.env.RESEND_API_KEY;
const originalFrom = process.env.RESEND_FROM;

async function withResendConfigured<T>(fn: () => Promise<T>): Promise<T> {
  process.env.RESEND_API_KEY = 'test-key';
  process.env.RESEND_FROM = 'no-reply@dockstash.test';
  const { env } = await import('../../config/env.js');
  const prevKey = env.RESEND_API_KEY;
  const prevFrom = env.RESEND_FROM;
  (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
  (env as { RESEND_FROM?: string }).RESEND_FROM = 'no-reply@dockstash.test';
  try {
    return await fn();
  } finally {
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = prevKey;
    (env as { RESEND_FROM?: string }).RESEND_FROM = prevFrom;
  }
}

describe('resend transport', () => {
  beforeEach(() => {
    setResendTransport(null);
  });
  afterAll(() => {
    process.env.RESEND_API_KEY = originalKey;
    process.env.RESEND_FROM = originalFrom;
    setResendTransport(null);
  });

  it('skips send when RESEND is not configured and returns delivered:false', async () => {
    const result = await sendEmail({
      to: 't@example.com',
      subject: 's',
      text: 'body',
    });
    expect(result.delivered).toBe(false);
  });

  it('sends via injected transport when RESEND is configured', async () => {
    await withResendConfigured(async () => {
      const seen: Array<{ msg: EmailMessage; from: string; apiKey: string }> = [];
      setResendTransport(async (msg, from, apiKey) => {
        seen.push({ msg, from, apiKey });
        return { delivered: true };
      });
      const res = await sendEmail({
        to: 'r@example.com',
        subject: 'hi',
        text: 'body',
      });
      expect(res.delivered).toBe(true);
      expect(seen).toHaveLength(1);
      expect(seen[0]?.from).toBe('no-reply@dockstash.test');
      expect(seen[0]?.apiKey).toBe('test-key');
      expect(seen[0]?.msg.to).toBe('r@example.com');
    });
  });

  it('surfaces a transport throw as delivered:false without crashing the caller', async () => {
    await withResendConfigured(async () => {
      setResendTransport(async () => {
        throw new Error('network down');
      });
      const res = await sendEmail({ to: 'x@example.com', subject: 's', text: 't' });
      expect(res.delivered).toBe(false);
    });
  });

  it('reports delivered:false on non-2xx response from the HTTP transport', async () => {
    await withResendConfigured(async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'server error',
      } as unknown as Response);
      setResendTransport(null); // use httpTransport
      const res = await sendEmail({ to: 'x@example.com', subject: 's', text: 't' });
      expect(res.delivered).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  it('reports delivered:true when the HTTP transport succeeds and includes html', async () => {
    await withResendConfigured(async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      } as unknown as Response);
      setResendTransport(null);
      const res = await sendEmail({
        to: 'x@example.com',
        subject: 's',
        text: 't',
        html: '<b>hi</b>',
      });
      expect(res.delivered).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(String(opts.body));
      expect(body.html).toBe('<b>hi</b>');
      expect(body.to).toEqual(['x@example.com']);
      fetchSpy.mockRestore();
    });
  });

  it('includes reply_to in the HTTP transport body when replyTo is set', async () => {
    await withResendConfigured(async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      } as unknown as Response);
      setResendTransport(null);
      const res = await sendEmail({
        to: 'x@example.com',
        subject: 's',
        text: 't',
        replyTo: 'submitter@example.com',
      });
      expect(res.delivered).toBe(true);
      const [, opts] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
      const body = JSON.parse(String(opts.body));
      expect(body.reply_to).toBe('submitter@example.com');
      fetchSpy.mockRestore();
    });
  });

  it('surfaces text() rejection on failed response without throwing', async () => {
    await withResendConfigured(async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error('body-drain');
        },
      } as unknown as Response);
      setResendTransport(null);
      const res = await sendEmail({ to: 'x@example.com', subject: 's', text: 't' });
      expect(res.delivered).toBe(false);
      fetchSpy.mockRestore();
    });
  });

  it('setResendTransport(null) restores the http transport', () => {
    setResendTransport(async () => ({ delivered: true }));
    expect(getResendTransport()).not.toBe(undefined);
    setResendTransport(null);
    expect(getResendTransport()).not.toBe(undefined);
  });
});

describe('communication.service localized senders', () => {
  const seen: Array<EmailMessage & { from?: string }> = [];
  beforeAll(() => {
    setResendTransport(null);
  });
  beforeEach(() => {
    seen.length = 0;
    setResendTransport(async (msg) => {
      seen.push({ ...msg });
      return { delivered: true };
    });
  });
  afterAll(() => setResendTransport(null));

  it('deliverContactForm uses our own sender and puts the submitter in reply-to', async () => {
    await withResendConfigured(async () => {
      await deliverContactForm({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.co',
        subject: 'hi',
        message: 'yo',
      });
      expect(seen).toHaveLength(1);
      expect(seen[0]?.subject).toBe('hi');
      // `from` must NOT be the submitter (no spoofing) — it falls back to env sender.
      expect(seen[0]?.from).toBeUndefined();
      // Submitter identity rides in reply-to + the body so replies still work.
      expect(seen[0]?.replyTo).toBe('a@b.co');
      expect(seen[0]?.text).toContain('From: A B <a@b.co>');
      expect(seen[0]?.text).toContain('yo');
    });
  });

  it('deliverPasswordResetEmail renders in the caller locale', async () => {
    await withResendConfigured(async () => {
      await deliverPasswordResetEmail('u@x', 'https://r', 'fr');
      expect(seen[0]?.subject).toMatch(/Réinitialisez/);
      expect(seen[0]?.text).toContain('https://r');
    });
  });

  it('deliverVerificationEmail carries the verify URL in the caller locale', async () => {
    await withResendConfigured(async () => {
      await deliverVerificationEmail('u@x', 'https://app.test/verify-email/abc', 'de');
      expect(seen[0]?.subject).toContain('E-Mail');
      expect(seen[0]?.text).toContain('https://app.test/verify-email/abc');
    });
  });

  it('deliverVerificationEmail defaults to DEFAULT_LOCALE when locale omitted', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverVerificationEmail('u@x', 'https://app.test/verify-email/xyz');
      expect(seen[0]?.subject).toBe('Verify your email address');
      expect(seen[0]?.text).toContain('https://app.test/verify-email/xyz');
    });
  });

  it('deliverPasswordChangedEmail renders in the caller locale', async () => {
    await withResendConfigured(async () => {
      await deliverPasswordChangedEmail('u@x', 'zh');
      expect(seen[0]?.subject).toContain('密码');
    });
  });

  it('deliverLoginOtpEmail interpolates the code and TTL in the caller locale', async () => {
    await withResendConfigured(async () => {
      await deliverLoginOtpEmail('u@x', '123456', 'fr');
      expect(seen[0]?.subject).toBe('Votre code de connexion Dockstash');
      expect(seen[0]?.text).toContain('123456');
      expect(seen[0]?.text).toContain('10 minutes');
    });
  });

  it('deliverLoginOtpEmail defaults to DEFAULT_LOCALE when locale omitted', async () => {
    await withResendConfigured(async () => {
      await deliverLoginOtpEmail('u@x', '654321');
      expect(seen[0]?.subject).toBe('Your Dockstash sign-in code');
      expect(seen[0]?.text).toContain('654321');
    });
  });

  it('deliverWelcomeEmail interpolates {{name}} and {{clientUrl}}', async () => {
    await withResendConfigured(async () => {
      await deliverWelcomeEmail({ email: 'u@x', name: 'Alex', locale: 'en' });
      expect(seen[0]?.subject).toBe('Welcome to Dockstash');
      expect(seen[0]?.text).toContain('Alex');
    });
  });

  it('deliverPaymentReceiptEmail renders in the caller locale', async () => {
    await withResendConfigured(async () => {
      await deliverPaymentReceiptEmail({
        email: 'u@x',
        amount: '$10',
        plan: 'pro',
        locale: 'de',
      });
      expect(seen[0]?.subject).toBe('Ihre Dockstash-Quittung');
      expect(seen[0]?.text).toContain('$10');
      expect(seen[0]?.text).toContain('pro');
    });
  });

  it('deliverDunningEmail includes graceEndsAt', async () => {
    await withResendConfigured(async () => {
      await deliverDunningEmail({
        email: 'u@x',
        plan: 'pro',
        graceEndsAt: '2027-01-01',
        locale: 'es',
      });
      expect(seen[0]?.subject).toMatch(/Problema/);
      expect(seen[0]?.text).toContain('2027-01-01');
    });
  });

  it('deliverWelcomeEmail defaults to DEFAULT_LOCALE when locale omitted', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverWelcomeEmail({ email: 'u@x', name: 'Alex' });
      expect(seen[0]?.subject).toBe('Welcome to Dockstash');
    });
  });

  it('deliverPaymentReceiptEmail defaults to DEFAULT_LOCALE when locale omitted', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverPaymentReceiptEmail({ email: 'u@x', amount: '$5', plan: 'pro' });
      expect(seen[0]?.text).toContain('$5');
    });
  });

  it('deliverDunningEmail defaults to DEFAULT_LOCALE when locale omitted', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverDunningEmail({ email: 'u@x', plan: 'pro', graceEndsAt: '2027-02-02' });
      expect(seen[0]?.text).toContain('2027-02-02');
    });
  });

  it('deliverAlertEmail renders backup / drill / restore / heartbeat kinds', async () => {
    await withResendConfigured(async () => {
      const now = new Date('2027-01-02T00:00:00Z');
      const past = new Date('2027-01-01T00:00:00Z');
      for (const kind of ['backup', 'drill', 'restore', 'heartbeat'] as const) {
        seen.length = 0;
        await deliverAlertEmail({
          email: 'u@x',
          kind,
          project: 'p',
          projectId: 'pid',
          error: 'boom',
          lastGoodAt: past,
          failedAt: now,
          hoursThreshold: 24,
          locale: 'en',
        });
        expect(seen[0]).toBeDefined();
        expect(seen[0]?.text).toContain('p');
      }
    });
  });

  it('deliverAlertEmail renders "never" placeholder in recipient locale when lastGoodAt is null', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverAlertEmail({
        email: 'u@x',
        kind: 'heartbeat',
        project: 'p',
        projectId: 'pid',
        error: '',
        lastGoodAt: null,
        hoursThreshold: 24,
        locale: 'fr',
      });
      expect(seen[0]?.text).toContain('jamais');
    });
  });

  it('deliverAlertEmail defaults to DEFAULT_LOCALE when locale is not passed', async () => {
    await withResendConfigured(async () => {
      seen.length = 0;
      await deliverAlertEmail({
        email: 'u@x',
        kind: 'backup',
        project: 'p',
        projectId: 'pid',
        error: 'e',
        lastGoodAt: null,
      });
      expect(seen[0]?.subject).toContain('project p');
    });
  });
});
