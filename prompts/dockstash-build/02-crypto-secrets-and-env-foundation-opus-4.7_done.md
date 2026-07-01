# Crypto Secrets-at-Rest & Env Foundation — Build Prompt

> **Give Dockstash a secure secrets backbone** — an AES-256-GCM encrypt-at-rest
> helper keyed by a `MASTER_ENCRYPTION_KEY` (zod-validated, fail-hard on startup),
> with a `keyVersion` field for rotation — and extend the env schema +
> `.env.example` with every new Polar / Resend / encryption / alerting variable.
> Consumed by billing (encrypt Polar secrets) and backup (encrypt SSH key + restic
> password).

---

## Agent

`security-auditor` (owns the crypto helper under `server/src/shared/crypto/`, the
key-rotation contract, and the no-log/no-leak discipline). Coordinate with
`typescript-pro` (the typed encrypt/decrypt record types and the zod extensions in
`server/src/config/env.ts`).

## Mission

Per `IDEA.md` §1 "Secrets at rest" + the §3 env-var list, the restic repo
password and the storage-VPS SSH private key must **never** be stored plaintext in
Mongo. Build the foundation:

1. An **AES-256-GCM** encrypt-at-rest helper keyed by `MASTER_ENCRYPTION_KEY`
   (min 32 bytes, zod-validated; the process **fails hard on startup** if it is
   missing or too short).
2. A typed API — `encryptSecret(plaintext)` → `{ ciphertext, iv, authTag,
   keyVersion }`, `decryptSecret(record)` → plaintext — with a `keyVersion` field
   and a documented **master-key rotation** path (decrypt-with-old → re-encrypt →
   atomic swap). **Never log decrypted values.**
3. The full **env schema extension** in `server/src/config/env.ts` + root
   `.env.example` for all new vars, marked required vs optional so the Free /
   self-host tier runs **without** Polar or Resend configured (per `IDEA.md` §4).

## Operating Constraints

