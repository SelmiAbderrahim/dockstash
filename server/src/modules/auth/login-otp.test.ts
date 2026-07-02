import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { AuditLog } from '../audit/index.js';
import { setResendTransport, type EmailMessage } from '../communication/index.js';
import { seedSuperadmin } from '../superadmin/superadmin.seed.js';
import {
  computeFingerprint,
  generateOtpCode,
  hashOtp,
  hashUserAgent,
} from './login-otp.service.js';
import { LoginChallenge, OTP_MAX_ATTEMPTS } from './login-challenge.model.js';
import { DEVICE_TRUST_MS, TrustedDevice } from './trusted-device.model.js';

const app = createApp();

const SUPER = { email: 'root@dockstash.test', password: 'correct-horse-battery' };
const DEVICE = { ip: '203.0.113.7', ua: 'vitest-agent/1.0' };

let sentEmails: EmailMessage[] = [];

/** Extracts the 6-digit code from the captured OTP email body. */
function codeFromEmail(): string {
  const body = sentEmails.at(-1)?.text ?? '';
  /* c8 ignore next -- match is guaranteed by the email template in tests */
  return /(\d{6})/.exec(body)?.[1] ?? '';
}

function loginAs(creds: { email: string; password: string }, device = DEVICE) {
  return request(app)
    .post('/api/auth/login')
    .set('X-Forwarded-For', device.ip)
    .set('User-Agent', device.ua)
    .send(creds);
}

function verifyOtpRequest(challengeId: string, code: string, device = DEVICE) {
  return request(app)
    .post('/api/auth/otp/verify')
    .set('X-Forwarded-For', device.ip)
    .set('User-Agent', device.ua)
    .send({ challengeId, code });
}

