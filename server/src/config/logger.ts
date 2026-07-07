import pino from 'pino';
import { env } from './env.js';

const isDev = env.NODE_ENV === 'development';

/**
 * Pino field-level redaction allowlist (surface #7 STEP 2, S7-01/S7-02/S8-02).
 *
 * Every well-known secret path this codebase can emit — request bodies (login,
 * register, backups create, settings storage), incoming/outgoing headers,
 * cookies, JWT/OTP/reset tokens, envelope ciphertext + IV + authTag,
 * `MASTER_ENCRYPTION_KEY`, `SUPERADMIN_PASSWORD`, Polar credentials, agent
 * `apiKeyHash`, restic repo password / SSH private key — collapses to
 * `[REDACTED]` before pino ever writes it.
 *
 * Nested wildcards (`*.password`) match at any depth. Explicit `req.headers.*`
 * / `res.headers.*` paths cover the pino-http serializers, which log full
 * headers by default.
 *
 * Update `.claude/rules/secrets-and-rotation.md` and
 * `server/src/shared/middleware/secrets-meta.test.ts` when this list changes —
 * the meta-test pins the allowlist so a regression fails the suite before ever
 * reaching production.
 */
export const REDACT_PATHS: string[] = [
  // Request / response headers (pino-http default req/res serializers).
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  // Common request body fields on auth / settings / backups create surfaces.
  'req.body.password',
  'req.body.newPassword',
  'req.body.currentPassword',
  'req.body.repoPassword',
  'req.body.privateKey',
  'req.body.token',
  'req.body.code',
  // Envelope + hash payloads. `*.password` catches nested Mongoose fields and
  // any error/log record that spreads a document. Encrypted-secret envelopes
  // are redacted at the PARENT object level (`*.repoPasswordEnc`) — pino's
  // single-star wildcard cannot reach a grandchild, so we also register the
  // one-level-deeper variants (`*.*.ciphertext`) for records logged as
  // `{ project: { repoPasswordEnc: {...} } }`.
  '*.password',
  '*.newPassword',
  '*.currentPassword',
  '*.token',
  '*.secret',
  '*.privateKey',
  '*.repoPassword',
  '*.apiKeyHash',
  '*.hash',
  '*.ciphertext',
  '*.iv',
  '*.authTag',
  '*.otp',
  '*.code',
  '*.resetPasswordToken',
  '*.emailVerificationToken',
  '*.repoPasswordEnc',
  '*.sshKeyEnc',
  '*.defaultRepoPasswordEnc',
  '*.wrappedKey',
  '*.*.ciphertext',
  '*.*.iv',
  '*.*.authTag',
  '*.*.hash',
  '*.*.password',
  '*.*.token',
  '*.*.secret',
  '*.*.privateKey',
  '*.*.apiKeyHash',
  // Env-derived globals that occasionally end up in an error/config log.
  'MASTER_ENCRYPTION_KEY',
  'SUPERADMIN_PASSWORD',
  'JWT_SECRET',
  'SESSION_SECRET',
  'POLAR_ACCESS_TOKEN',
  'POLAR_WEBHOOK_SECRET',
  'RESEND_API_KEY',
  'STRIPE_SECRET_KEY',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: REDACT_PATHS,
    censor: '[REDACTED]',
    remove: false,
  },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      }
    : {}),
});
