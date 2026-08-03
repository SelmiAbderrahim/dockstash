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

  // Email (Resend) — optional. The stack boots without these.
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().optional(),

  // OAuth sign-in (Google / GitHub) — optional. A provider is enabled only
  // when BOTH its client id and secret are set; the client hides the buttons
  // otherwise. Compose passes `${VAR:-}` (empty string), so map '' back to
  // undefined before validating.
  GOOGLE_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
  GOOGLE_CLIENT_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
  GITHUB_CLIENT_ID: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),
  GITHUB_CLIENT_SECRET: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().optional(),
  ),

  // Alerting — optional with a sane default.
  ALERT_HEARTBEAT_HOURS: z.coerce.number().int().positive().default(24),

  // Disaster recovery — self-backup of the orchestrator Mongo. Reserved repo
  // identifier on the storage VPS (never a user project's repo). Cadence is a
  // standard cron expression consumed by the scheduler.
  SELF_BACKUP_REPO: z.string().min(1).default('dockstash-self'),
  SELF_BACKUP_CRON: z.string().min(1).default('0 3 * * *'),

  // Optional failure-alert webhook. When set, `sendFailureAlert` POSTs the
  // alert payload here in addition to the Resend email .
  ALERT_WEBHOOK_URL: z.string().url().optional(),

  // ------------------------------------------------------------------
  // Restic execution. `placeholder` (default) keeps the throwing runner —
  // tests and bare-metal dev boot unchanged; compose sets `process` to spawn
  // the real binary. DOCKER_HOST points at the socket proxy for dump execs.
  // ------------------------------------------------------------------
  RESTIC_RUNNER: z.enum(['placeholder', 'process']).default('placeholder'),
  RESTIC_BINARY: z.string().min(1).default('restic'),
  RESTIC_CACHE_DIR: z.string().min(1).default('/tmp/restic-cache'),
  DOCKER_HOST: z.string().optional(),

  // Contact-form recipient. Optional — communication.service falls back to a
  // placeholder and logs a warning when unset while email is configured.
  CONTACT_RECIPIENT: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().email().optional(),
  ),

  // ------------------------------------------------------------------
  // Security (prompt 11): rate-limit knobs + CSRF cookie name + legal
  // grace-period. All optional with production-safe defaults.
  // ------------------------------------------------------------------
  RATE_LIMIT_AUTH_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: z.coerce.number().int().positive().default(10),
  // ------------------------------------------------------------------
  // Fleet agents: machine-surface rate limit + liveness/lease windows.
  // Sized for one agent per IP: heartbeat ~30s + poll ~10s + log batches.
  // ------------------------------------------------------------------
  RATE_LIMIT_AGENT_WINDOW_MS: z.coerce.number().int().positive().default(60 * 1000),
  RATE_LIMIT_AGENT_MAX: z.coerce.number().int().positive().default(600),
  // Agent counts as offline when lastSeenAt is older than this (3× heartbeat).
  AGENT_OFFLINE_AFTER_SECONDS: z.coerce.number().int().positive().default(90),
  // Leased agent jobs fail when not renewed (log posts renew) within this window.
  AGENT_JOB_LEASE_SECONDS: z.coerce.number().int().positive().default(900),
  CSRF_COOKIE_NAME: z.string().min(1).default('x-csrf-token'),
  CSRF_HEADER_NAME: z.string().min(1).default('x-csrf-token'),
  // Hours between account-deletion request and the irreversible repo purge.
  // Final warning email fires at 24h before the purge window closes.
  ACCOUNT_DELETION_GRACE_HOURS: z.coerce.number().int().positive().default(30 * 24),
  // SSH host-key pinning: when set, the transport pings this fingerprint at
  // connection setup and rejects any mismatch. Format: `sha256:BASE64`.
  STORAGE_SSH_HOST_KEY_FINGERPRINT: z.string().optional(),

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
