# Surface #7 — Secrets & Data-at-Rest — Build Prompt

> **Closes findings under threat surface #7 of `prompts/SECURITY.md`.** Owns
> the AES-256-GCM envelope discipline (`encryptSecret`/`decryptSecret`, no IV
> reuse, `MASTER_ENCRYPTION_KEY` never hardcoded), master-key rotation
> (`keyRegistry.ts` + `rotateStore`), pino redaction completeness, the
> superadmin-seeder idempotency + log redaction, and the no-`.env`-outside-
> root / no-hardcoded-URL discipline. Implements STEP 2 → STEP 3 → STEP 4 →
> STEP 5 for this surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `typescript-pro` for
the crypto typing and `backend-dev` for the rotation + seeder plumbing. Run
`00-recon-findings` FIRST and read its surface-#7 rows.

## Mission

For every Critical/High finding under surface #7 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs/observations: a route returning a secret, a log
   line containing a secret, a reused IV, a hardcoded key, a `.env` outside
   root, a hardcoded URL.
2. Fix: plaintext → AES-256-GCM envelope; unique IV per encryption;
   `MASTER_ENCRYPTION_KEY` from env only; extend pino redaction; tighten the
   superadmin seeder; remove subdirectory `.env`/hardcoded URLs.
3. Add supertest/unit tests: no route returns a secret; no log line leaks a
   secret; rotation re-encrypts + bumps keyVersion + rolls back on failure.
4. Add a STEP 5 meta-guard: "no plaintext secret field is persisted" + "pino
   redaction covers the secret-keys allowlist".

## Operating Constraints

| Rule | Detail |
|---|---|
| AES-256-GCM envelope | Restic repo passwords, SSH keys, and any at-rest secret go through `shared/crypto` `encryptSecret`/`decryptSecret`, keyed by `MASTER_ENCRYPTION_KEY`. Never plaintext, never a hardcoded key, never a reused IV. |
| Rotation | `keyRegistry.ts` + `rotate.ts::rotateStore`: decrypt-with-old → re-encrypt-with-new → atomic swap, bumping `keyVersion`. Re-encrypt is idempotent when `keyVersion == target`. Failure rolls back (all-or-nothing). |
| Shown once | The plaintext restic password is shown once at storage setup/rotation and NEVER persisted/logged/returned again. |
| pino redaction | `config/logger.ts` redaction paths cover `Authorization`, cookies, JWTs, passwords, `SUPERADMIN_PASSWORD`, `POLAR_*` creds, agent Bearer tokens, `MASTER_ENCRYPTION_KEY`, SSH keys, OTP codes, CSRF secrets, password-reset tokens. No secret in logs, thrown error messages, or recorded fixtures. |
| Seeder | `modules/superadmin/superadmin.seed.ts` is idempotent, never overwrites an existing account, redacts the password from every log line. |
| Env + URLs | Root `.env` only (`environment-variables.md`); no hardcoded URLs (`site-url-env-pattern.md`); no `localhost`/domain in source outside the allowed exceptions. |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | Any new error (e.g. rotation-failed admin message) is a key in ALL 7 dictionaries. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#7 rows. Read
  `prompts/SECURITY.md` § "7. SECRETS & DATA-AT-REST".
- 0.2 Read `server/src/shared/crypto/{encryptSecret,decryptSecret,keyRegistry,
  rotate}.ts` end-to-end. Confirm AES-256-GCM, random IV per call, key
  versioning, idempotent re-encrypt, atomic rollback.
- 0.3 Read `server/src/config/logger.ts` — the pino redaction paths list.
- 0.4 Read `modules/superadmin/superadmin.seed.ts`. Grep for any
  `console.log`/`logger.*` that could emit the password.
- 0.5 Grep for plaintext secret fields in Mongoose schemas (restic password,
  SSH key, agent secret). Grep for `.env` outside repo root, hardcoded
  `localhost`/domains, `MASTER_ENCRYPTION_KEY` literals.

### Phase 1 — Adversarial inputs/observations (STEP 2)
For each finding, write ≥5 probes:
- A `GET` on a project/agent/storage endpoint — assert the response includes
  a plaintext secret today (finding), only ciphertext/omitted after fix.
- A log line emitted during a backup/rotation/login flow — assert it contains
  a secret today (finding), absent after fix.
- Two encryptions of the same plaintext — assert the IV is identical today
  (finding — IV reuse), different after fix.
- A `MASTER_ENCRYPTION_KEY` literal in source (or a default fallback) — assert
  it exists today (finding), env-only after fix.
- A `.env` in `client/` or `server/` (or any subdirectory) — assert it exists
  today (finding), removed after fix (vars consolidated to root `.env`).
- A hardcoded `http://localhost:PORT` or domain in source (outside test/
  seed/docs exceptions) — assert it exists today (finding), env-derived after
  fix.

