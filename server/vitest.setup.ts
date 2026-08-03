process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/dockstash-test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? '0123456789abcdef0123456789abcdef';
process.env.MASTER_ENCRYPTION_KEY =
  process.env.MASTER_ENCRYPTION_KEY ??
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'fatal';
// The root .env is a *production* config (see memory: prod-runs-on-this-box).
// Host-run vitest inherits it wholesale, so prod values for CLIENT_URL,
// REDIS_URL (compose service DNS) and RESEND leak into tests that assert
// defaults / unconfigured behavior. Unconditionally strip them so the suite
// runs against a clean test env whether from CI or the host. CI's Docker
// runner doesn't have these set, so this is a no-op there.
delete process.env.CLIENT_URL;
delete process.env.SERVER_URL;
delete process.env.REDIS_URL;
delete process.env.RESEND_API_KEY;
delete process.env.RESEND_FROM;
// OAuth creds: tests assert unconfigured-by-default behavior and enable
// providers per-case by mutating `env` directly.
delete process.env.GOOGLE_CLIENT_ID;
delete process.env.GOOGLE_CLIENT_SECRET;
delete process.env.GITHUB_CLIENT_ID;
delete process.env.GITHUB_CLIENT_SECRET;
// Prompt 11: raise the auth-limiter cap in the test env so integration suites
// don't collide with the module-level in-memory bucket. The security-middleware
// integration test exercises the 429 path via a scoped mini-app with an
// explicit small `max`.
process.env.RATE_LIMIT_AUTH_MAX = process.env.RATE_LIMIT_AUTH_MAX ?? '10000';
