# Secrets & Data-at-Rest (Surface #7) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every persisted secret (restic repo password, SSH private key, API key,
webhook secret) is stored as an `EncryptedSecret` envelope
(`{ ciphertext, iv, authTag, keyVersion }`) produced by
`shared/crypto/encryptSecret` — never plaintext. Every `encryptSecret`
call uses a FRESH random 12-byte IV (`crypto.randomBytes(12)`) — never a
hardcoded / reused IV. `MASTER_ENCRYPTION_KEY` is read from
`process.env` via `config/env.ts` (zod-parsed) ONLY; there is no in-source
default that could ship in an image. Master-key rotation runs via
`shared/crypto/rotate.ts::rotateStore` — decrypt-with-old →
re-encrypt-with-new → atomic swap; all-or-nothing per store; rerun is
idempotent when the record's `keyVersion` already equals the target. The
pino logger (`config/logger.ts`) is configured with a `redact` block
covering every well-known secret key path so `logger.info({ req, err })`
NEVER prints Authorization / Cookie / password / token / envelope /
`MASTER_ENCRYPTION_KEY`. The superadmin seeder is idempotent
(`findOne({ email })` → skip if exists) and NEVER emits the plaintext
password on any log line — `console.*` is banned repo-wide inside
`modules/superadmin/**`. Environment variables live in the ROOT `.env`
only; subdirectory `.env` files are forbidden. Runtime URLs derive from
`CLIENT_URL` / `SERVER_URL` / `VITE_API_BASE_URL` — no hardcoded
`localhost` / domain literals in source (test / seed / static docs
excepted). The self-backup restic password is HMAC-DERIVED from the
master key via `deriveSelfBackupPassword` — never the master key
verbatim.**

See `prompts/dockstash-security/07-secrets-data-at-rest-opus-4.7.md`,
`docs/security-model.en.md` § "Secrets & data-at-rest", and
`server/src/shared/crypto/README.md` for the rotation runbook.

## Why This Rule Exists

Six failure modes this rule blocks in one pattern:

1. **Plaintext secret in the DB.** A stolen mongodump gives the attacker
   every restic repo password and SSH key. `encryptSecret` puts an AES-256-GCM
   envelope in front so the dump is inert without `MASTER_ENCRYPTION_KEY`.
2. **Reused / hardcoded IV.** GCM catastrophically fails on IV reuse:
   two ciphertexts under the same (key, IV) leak the XOR of plaintexts and
   forge the auth tag. `crypto.randomBytes(12)` per call closes that.
3. **In-source master key default.** A committed `MASTER_ENCRYPTION_KEY`
   default reduces the master to a public constant on GitHub. Env-only,
   fail-fast at boot.
4. **Rotation without rollback.** A mid-rotation crash without the
   decrypt-old + re-encrypt-new + atomic-swap discipline strands half the
   store at a keyVersion no live key decrypts. `rotateStore` reports
   `failedAt`; already-swapped rows decrypt under the still-registered
   new key; un-swapped rows decrypt under the still-registered old key.
5. **Unredacted logs.** `logger.info({ headers, body, err })` on a login
   or backup-create request emits the raw JWT / password / repo password
   into log ingest. One SIEM index = full-tenant compromise. The pino
   `redact` block collapses every well-known path to `[REDACTED]`.
6. **Seeder overwrite.** A re-run of the entrypoint seeder that rewrites
   an existing account rotates the password from under the operator with
   no audit trail. `findOne` + skip-if-exists is idempotent; a re-run with
   different creds is a no-op.

## CORRECT

```ts
// encryption — fresh random 12-byte IV per call, envelope in the DB
const envelope = encryptSecret(plaintextPassword);      // { ciphertext, iv, authTag, keyVersion }
project.repoPasswordEnc = envelope;
await project.save();
```

```ts
// decryption — the record's own keyVersion selects the key at rest
const password = decryptSecret(project.repoPasswordEnc);
```

```ts
// rotation — all-or-nothing per store; failure reports failedAt for rollback
const result = await rotateStore({
  list: () => Project.find({}).select('_id repoPasswordEnc'),
  swap: (id, next) =>
    Project.updateOne({ _id: id }, { $set: { repoPasswordEnc: next } }),
}, 2);
if (result.failedAt) throw new HttpError(500, 'rotation failed at ' + result.failedAt);
```

```ts
// logging — pino redact block collapses every well-known secret key
export const logger = pino({
  redact: {
    paths: REDACT_PATHS,   // authoritative list in config/logger.ts
    censor: '[REDACTED]',
  },
});
```

```ts
// seeder — idempotent create, never overwrite, never log the password
const existing = await User.findOne({ email });
if (existing) {
  logger.info({ email }, 'superadmin seed: exists, untouched');
  return { status: 'exists' };
}
await User.create({ email, password: await hashPassword(password), role: ROLE_SUPERADMIN });
logger.info({ email }, 'superadmin seed: created');
```

## FORBIDDEN

```ts
// WRONG — plaintext in the DB. A dumped Mongo compromises every project.
project.repoPassword = req.body.repoPassword;
```

```ts
// WRONG — hardcoded / deterministic IV. GCM disaster.
const iv = Buffer.alloc(12, 0);
const cipher = createCipheriv('aes-256-gcm', key, iv);
```

```ts
// WRONG — in-source master-key default; ships as a public constant.
const MASTER = process.env.MASTER_ENCRYPTION_KEY ?? 'dev-key-0123';
```

```ts
// WRONG — pino with no redact block; every headers/body log is a leak.
export const logger = pino({ level: 'info' });

// WRONG — console.log in superadmin/**; bypasses redaction.
console.log('seeded', email, password);
```