### Phase 2 — Fix (STEP 3)
- 2.1 **Envelope discipline**: every plaintext secret field becomes an
  `{ ciphertext, iv, keyVersion }` envelope via `encryptSecret`. The model's
  `toJSON`/`toObject` transform OMITS the envelope from any response. The
  plaintext is shown exactly once (storage setup / rotation) and never
  persisted/logged.
- 2.2 **IV uniqueness**: confirm `encryptSecret` generates a fresh random IV
  per call (`crypto.randomBytes(12)` for GCM). If a deterministic IV is found,
  replace. Add a unit test that two encryptions of the same plaintext yield
  different ciphertexts + IVs.
- 2.3 **Key from env only**: `MASTER_ENCRYPTION_KEY` is read from the zod-
  parsed env (`config/env.ts`); no in-source default that could be committed.
  If unset, the server fails fast at boot with a clear localized admin error
  (do NOT silently fall back to a dev key in production).
- 2.4 **Rotation**: confirm `rotateStore` decrypts with the old key, re-
  encrypts with the new, bumps `keyVersion`, and on ANY mid-rotation failure
  rolls back leaving the old ciphertext intact. The rotation is idempotent
  (re-running with `keyVersion == target` is a no-op). Add an admin route
  guarded by `requireRole(ROLE_SUPERADMIN)` if one doesn't exist.
- 2.5 **pino redaction**: extend the redaction paths to cover every secret
  key the audit found un-redacted (the full list in § Operating Constraints).
  Confirm the redaction applies to BOTH the request logger (`pinoHttp`) and
  any thrown-error logging path.
- 2.6 **Seeder**: `superadmin.seed.ts` uses `findOneAndUpdate(..., {
  upsert: true, $setOnInsert: { password: hashed } })` (or equivalent) so a
  re-seed NEVER overwrites an existing account. The seeder's log lines
  reference the email but NEVER the password (assert via a captured pino
  destination in the test).
- 2.7 **Env + URLs**: remove any subdirectory `.env` (consolidate vars to
  root `.env` + the zod schema in `config/env.ts`); replace any hardcoded
  `localhost`/domain in source with `SERVER_URL`/`CLIENT_URL`/`site-config`
  helpers (outside test/seed/docs exceptions — `site-url-env-pattern.md`).

### Phase 2 — Reference fix shapes (illustrative — match the repo's real types)

```ts
// encryptSecret — a FRESH random 12-byte IV per call (GCM); returns an envelope
export function encryptSecret(plain: string): SecretEnvelope {
  const iv = crypto.randomBytes(12);                      // NEVER reuse / hardcode an IV
  const cipher = crypto.createCipheriv('aes-256-gcm', currentKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    keyVersion: currentKeyVersion(),                      // enables idempotent rotation
  };
}

// model — strip the envelope from EVERY response (toJSON transform)
schema.set('toJSON', { transform: (_doc, ret) => { delete ret.repoPasswordEnc; return ret; } });

// logger.ts — pino redaction covers every secret key
export const logger = pino({
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', '*.password', '*.token',
      'MASTER_ENCRYPTION_KEY', 'SUPERADMIN_PASSWORD', '*.apiKeyHash', '*.repoPassword',
    ],
    censor: '[REDACTED]',
  },
});

// superadmin.seed.ts — idempotent; never overwrite an existing account; never log the password
await SuperAdmin.updateOne(
  { email: env.SUPERADMIN_EMAIL },
  { $setOnInsert: { email: env.SUPERADMIN_EMAIL, passwordHash: await bcrypt.hash(env.SUPERADMIN_PASSWORD, 12) } },
  { upsert: true },                                       // re-seed is a no-op, hash never rewritten
);
logger.info({ email: env.SUPERADMIN_EMAIL }, 'superadmin ensured');  // email only — no password
```

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server;
capture pino via a destination stream):
- **No secret in response**: a `GET` on a project/agent/storage endpoint —
  assert the response body does NOT contain the plaintext restic password,
  SSH key, or agent secret; assert it returns at most `{ ciphertext, iv,
  keyVersion }` (or omits the envelope entirely). State fail-before status.
- **No secret in logs**: trigger a backup/rotation/login flow with a captured
  pino destination — assert NO log line contains the password, JWT, OTP,
  `MASTER_ENCRYPTION_KEY`, SSH key, agent Bearer, or `SUPERADMIN_PASSWORD`.
- **IV uniqueness**: two `encryptSecret('same')` calls → different IV +
  different ciphertext. A regression to a deterministic IV fails this.
- **Key from env**: with `MASTER_ENCRYPTION_KEY` unset, the server boot
  fails fast (the test asserts `createApp()`/`server.start()` throws a
  localized admin error).
- **Rotation**: seed N encrypted secrets at `keyVersion=1`; run rotation to
  `keyVersion=2`; assert all secrets are re-encrypted, all `decryptSecret`
  calls succeed with the new key, `keyVersion==2` everywhere. Inject a
  mid-rotation failure (e.g. a corrupted ciphertext) → assert rollback
  leaves the old ciphertext intact and `keyVersion` unchanged. Re-run
  rotation → idempotent (no double-re-encrypt).
