process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mern-starter-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.MASTER_ENCRYPTION_KEY =
  process.env.MASTER_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
// The root .env is a *production* config (see memory: prod-runs-on-this-box).
// Host-run vitest inherits it wholesale, so prod values for CLIENT_URL,
// REDIS_URL (compose service DNS), RESEND, POLAR, MAILGUN leak into tests that
// assert defaults / unconfigured behavior. Unconditionally strip them so the
// suite runs against a clean test env whether from CI or the host. CI's Docker
// runner doesn't have these set, so this is a no-op there.
delete process.env.CLIENT_URL;
delete process.env.SERVER_URL;
delete process.env.REDIS_URL;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM;
delete process.env.POLAR_ACCESS_TOKEN;
delete process.env.POLAR_WEBHOOK_SECRET;
delete process.env.POLAR_SERVER;
delete process.env.POLAR_PRO_PRODUCT_ID;
delete process.env.POLAR_BUSINESS_PRODUCT_ID;
delete process.env.MAILGUN_PRIVATE_KEY;
delete process.env.MAILGUN_DOMAIN;
delete process.env.STRIPE_SECRET_KEY;
// Prompt 11: raise the auth-limiter cap in the test env so integration suites
// (auth, billing) don't collide with the module-level in-memory bucket. The
// security-middleware integration test exercises the 429 path via a scoped
// mini-app with an explicit small `max`.
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? '10000';
// `isConfigured()` requires the opt-in flag AND a credential. Tests default to
// the Polar flag so setting only POLAR_ACCESS_TOKEN configures the provider,
// as suites written before the flag check assume. Configured-ness is still
// driven per-test by (un)setting the token.
process.env.PAYMENT_PROVIDER = process.env.PAYMENT_PROVIDER ?? 'polar';
