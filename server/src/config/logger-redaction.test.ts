import { Writable } from 'node:stream';
import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from './logger.js';

/**
 * Runtime proof that the pino redaction paths from `logger.ts` actually
 * collapse the well-known secret keys to `[REDACTED]`. Uses a `Writable`
 * destination to capture every log line as JSON so a regression on the
 * `redact` block fails HERE rather than downstream in log ingest.
 *
 * Sibling to `shared/middleware/secrets-meta.test.ts` (static allowlist check);
 * this file asserts pino behaves at runtime with the same list.
 */

function makeCapturingLogger(): { logger: pino.Logger; lines: string[] } {
  const lines: string[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  const logger = pino(
    {
      redact: { paths: REDACT_PATHS, censor: '[REDACTED]', remove: false },
    },
    dest,
  );
  return { logger, lines };
}

describe('logger redaction — runtime proof', () => {
  it('redacts Authorization + Cookie on the pino-http-shaped req serializer', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      {
        req: {
          headers: {
            authorization: 'JWT eyJhbGciOiJIUzI1NiJ9.PAYLOAD.SIG',
            cookie: 'token=abc123; sid=xyz',
            'x-csrf-token': 'CSRF-SECRET',
          },
        },
      },
      'request',
    );
    const line = lines.join('');
    expect(line).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(line).not.toContain('abc123');
    expect(line).not.toContain('CSRF-SECRET');
    expect(line).toContain('[REDACTED]');
  });

  it('redacts Set-Cookie on the res serializer', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      { res: { headers: { 'set-cookie': 'session=SECRET-SESSION; HttpOnly' } } },
      'response',
    );
    expect(lines.join('')).not.toContain('SECRET-SESSION');
  });

  it('redacts nested password / token / privateKey / apiKeyHash fields at any depth', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      {
        user: { email: 'u@t.com', password: 'HORSEBATTERY' },
        agent: {
          apiKeyHash: { hash: 'FAKE-HASH', keyVersion: 1 },
          token: 'dsa_deadbeef.SECRET',
        },
        settings: { privateKey: '-----BEGIN OPENSSH-----' },
      },
      'user + agent + settings',
    );
    const line = lines.join('');
    expect(line).not.toContain('HORSEBATTERY');
    expect(line).not.toContain('FAKE-HASH');
    expect(line).not.toContain('dsa_deadbeef.SECRET');
    expect(line).not.toContain('-----BEGIN OPENSSH-----');
    expect(line).toContain('u@t.com');
  });

  it('redacts envelope ciphertext + iv + authTag anywhere they appear', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      {
        project: {
          repoPasswordEnc: {
            ciphertext: 'AAAA-CIPHERTEXT',
            iv: 'IV-BYTES',
            authTag: 'AUTH-TAG',
            keyVersion: 1,
          },
        },
      },
      'envelope',
    );
    const line = lines.join('');
    expect(line).not.toContain('AAAA-CIPHERTEXT');
    expect(line).not.toContain('IV-BYTES');
    expect(line).not.toContain('AUTH-TAG');
  });

  it('redacts env-derived globals when they leak into a log record', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      {
        MASTER_ENCRYPTION_KEY: 'MASTER-64-HEX',
        JWT_SECRET: 'JWT-SIG-SECRET',
        SESSION_SECRET: 'SESSION-SECRET',
        RESEND_API_KEY: 'RESEND-KEY',
      },
      'env dump',
    );
    const line = lines.join('');
    expect(line).not.toContain('MASTER-64-HEX');
    expect(line).not.toContain('JWT-SIG-SECRET');
    expect(line).not.toContain('SESSION-SECRET');
    expect(line).not.toContain('RESEND-KEY');
  });

  it('redacts direct request-body fields on the pino-http body serializer path', () => {
    const { logger, lines } = makeCapturingLogger();
    logger.info(
      {
        req: {
          body: {
            email: 'u@t.com',
            password: 'BAD-CHOICE',
            newPassword: 'BETTER-CHOICE',
            repoPassword: 'PROJECT-KEY',
            privateKey: '-----BEGIN OPENSSH-----',
          },
        },
      },
      'body',
    );
    const line = lines.join('');
    expect(line).not.toContain('BAD-CHOICE');
    expect(line).not.toContain('BETTER-CHOICE');
    expect(line).not.toContain('PROJECT-KEY');
    expect(line).not.toContain('-----BEGIN OPENSSH-----');
    expect(line).toContain('u@t.com');
  });
});
