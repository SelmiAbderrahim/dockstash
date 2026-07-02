process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/mern-starter-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.MASTER_ENCRYPTION_KEY =
  process.env.MASTER_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
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
