# Security model & threat model

This document describes the hardening pass added in prompt 11 (IDEA.md §1) and
the blast radius of the Dockstash orchestrator.

## App-layer hardening

| Concern | Control | Where |
|---------|---------|-------|
| Common HTTP headers | `helmet()` (defaults, `crossOriginResourcePolicy: same-site`, `referrerPolicy: no-referrer`) | `shared/middleware/security-headers.ts` |
| Credential-stuffing on `/api/auth/*` | `express-rate-limit`, default 10 req / 15 min per IP (`RATE_LIMIT_AUTH_*`) | `shared/middleware/rate-limit.ts` |
| Webhook flood before signature check | `express-rate-limit`, default 120 req / min per IP; runs BEFORE `express.raw` — never consumes the body used for HMAC verify | `shared/middleware/rate-limit.ts` + `app.ts` |
| CORS | Locked to exactly `env.CLIENT_URL` with `credentials: true` — no wildcard, no reflected origin | `app.ts` |
| CSRF (cookie-borne auth surfaces) | Double-submit cookie + header (`x-csrf-token`); safe methods pass; bearer-token requests exempt (documented below); mutating cookie surfaces reject on missing/mismatched token | `shared/middleware/csrf.ts` |
| Body validation | Every mutating route parses its body via a per-module zod schema. New routes must add one under `<module>.schema.ts` before wiring |

### Bearer-token CSRF exemption

The Passport JWT strategy extracts credentials from
`Authorization: JWT <token>`. When the request carries an `Authorization`
header, CSRF is a non-issue: the browser never attaches that header
cross-origin without explicit code. `requireCsrf` therefore skips those
requests. A future cookie-authenticated surface MUST call
`GET /api/security/csrf-token` first and echo the token in the
`x-csrf-token` header on the mutating request.

## Transport / key trust

- **SSH host-key pinning** — every `SshTransport` implementation MUST expose
  `verifyHostKey`. `PinnedSshTransport`
  (`modules/backups/backups.ssh-transport.ts`) pins the storage-VPS host key
  in `sha256:BASE64` form via `STORAGE_SSH_HOST_KEY_FINGERPRINT` and throws
  on mismatch. No `StrictHostKeyChecking=no`, no auto-accept. A rotated host
  key surfaces as a loud backup failure.
- **Restic-password escrow** — the plaintext restic password is shown once at
  storage setup (prompt 10 UI). The server stores only its AES-256-GCM
  ciphertext (`repoPasswordEnc`, prompt 03). The plaintext is never persisted,
  logged, or returned by any route.
- **Master-key rotation** — `shared/crypto/rotate.ts::rotateStore` iterates
  every ciphertext under a store, decrypts with the stored `keyVersion`, and
  re-encrypts under the new target. Failure stops rotation and reports
  `failedAt`; already-swapped records are idempotent because
  `reEncryptSecret` short-circuits when `record.keyVersion === target`. See
  `server/src/shared/crypto/README.md` for the operator runbook.

## Docker socket least-privilege

- The `api` container reaches Docker exclusively via `DOCKER_HOST=tcp://docker-socket-proxy:2375`. It never bind-mounts `/var/run/docker.sock`.
- The `docker-socket-proxy` service is the only container with the socket, mounted `:ro`. Endpoints are limited to `CONTAINERS`/`EXEC`/`INFO`; everything else is denied.
- The `api` and `docker-socket-proxy` services carry `cap_drop: [ALL]` and `security_opt: [no-new-privileges:true]`.

## Blast radius / threat model

The `api` container is root-equivalent inside the Docker network: it reads
`/var/www` (read-only), holds a JWT signing secret, and can `exec` into any
tracked container via the socket-proxy. Mitigations:

- **Least privilege on Docker** — the proxy scopes the socket to the
  minimum set of endpoints the backup engine needs.
- **Read-mostly `/var/www`** — the api mounts it `:ro` for scan operations.
- **Path-traversal guards** — `backups.paths.ts::isAllowedProjectPath` +
  `assertAllowedPath` reject any path outside `ALLOWED_PATH_ROOT`.
- **Secrets encrypted at rest** — every provider token / restic password is
  wrapped in an AES-256-GCM envelope keyed by `MASTER_ENCRYPTION_KEY`.
- **Crown jewels** — the storage VPS holds the only copy of restic repos
  offsite. Its SSH host key is pinned. Loss of `MASTER_ENCRYPTION_KEY`
  makes every ciphertext in Mongo unrecoverable; back it up out-of-band.

## Legal hold

`Project.legalHold` (`modules/backups/backups.model.ts`) and `User.legalHold`
(`modules/users/users.model.ts`) both default to false. When set:

- The retention `forget --prune` job (`scheduler.prune.service.ts`) returns
  early with a `security.legalHold.pruneSkipped` message — no snapshots are
  deleted.
- The account-deletion purge (`legal.service.ts::purgeAccount`) refuses to
  proceed on a held user and skips any held project.

## What is out of scope

No WAF, no SIEM, no pen-test engagement, no tax engine — Polar is the
Merchant of Record for VAT/GST (see `polar-billing-and-webhooks.en.md`).