| Rule | Detail |
|---|---|
| Algorithm | AES-256-GCM only. 12-byte random IV per encryption (`crypto.randomBytes(12)`); store the 16-byte GCM auth tag. No ECB/CBC, no static IV, no home-rolled crypto — Node `crypto` stdlib. |
| Key handling | Derive the 32-byte key from `MASTER_ENCRYPTION_KEY`; reject (`throw` at startup) if it decodes to < 32 bytes. The key lives in memory only; never persisted, never logged. |
| Fail hard | Validation happens in the zod schema in `server/src/config/env.ts`; a misconfigured key crashes startup with a clear message (existing pattern — `env` parsed once, throws on invalid). |
| No leak | Never `console.log` / `logger.*` a plaintext or a derived key. Decrypt only in-process at the moment of use; do not return decrypted secrets to any client. Mirror pulsy's boundary discipline (`IDEA.md` §1). |
| Rotation | Every encrypted record carries `keyVersion`. Document the re-encrypt path (new key → decrypt with old `keyVersion` → re-encrypt at new version → atomic swap). `decryptSecret` selects the key by the record's `keyVersion`. |
| Env from root only | All new vars added to the single zod schema in `server/src/config/env.ts` and documented in root `.env.example`. No subdirectory `.env`. See `.claude/rules/environment-variables.md`. |
| Optional vs required | Polar/Resend vars are **optional** (Free/self-host must boot without them). `MASTER_ENCRYPTION_KEY` is **required** (min 32). Make this explicit in the zod schema with `.optional()` vs required. See `IDEA.md` §4. |
| Named + typed | The helper exports named functions and a typed `EncryptedSecret` record. Any Mongoose sub-schema embedding the record uses `InferSchemaType`. See `.claude/rules/mern-no-default-exports.md`, `.claude/rules/mern-mongoose-typed-schemas.md`. |
| i18n | Any user-facing failure surfaced through HTTP uses an `errors.*` key from the `01-*` i18n layer; the startup crash message is internal/log-only and need not be localized. |
| Excluded | No KMS/HSM integration, no envelope encryption with per-record DEKs (single master key + `keyVersion` is the spec), no secret-rotation scheduler (document the path; automation is later). |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/config/env.ts` (the zod `env` object + exported `Env`
  type; how it parses once at import and throws on invalid). Note the existing
  vars: `NODE_ENV`, `PORT(8080)`, `MONGODB_URI`, `JWT_SECRET(min32)`,
  `SESSION_SECRET`, `CLIENT_URL`, `SERVER_URL`, `STRIPE_SECRET_KEY`,
  `SENDGRID_API_KEY`, `MAILGUN_PRIVATE_KEY`, `MAILGUN_DOMAIN`,
  `MAILCHIMP_API_KEY`, `LOG_LEVEL`.
- 0.2 Read `server/src/shared/utils/http-error.ts` (`HttpError` factories) and
  `server/src/shared/utils/` layout to choose where `crypto/` sits as a sibling.
- 0.3 Read `server/src/config/logger.ts` to confirm the logger and ensure the
  crypto module never receives a secret to log.
- 0.4 Identify downstream consumers to keep the API shape right: billing (will
  encrypt Polar access token / webhook secret) and the future backup module (SSH
  private key + restic password). Design `EncryptedSecret` to embed cleanly as a
  Mongoose sub-document.

### Phase 1 — Env schema extension
Add to the zod schema in `server/src/config/env.ts` (and document each in root
`.env.example` with a comment + section header):
- 1.1 **Required:** `MASTER_ENCRYPTION_KEY` — string, refined to decode to ≥ 32
  bytes (hex or base64); the refinement throws on startup if short/missing.
- 1.2 **Payments (optional — Free/self-host boots without them):**
  `PAYMENT_PROVIDER` (enum, default the OSS-safe value), `POLAR_ACCESS_TOKEN`,
  `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` (sandbox|production), `POLAR_PRO_PRODUCT_ID`,
  `POLAR_BUSINESS_PRODUCT_ID` — all `.optional()`.
- 1.3 **Email (optional):** `RESEND_API_KEY`, `RESEND_FROM` — `.optional()`.
- 1.4 **Alerting (optional, with sane default):** `ALERT_HEARTBEAT_HOURS` —
  coerced number, default per spec.
- 1.5 Keep existing vars untouched. Ensure the parse still throws hard on any
  required-var failure (preserve the current fail-fast behavior).

### Phase 2 — Crypto helper
New `server/src/shared/crypto/` (named exports only):
- 2.1 `EncryptedSecret` type: `{ ciphertext: string; iv: string; authTag:
  string; keyVersion: number }` (base64 fields). Export it for reuse in Mongoose
  sub-schemas via `InferSchemaType`.
- 2.2 `encryptSecret(plaintext: string): EncryptedSecret` — random 12-byte IV,
  `aes-256-gcm`, capture `authTag`, stamp the current `keyVersion`.
- 2.3 `decryptSecret(record: EncryptedSecret): string` — select the key by
  `record.keyVersion`, verify the auth tag (a tampered tag/ciphertext **throws**),
  return plaintext. Never log inputs or outputs.
- 2.4 Key resolution: a small internal key registry mapping `keyVersion → 32-byte
  key`. `keyVersion 1` derives from `MASTER_ENCRYPTION_KEY`. Document how a
  rotation adds the new key at the next version while keeping the old for
  decrypt-then-re-encrypt.
- 2.5 `reEncryptSecret(record, targetKeyVersion)` (or document the manual path):
  decrypt at the record's version, re-encrypt at the target version, return a new
  record — the building block for the rotation/escrow flow (`IDEA.md` §1).

### Phase 3 — Wiring & boundaries
- 3.1 Ensure `env` validation runs at the existing import-time entry so a
  short/missing `MASTER_ENCRYPTION_KEY` crashes startup before any route mounts.
- 3.2 Provide an injectable seam: the key registry/clock for IV are mockable in
  tests (so encryption is deterministic under test) without weakening prod
  randomness. No change to `app.ts`/`server.ts` route surface in this phase.

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage,
`startMemoryMongo`/`stopMemoryMongo`/`clearCollections` available, supertest where
a route is involved): **100% coverage target**
(lines/branches/functions/statements).
- **Round-trip:** `decryptSecret(encryptSecret(s)) === s` for ASCII, unicode,
  empty string, and long (multi-KB) plaintexts.
- **Tamper detection:** flipping a byte of `ciphertext` or `authTag` makes
  `decryptSecret` **throw** (GCM auth failure); a swapped `iv` throws.
- **Wrong key:** decrypting a record produced under a different master key throws,
  never returns garbage silently.
- **keyVersion preserved:** `encryptSecret` stamps the current version;
  `decryptSecret` honors the record's version; `reEncryptSecret` migrates a v1
  record to v2 and the v2 record round-trips.
- **Env schema:** a `MASTER_ENCRYPTION_KEY` shorter than 32 bytes makes the schema
  parse **throw**; a valid key passes; Polar/Resend vars absent → schema still
  parses (Free/self-host boots); a present-but-malformed required var fails.
- **No-leak guard:** assert (spy on the logger) that encrypt/decrypt never log
  plaintext or key material.
- Use injectable IV/key seams so ciphertext is deterministic in the round-trip
  assertions.

### i18n
No new user-facing UI strings here. Any HTTP-surfaced failure (e.g. a future
billing route that fails to decrypt) must use an `errors.*` key from the `01-*`
i18n layer in all 7 locales (en, ar, fr, de, es, ru, zh) — do not hardcode
English. The startup fail-hard message is log-only/internal and exempt. If this
phase introduces any such error key, add it to all 7 locales and extend the `01-*`
parity test.

### Documentation
- Internal (developer-facing → `en` acceptable): a "Secrets at rest & master-key
  rotation" doc under the crypto module — the AES-256-GCM record shape, the
  `keyVersion` model, and the exact rotation/escrow runbook (new key → decrypt old
  → re-encrypt → atomic swap), plus the "losing the key = unrecoverable" warning
  from `IDEA.md` §1.
- `.env.example`: a clearly sectioned block (Encryption / Payments / Email /
  Alerting) documenting every new var, which are required vs optional, and the
  key-length requirement. Root-only per `.claude/rules/environment-variables.md`.
- `CLAUDE.md` / changelog: note the new required `MASTER_ENCRYPTION_KEY` and the
  optional Polar/Resend vars.

## Agents & Skills

- **Agents:** `security-auditor` (primary — crypto correctness, no-leak
  discipline, rotation contract), `typescript-pro` (typed `EncryptedSecret`
  record, zod env extensions, `InferSchemaType` embedding).
- **Skills:** `security-review` (AES-256-GCM usage, IV/tag handling, no-fallback-
  secret check, key-length gate); `spec-driven-development` (rotation/escrow
  runbook); `code-review` (final pass); `verify` (round-trip + tamper + env-fail
  exercised end-to-end).

## Idempotency Contract

Re-running MUST NOT: add a new env var twice to the zod schema or `.env.example`
(detect existing key and skip); create a second crypto module; change the
`EncryptedSecret` field shape once consumers exist; or re-document the rotation
runbook as a duplicate section. Reconcile the env schema, the crypto helper, and
the docs **in place** so every run converges to the same state — and never weaken
the `MASTER_ENCRYPTION_KEY` min-32 gate or the optional/required split on a re-run.