- **Seeder idempotency**: run the seeder twice — assert the superadmin
  account is created ONCE, the password hash is NOT overwritten on the second
  run, and NO log line contains the password.
- **No subdirectory `.env` / no hardcoded URL**: a meta-style unit test (or
  the repo-wide grep turned into a test) asserts no `.env` exists under
  `client/` or `server/`, and no source file outside the exceptions contains
  `localhost:`/a hardcoded domain.

### Phase 4 — Prevent (STEP 5)
- a) **Meta-test**: "every Mongoose schema field whose name matches
  `/password|secret|key|token/i` is either an `{ ciphertext, iv, keyVersion }`
  envelope OR explicitly annotated `// plaintext-safe: <reason>` (e.g. a
  hash, not a secret)". Scan the schemas; FAIL on a plaintext secret without
  the annotation.
- b) **Meta-test**: "the pino redaction paths list in `config/logger.ts`
  contains the secret-keys allowlist (`req.headers.authorization`,
  `req.cookies.*`, `*.password`, `*.token`, `SUPERADMIN_PASSWORD`,
  `MASTER_ENCRYPTION_KEY`, …)". A static scan that fails on regression.
- c) **ESLint `no-restricted-syntax`**: ban `console.log` in
  `modules/superadmin/**` (force the redacted logger).
- d) **Repo-wide meta-test**: no `.env` file under `client/` or `server/`
  (the existing `.gitignore` covers `.env`; add a test that fails if one
  appears). No `localhost:`/hardcoded-domain literal in source outside the
  `site-url-env-pattern.md` exceptions.
- e) Add `.claude/rules/secrets-and-rotation.md` (MANDATORY REQUIREMENT
  header, Correct/Forbidden examples, Validation Checklist) and a one-line
  entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5. Cross-reference
  `docs/security-model.en.md`.

## Coverage & Success Gate — NON-NEGOTIABLE

This surface is DONE only when, **inside Docker**, the suite is 100% passing and
v8 coverage is **100% on lines / branches / functions / statements** for the code
this prompt touched:

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run --coverage
```

Hard requirements:
- Every fix ships a test that FAILS before the change and PASSES after — stated per test.
- Rotation coverage must hit the happy path, the idempotent re-run (`keyVersion == target`),
  AND the mid-rotation failure → rollback branch. IV-uniqueness, no-secret-in-response, and
  no-secret-in-logs each get an explicit assertion. The key-missing-at-boot throw is covered.
- No `.skip`/`.only`, no lowered `vitest.config.ts` thresholds, no `/* c8 ignore */`,
  no `eslint-disable`, no `@ts-ignore` to reach green (`docs/ci-gates.en.md`).
- If a line is genuinely unreachable, delete/refactor it — never ignore it.
- The 7-locale i18n parity test stays green (every new key in en/ar/fr/de/es/ru/zh).
- Re-run until green AND 100%. A red or sub-100% run is not "almost done" — it is not done.

## i18n

Any admin-facing rotation/seeder error (rotation-failed, key-missing-at-boot)
is a key in ALL 7 server dictionaries + client locale files where rendered.
Parity test green. RTL for `ar`.

## Documentation

- `docs/security-model.en.md` — annotate the AES-256-GCM envelope, IV
  uniqueness, key-from-env-only, master-key rotation + rollback + idempotency,
  pino redaction allowlist, seeder idempotency, and the no-subdirectory-`.env`
  / no-hardcoded-URL rules.
- `.env.example` — confirm `MASTER_ENCRYPTION_KEY` + `STORAGE_SSH_HOST_KEY_
  FINGERPRINT` + all `POLAR_*`/`RESEND_*` documented (root only).
- `CLAUDE.md` §5 — reference the new rule file.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `typescript-pro` (crypto
  typing); `backend-dev` (rotation + seeder plumbing).
- **MCP:** `code-review-graph` `get_impact_radius_tool` on `shared/crypto`
  (`encryptSecret`/`decryptSecret`/`rotateStore`) before editing — every
  at-rest secret path flows through it, so a change there fans out widely.
- **Skills:** `/security-review` `secrets` mode (deep semantic pass —
  **required** before merge); `code-review` (final diff pass — assert no
  plaintext secret field without annotation, no `console.log` of a secret, no
  `MASTER_ENCRYPTION_KEY` literal, no subdirectory `.env`).

## Idempotency Contract

Re-running MUST NOT: re-envelope an already-enveloped field (detect
`{ ciphertext, iv, keyVersion }` and skip), re-add an IV-uniqueness guard
that exists, re-extend the redaction list with paths already present, re-seed
an existing superadmin, re-create the rotation route, or duplicate the
meta-tests / ESLint rule. Detect existing controls and reconcile in place. A
re-run that finds the surface clean appends "re-verified YYYY-MM-DD — surface
#7 clean" to `findings.md`. Findings fixed here are annotated with `— FIXED
at file:line (prompt 07)` for `09`'s report.