describe('login OTP (superadmin second factor)', () => {
  const savedKey = env.RESEND_API_KEY;
  const savedFrom = env.RESEND_FROM;

  beforeAll(async () => {
    await startMemoryMongo();
    env.RESEND_API_KEY = 'test-key';
    env.RESEND_FROM = 'no-reply@dockstash.test';
  });

  afterAll(async () => {
    await stopMemoryMongo();
    env.RESEND_API_KEY = savedKey;
    env.RESEND_FROM = savedFrom;
    setResendTransport(null);
  });

  beforeEach(async () => {
    await clearCollections();
    sentEmails = [];
    setResendTransport(async (message) => {
      sentEmails.push(message);
      return { delivered: true };
    });
    await seedSuperadmin(SUPER);
  });

  afterEach(() => {
    setResendTransport(null);
  });

  describe('helpers', () => {
    it('computeFingerprint combines ip and hashed user-agent', () => {
      const fp = computeFingerprint('1.2.3.4', 'agent');
      expect(fp).toBe(`1.2.3.4:${hashUserAgent('agent')}`);
      // Missing user-agent hashes the empty string — still a valid fingerprint.
      expect(computeFingerprint('1.2.3.4', undefined)).toBe(
        `1.2.3.4:${hashUserAgent(undefined)}`,
      );
      expect(hashUserAgent(undefined)).toBe(hashUserAgent(''));
    });

    it('generateOtpCode always yields 6 digits', () => {
      for (let i = 0; i < 20; i += 1) {
        expect(generateOtpCode()).toMatch(/^\d{6}$/);
      }
    });

    it('hashOtp is deterministic and secret-dependent', () => {
      expect(hashOtp('s', '123456')).toBe(hashOtp('s', '123456'));
      expect(hashOtp('s', '123456')).not.toBe(hashOtp('other', '123456'));
    });
  });

  describe('POST /api/auth/login', () => {
    it('keeps the non-superadmin flow byte-identical and creates no challenge', async () => {
      await request(app).post('/api/auth/signup').send({
        email: 'member@dockstash.test',
        password: 'hunter2hunter2',
        firstName: 'M',
        lastName: 'B',
      });
      const res = await loginAs({ email: 'member@dockstash.test', password: 'hunter2hunter2' });
      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^JWT /);
      expect(res.body.user.email).toBe('member@dockstash.test');
      expect(res.body.otpRequired).toBeUndefined();
      expect(await LoginChallenge.countDocuments()).toBe(0);
    });

    it('challenges a superadmin from an unknown device: no token, hashed code, email, audit', async () => {
      const res = await loginAs(SUPER);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ otpRequired: true });
      expect(typeof res.body.challengeId).toBe('string');
      expect(res.body.token).toBeUndefined();
      expect(res.body.message).toBe('A verification code has been sent to your email.');

      const challenge = await LoginChallenge.findById(res.body.challengeId);
      expect(challenge).not.toBeNull();
      expect(challenge?.ip).toBe(DEVICE.ip);
      expect(challenge?.uaHash).toBe(hashUserAgent(DEVICE.ua));

      // Plaintext code never stored; the emailed code hashes to codeHash.
      const code = codeFromEmail();
      expect(code).toMatch(/^\d{6}$/);
      expect(challenge?.codeHash).toBe(hashOtp(challenge?.secret ?? '', code));
      expect(sentEmails.at(-1)?.to).toBe(SUPER.email);

      const audit = await AuditLog.findOne({ action: 'auth.otp.challenge' });
      expect(audit?.ip).toBe(DEVICE.ip);
    });

    it('skips the challenge for a trusted device and refreshes the trust window', async () => {
      const first = await loginAs(SUPER);
      await verifyOtpRequest(first.body.challengeId, codeFromEmail());
      const before = await TrustedDevice.findOne();

      const again = await loginAs(SUPER);
      expect(again.status).toBe(200);
      expect(again.body.token).toMatch(/^JWT /);
      expect(again.body.otpRequired).toBeUndefined();
      expect(await LoginChallenge.countDocuments()).toBe(1);

      const after = await TrustedDevice.findOne();
      expect(after?.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before?.expiresAt.getTime() ?? Infinity,
      );
    });

    it('re-challenges when the device trust has expired', async () => {
      const first = await loginAs(SUPER);
      await verifyOtpRequest(first.body.challengeId, codeFromEmail());
      await TrustedDevice.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

      const again = await loginAs(SUPER);
      expect(again.body.otpRequired).toBe(true);
    });

    it('challenges again from a different device even while another device is trusted', async () => {
      const first = await loginAs(SUPER);
      await verifyOtpRequest(first.body.challengeId, codeFromEmail());

      const other = await loginAs(SUPER, { ip: '198.51.100.9', ua: 'other-agent/2.0' });
      expect(other.body.otpRequired).toBe(true);
    });
  });

  describe('POST /api/auth/otp/verify', () => {
    it('verifies the code, issues a usable JWT, consumes the challenge, trusts the device', async () => {
      const login = await loginAs(SUPER);
      const res = await verifyOtpRequest(login.body.challengeId, codeFromEmail());
      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^JWT /);
      expect(res.body.user.email).toBe(SUPER.email);

      // The issued token works against a protected route.
      const refresh = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', res.body.token);
      expect(refresh.status).toBe(200);

      const challenge = await LoginChallenge.findById(login.body.challengeId);
      expect(challenge?.consumedAt).not.toBeNull();

      const device = await TrustedDevice.findOne({ fingerprint: computeFingerprint(DEVICE.ip, DEVICE.ua) });
      expect(device).not.toBeNull();
      const remaining = (device?.expiresAt.getTime() ?? 0) - Date.now();
      expect(remaining).toBeGreaterThan(DEVICE_TRUST_MS - 60_000);
      expect(remaining).toBeLessThanOrEqual(DEVICE_TRUST_MS);

      expect(await AuditLog.countDocuments({ action: 'auth.otp.success' })).toBe(1);
      expect(await AuditLog.countDocuments({ action: 'auth.newDevice' })).toBe(1);
    });

    it('trusts the device that completes verification, not the one that logged in', async () => {
      const login = await loginAs(SUPER);
      const verifier = { ip: '198.51.100.42', ua: 'phone-agent/3.0' };
      const res = await verifyOtpRequest(login.body.challengeId, codeFromEmail(), verifier);
      expect(res.status).toBe(200);

      const device = await TrustedDevice.findOne();
      expect(device?.fingerprint).toBe(computeFingerprint(verifier.ip, verifier.ua));

      // The verifying device is now trusted; the original login device is not.
      const fromVerifier = await loginAs(SUPER, verifier);
      expect(fromVerifier.body.token).toMatch(/^JWT /);
      const fromOriginal = await loginAs(SUPER);
      expect(fromOriginal.body.otpRequired).toBe(true);
    });

    it('rejects a wrong code, increments attempts, and records an audit failure', async () => {
      const login = await loginAs(SUPER);
      const right = codeFromEmail();
      const wrong = right === '000000' ? '000001' : '000000';
      const res = await verifyOtpRequest(login.body.challengeId, wrong);
      expect(res.status).toBe(401);

      const challenge = await LoginChallenge.findById(login.body.challengeId);
      expect(challenge?.attempts).toBe(1);
      expect(await AuditLog.countDocuments({ action: 'auth.otp.failure' })).toBe(1);

      // The right code still works after one failure.
      const ok = await verifyOtpRequest(login.body.challengeId, right);
      expect(ok.status).toBe(200);
    });

    it('locks the challenge after the attempt cap', async () => {
      const login = await loginAs(SUPER);
      await LoginChallenge.findByIdAndUpdate(login.body.challengeId, {
        $set: { attempts: OTP_MAX_ATTEMPTS },
      });
      const res = await verifyOtpRequest(login.body.challengeId, codeFromEmail());
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe(
        'Too many incorrect codes. Please sign in again to get a new code.',
      );
    });

    it('rejects an expired challenge', async () => {
      const login = await loginAs(SUPER);
      await LoginChallenge.findByIdAndUpdate(login.body.challengeId, {
        $set: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await verifyOtpRequest(login.body.challengeId, codeFromEmail());
      expect(res.status).toBe(401);
    });

    it('rejects reuse of a consumed challenge', async () => {
      const login = await loginAs(SUPER);
      const code = codeFromEmail();
      await verifyOtpRequest(login.body.challengeId, code);
      const again = await verifyOtpRequest(login.body.challengeId, code);
      expect(again.status).toBe(401);
    });

    it('rejects an unknown-but-valid ObjectId and a malformed challengeId', async () => {
      const unknown = await verifyOtpRequest('64b2f8f0a1b2c3d4e5f60718', '123456');
      expect(unknown.status).toBe(401);
      const malformed = await verifyOtpRequest('not-an-object-id', '123456');
      expect(malformed.status).toBe(401);
    });

    it('rejects verification when the account vanished after the challenge', async () => {
      const login = await loginAs(SUPER);
      const { User } = await import('../users/index.js');
      await User.deleteMany({ email: SUPER.email });
      const res = await verifyOtpRequest(login.body.challengeId, codeFromEmail());
      expect(res.status).toBe(401);
    });

    it('rejects a malformed code with a validation error', async () => {
      const login = await loginAs(SUPER);
      const short = await verifyOtpRequest(login.body.challengeId, '12345');
      expect(short.status).toBe(400);
      const alpha = await verifyOtpRequest(login.body.challengeId, 'abc123');
      expect(alpha.status).toBe(400);
    });
  });
});