```ts
// WRONG — response includes err.stack. Leaks file paths + captured data.
res.status(500).json({ error: { stack: err.stack } });
```

```ts
// WRONG — self-backup password = master key verbatim. A restic subprocess
// stderr capture or a stolen self-backup repo image now yields the master.
new ProcessResticRunner({ password: env.MASTER_ENCRYPTION_KEY });
```

```
# WRONG — subdirectory .env file. Root .env is the single source of truth.
server/.env
client/.env.local
```

## Contract

For every secret-touching path:

1. **Envelope everywhere at rest.** Every persisted secret goes through
   `encryptSecret`; Mongoose schemas declare `type: encryptedSecretSchema`
   (or the shared `hashedSecretSchema` for one-way hashes like agent API
   secrets). No plaintext `password` / `privateKey` / `token` field lands
   in a schema without a `// plaintext-safe: <reason>` annotation
   (bcrypt hashes on `users.password` count as `plaintext-safe: hash`).
2. **Fresh IV per encryption.** `encryptSecret` MUST call
   `crypto.randomBytes(12)` per invocation. Test-only IV injection
   (`__setIvGeneratorForTests`) is the only path to a deterministic IV;
   production callers never override it.
3. **Env-only master key.** `MASTER_ENCRYPTION_KEY` is required by the
   zod schema in `config/env.ts`; a decode-failing key fails startup fast.
   No in-source default, no baked-in dev key.
4. **Rotation contract.** `rotateStore(store, target)`:
   - decrypts with the record's own `keyVersion` (any key registered),
   - re-encrypts under `target`,
   - swaps atomically per record via the caller's `swap` helper,
   - on any swap throw, returns `failedAt` and stops — already-swapped
     records stay valid; un-swapped records stay valid.
   - a re-run at the same `target` is a no-op (records at `target` skip).
5. **pino redaction is the source of truth.** Additions/removals to the
   secret-key allowlist happen in `config/logger.ts::REDACT_PATHS`; the
   meta-test at `shared/middleware/secrets-meta.test.ts` pins the
   required subset so a regression fails the suite. The runtime proof at
   `config/logger-redaction.test.ts` writes a captured line to a
   `Writable` and asserts every well-known secret collapses to
   `[REDACTED]`.
6. **Seeder is idempotent.** `seedSuperadmin` MUST use
   `findOne({ email })` and skip when the account exists — NEVER
   `findOneAndUpdate` with `$set: { password }`. Log lines reference
   the email only.
7. **Never leak stack traces.** `errorHandler` returns
   `{ error: { message } }` — no `stack`, no `NODE_ENV === 'development'`
   escape hatch on the response body. The stack is logged (redacted).
8. **Root `.env` only.** No `.env`, `.env.local`, `.env.production`
   under `client/`, `server/`, or `agent/`.
9. **No hardcoded URLs.** Runtime URLs derive from `CLIENT_URL` /
   `SERVER_URL` / `VITE_API_BASE_URL`. Tests, seed scripts, and static
   marketing docs are the only exceptions (see `site-url-env-pattern.md`).
10. **Self-backup password is derived.** `deriveSelfBackupPassword(
    env.MASTER_ENCRYPTION_KEY)` HMAC-SHA256s the decoded master with a
    fixed domain-separation label — the restic process only ever sees
    the derived string; a restic-subprocess `stderr` capture cannot yield
    the master.

## Escape Hatch

None on the crypto invariants (envelope everywhere, fresh IV,
env-only master key, rotation discipline). A `// plaintext-safe: <reason>`
annotation on a schema field is the ONLY escape hatch — reviewed in code
review, valid only for verifiably non-secret data (bcrypt hashes, opaque
one-way tokens with an out-of-band consumption record, etc.).

## Validation

```bash
# STEP 5 static guards — green:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/secrets-meta.test.ts \
                 src/shared/middleware/secrets-response.test.ts \
                 src/config/logger-redaction.test.ts

# ESLint gate — no `console.*` inside modules/superadmin/**:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint

# Grep smoke tests (should all return nothing):
grep -rn "console\.\(log\|error\|warn\|info\|debug\)" server/src/modules/superadmin --include='*.ts' | grep -v '\.test\.'
find client server agent -name '.env*' -not -name '.env.example' 2>/dev/null
grep -rnE "password:\s*env\.MASTER_ENCRYPTION_KEY" server/src --include='*.ts'
```

All must return clean / green.

## Checklist

- [ ] Every persisted secret is an `EncryptedSecret` envelope; no
      plaintext schema field without `// plaintext-safe: <reason>`.
- [ ] `encryptSecret` uses a fresh random 12-byte IV per call.
- [ ] `MASTER_ENCRYPTION_KEY` is required by `config/env.ts`; no default.
- [ ] `rotateStore` covers happy / idempotent / mid-run-failure paths.
- [ ] `config/logger.ts` exports `REDACT_PATHS`; pino runtime redacts
      Authorization / Cookie / password / token / envelope / envs.
- [ ] `errorHandler` returns no `stack` in the response body.
- [ ] `boot/recovery.ts` derives the self-backup password via
      `deriveSelfBackupPassword`, never `env.MASTER_ENCRYPTION_KEY`
      directly.
- [ ] `modules/superadmin/superadmin.seed.ts` is idempotent, no
      `console.*`, no password in the log line.
- [ ] Only root `.env` (+ `.env.example`) exists in the repo tree.
- [ ] Meta-tests at `secrets-meta.test.ts` +
      `logger-redaction.test.ts` + `secrets-response.test.ts` stay green.
