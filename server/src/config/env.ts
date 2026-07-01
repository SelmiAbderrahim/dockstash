import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../shared/i18n/locales.js';
import { decodeMasterKey } from '../shared/crypto/keys.js';

const localeSchema = z.enum(SUPPORTED_LOCALES);

const masterEncryptionKey = z
  .string()
  .min(1, 'MASTER_ENCRYPTION_KEY is required')
  .refine((raw) => decodeMasterKey(raw) !== null, {
    message: 'MASTER_ENCRYPTION_KEY must decode to at least 32 bytes (hex, base64, or utf8)',
  });

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGODB_URI: z.string().min(1),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  SESSION_SECRET: z.string().min(32).optional(),
  CLIENT_URL: z.string().url().default('http://localhost:3000'),
  SERVER_URL: z.string().url().default('http://localhost:8080'),
  DEFAULT_LOCALE: localeSchema.default('en'),

  // Encryption — required. See shared/crypto/README.md for the rotation runbook.
  MASTER_ENCRYPTION_KEY: masterEncryptionKey,

  // Payments (Polar) — optional. Free / self-host tier boots without these.
  PAYMENT_PROVIDER: z.enum(['none', 'polar', 'stripe']).default('none'),
  POLAR_ACCESS_TOKEN: z.string().optional(),
  POLAR_WEBHOOK_SECRET: z.string().optional(),
  POLAR_SERVER: z.enum(['sandbox', 'production']).optional(),
  POLAR_PRO_PRODUCT_ID: z.string().optional(),
  POLAR_BUSINESS_PRODUCT_ID: z.string().optional(),
  POLAR_PRO_YEARLY_PRODUCT_ID: z.string().optional(),
  POLAR_BUSINESS_YEARLY_PRODUCT_ID: z.string().optional(),

  // Email (Resend) — optional. Free / self-host tier boots without these.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  // Alerting — optional with a sane default (see IDEA.md).
  ALERT_HEARTBEAT_HOURS: z.coerce.number().int().positive().default(24),

  // Disaster recovery — self-backup of the orchestrator Mongo. Reserved repo
  // identifier on the storage VPS (never a user project's repo). Cadence is a
  // standard cron expression consumed by the scheduler.
  SELF_BACKUP_REPO: z.string().min(1).default('dockstash-self'),
  SELF_BACKUP_CRON: z.string().min(1).default('0 3 * * *'),

  // Optional failure-alert webhook. When set, `sendFailureAlert` POSTs the
  // alert payload here in addition to the Resend email (per IDEA.md §7).
  ALERT_WEBHOOK_URL: z.string().url().optional(),

  // ------------------------------------------------------------------
  // Security (prompt 11): rate-limit knobs + CSRF cookie name + legal
  // grace-period. All optional with production-safe defaults.
  // ------------------------------------------------------------------
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_WEBHOOK_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  RATE_LIMIT_WEBHOOK_MAX: z.coerce.number().int().positive().default(120),
  CSRF_COOKIE_NAME: z.string().min(1).default('x-csrf-token'),
  CSRF_HEADER_NAME: z.string().min(1).default('x-csrf-token'),
  // Hours between account-deletion request and the irreversible repo purge.
  // Final warning email fires at 24h before the purge window closes.
  ACCOUNT_DELETION_GRACE_HOURS: z.coerce.number().int().positive().default(30 * 24),
  // SSH host-key pinning: when set, the transport pings this fingerprint at
  // connection setup and rejects any mismatch. Format: `sha256:BASE64`.
  STORAGE_SSH_HOST_KEY_FINGERPRINT: z.string().optional(),

  // Legacy MERN integrations — optional, kept for backwards compatibility.
  STRIPE_SECRET_KEY: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  MAILCHIMP_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

/* c8 ignore start -- startup misconfig guard: exits the process, not unit-testable */
if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
/* c8 ignore stop */

export const env = parsed.data;
export type Env = typeof env;
