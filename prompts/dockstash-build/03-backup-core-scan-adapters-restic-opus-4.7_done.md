# Backup Core — scanProject, Adapters & Restic Orchestration — Build Prompt

> **Turn a `/var/www/<project>` Docker folder into a safe, restorable Restic
> backup** — detect what to back up (files, databases, proxy configs), dump live
> databases through their containers (never copy a live DB file), and stream every
> dump straight into Restic over injectable, command-injection-proof boundaries.

---

## Agent

`backend-dev` (primary — owns the new `server/src/modules/backups/` module, the
adapter registry, and the Restic/Docker/SSH orchestration). Coordinate with
`typescript-pro` for the injectable-interface typing (`ResticRunner`,
`DockerClient`, `SshTransport`) and the `InferSchemaType` model exports.

This is the build-phase-2 foundation in `IDEA.md` ("Backup core"). It depends on
prompts `00` (Docker stack + demo-feature strip), `01` (i18n foundation), and
`02` (`server/src/shared/crypto/` AES-256-GCM helper). Do not re-add anything
those prompts deliver.

## Mission

`IDEA.md` Part A defines `scanProject(projectPath)` and an adapter pattern; Part B
§2 demands injectable boundaries; §6 demands per-project atomicity and disk-space
safety. Build the module that makes all of it real:

1. **`scanProject(projectPath)`** — parse `docker-compose.yml`, return a typed
   `plan { paths, databases[], configs[] }` with one adapter-resolved entry per
   database service and detected reverse-proxy config paths.
2. **Adapter registry** — `postgres`, `mysql`/`mariadb`, `mongo`, each exposing
   `match(image)`, `dumpCmd(svc)`, `restoreCmd(svc)` returning **argument arrays**.
3. **Backup orchestration** — for each layer, `docker exec <container> → dump`
   piped into `restic backup --stdin --stdin-filename`, plus `restic backup` of
   project paths and proxy config paths, under injectable runners.
4. **`Project` model + ownership** — Mongoose `Project` (owner, path, plan,
   encrypted Restic repo password ref), every route behind `requireAuth` with a
   per-user ownership check.
5. **Safety guards** — `/var/www/*` path allowlist (traversal guard), argument
   arrays everywhere (injection guard), per-project atomicity (any layer fails →
   snapshot `failed`, never partial).

## Operating Constraints

| Rule | Detail |
|---|---|
| Never back up a live DB file | Databases are captured **only** via `docker exec <container> → native dump → restic --stdin`. Reading a DB data dir from disk is forbidden — it is the single most important correctness rule (`IDEA.md` Part A). |
| Argument arrays only | Every `docker exec` and every `restic` invocation runs via `dockerode` exec / `child_process` with an **argument array** — never a string-interpolated shell, never `sh -c "<interp>"` with user data. Adapter `dumpCmd`/`restoreCmd` return `string[]`, asserted in tests (`IDEA.md` §1 command-injection guard). |
| Path allowlist | Validate every project path against a `/var/www/*` allowlist and reject `..`/symlink traversal **before** the path reaches restic or dockerode (`IDEA.md` §1). |
| Injectable boundaries | Define `ResticRunner`, `DockerClient`, `SshTransport` interfaces; orchestration depends only on the interfaces so unit tests inject mocks. No direct `child_process`/`dockerode` calls in service logic (`IDEA.md` §2). |
| Secrets at rest | Restic repo password + storage SSH key are stored AES-256-GCM-encrypted via `encryptSecret`/`decryptSecret` (`server/src/shared/crypto/`, prompt 02), keyed by `MASTER_ENCRYPTION_KEY`. Decrypt only in-process at invocation; never log or return decrypted values. |
| Stream, don't spool | Prefer stream dump → `restic --stdin` over a temp file (disk-space safety, `IDEA.md` §6). Out-of-space mid-dump must fail cleanly. |
| Per-project atomicity | If any layer fails, the snapshot is marked `failed`, never partial-success. No false green. |
| Ownership | Every project/backup route is `userId`-scoped; cross-user access throws `HttpError.forbidden()` (`shared/utils/http-error.ts`). |
| Env | New vars (`MASTER_ENCRYPTION_KEY` if not added by 02, storage host) flow through `server/src/config/env.ts` zod schema + `.env.example`. No subdirectory `.env`. |
| Named exports + typed schemas | No `export default`; `Project` uses `InferSchemaType` + named export (repo rules `mern-no-default-exports.md`, `mern-mongoose-typed-schemas.md`). |

## Phases

### Phase 0 — Map the model
- 0.1 Read an existing module end-to-end as the template:
  `server/src/modules/users/` (`*.controller.ts`, `*.service.ts`, `*.model.ts`,
  `*.schema.ts`, `*.routes.ts`, `index.ts`) and how `server/src/app.ts`
  `createApp()` mounts routers via `app.use('/api/<name>', <name>Router)`.
- 0.2 Read `server/src/shared/middleware/require-auth.ts` (how `req.user` is
  populated), `server/src/shared/utils/http-error.ts` (`.badRequest/.forbidden/
  .notFound/.conflict/.internal`), `server/src/shared/utils/async-handler.ts`,
  and `server/src/shared/crypto/` (prompt 02 — `encryptSecret`/`decryptSecret`).
- 0.3 Read `server/src/config/env.ts` (zod env) and the i18n `t(key, vars)` +
  `req.language` helper (prompt 01) — backup errors/messages must localize.
- 0.4 Decide the module name: **`backups`** (the orchestration module; the
  `Project` entity lives inside it). Confirm no `modules/backups/` exists yet.

### Phase 1 — Schema & model
New `server/src/modules/backups/`:
- 1.1 `backups.model.ts` — Mongoose `Project` schema, `{ timestamps: true }`:
  `owner` (ObjectId ref `User`, required, indexed), `name`, `path` (required,
  `/var/www/*`), `plan` (subdoc: `paths: string[]`, `databases: [{ service, type,
  container, enabled }]`, `configs: string[]`), `repoPasswordEnc` (encrypted ref
  blob from the crypto helper — never plaintext), `lastStatus`
  (`enum: ['idle','running','success','failed']`). Export `Project` +
  `type ProjectDocument = InferSchemaType<typeof projectSchema>` (named exports).
- 1.2 `backups.schema.ts` — zod request bodies: `scanProjectSchema`
  (`{ path }`), `createProjectSchema`, `runBackupSchema` (`{ projectId }`),
  `updatePlanSchema`. Validate `path` against the `/var/www/*` allowlist regex
  here AND defensively in the service (defense in depth).

### Phase 2 — Adapters & scanProject (pure, fully unit-testable)
- 2.1 `backups.adapters.ts` — adapter registry. Each adapter:
  `{ type, match(image): boolean, dumpCmd(svc): string[], restoreCmd(svc):
  string[] }`. Return **argument arrays**:
  - `postgres` — `match: /postgres/`; dump `['pg_dumpall', '-U', user]`.
  - `mysql`/`mariadb` — `match: /mysql|mariadb/`; dump
    `['mysqldump', '--single-transaction', '--all-databases', '-uroot', '-p<env>']`
    (single-transaction = consistent snapshot, `IDEA.md` §6 DB-dump consistency).
  - `mongo` — `match: /mongo/`; dump `['mongodump', '--archive', '--oplog']`
    (`--oplog` = point-in-time consistency).
  - `matchAdapter(image)` returns the first matching adapter or `undefined`.
  Env values (`POSTGRES_USER`, `MYSQL_ROOT_PASSWORD`) read from the parsed
  compose service env — never interpolated into a shell string.
- 2.2 `backups.scan.ts` — `scanProject(projectPath)`: read+parse
  `docker-compose.yml` (yaml parser), iterate services, resolve an adapter per
  service image, build `plan.databases[]` with resolved container name; set
  `plan.paths = [projectPath]`; `detectProxyConfigs(compose)` adds traefik
  (`/etc/traefik`) / nginx config paths by image or label. Pure function over a
  filesystem read — inject the file reader so fixtures drive tests.

### Phase 3 — Injectable boundaries & orchestration
- 3.1 `backups.boundaries.ts` — interfaces only: `ResticRunner`
  (`backup(args, stdin?)`, `init`, `snapshots`), `DockerClient`
  (`exec(container, argv): NodeJS.ReadableStream`, `inspect`), `SshTransport`
  (repo URL builder for the storage VPS). Concrete impls
  (`restic-runner.ts` via `child_process` arg-array spawn, `docker-client.ts` via
  `dockerode`) live beside them but are swapped for mocks in unit tests.
- 3.2 `backups.service.ts` — `runBackup(projectId, userId)`:
  load+own-check project (`HttpError.forbidden` on mismatch); validate path
  allowlist; decrypt repo password in-process; for each enabled DB layer, stream
  `dockerClient.exec(container, adapter.dumpCmd(svc))` → `resticRunner.backup(
  ['backup','--stdin','--stdin-filename', '<svc>.dump'], stream)`; then
  `resticRunner.backup(['backup', ...plan.paths, ...plan.configs])`. Wrap the
  whole run: any layer throws → mark snapshot `failed`, persist status, rethrow as
  localized `HttpError`. No temp files unless unavoidable; pre-check free space.
- 3.3 `backups.controller.ts` — thin handlers (zod parse → service → JSON),
  each wrapped in `asyncHandler`. `backups.routes.ts` — `express.Router()` with
  `requireAuth`; routes `POST /scan`, `POST /`, `GET /`, `GET /:id`,
  `PATCH /:id/plan`, `POST /:id/backup`. `index.ts` — named re-exports
  (`backupsRouter`, `Project`, `ProjectDocument`, `scanProject`, adapter registry).

### Phase 4 — Wiring
- 4.1 Mount in `server/src/app.ts` `createApp()`:
  `app.use('/api/backups', backupsRouter)` (behind `requireAuth`).
- 4.2 Add any new env vars to `server/src/config/env.ts` zod schema +
  `.env.example` (root only). Fail hard on startup if missing.

### Tests
Server (`server/`, vitest node, `fileParallelism:false`, v8 coverage **100% gate**
on statements/branches/functions/lines; supertest against `createApp()`;
`startMemoryMongo`/`stopMemoryMongo`/`clearCollections` from
`server/src/shared/testing/mongo.ts`). All four boundaries injected as mocks —
no real Docker/Restic in this prompt's unit tests (real-restic lives in prompt 04).
`server/src/modules/backups/backups.test.ts`:
- **Adapters (table-driven):** per DB type (`postgres`/`mysql`/`mariadb`/`mongo`),
  assert `match(image)` true/false matrix, and that `dumpCmd`/`restoreCmd` return
  the exact **argument array** (asserts injection guard — no shell string).
- **scanProject:** run on fixture `docker-compose.yml` files (postgres-only,
  multi-DB, mongo+traefik, no-DB) → assert `plan.paths/databases/configs`.
- **Path allowlist:** `/var/www/app` accepted; `/etc/passwd`, `/var/www/../etc`,
  symlink traversal rejected with `HttpError.badRequest` before any runner call.
- **Injection guard:** assert the mock `DockerClient.exec`/`ResticRunner.backup`
  received arrays, never a `sh -c` interpolated string, even when a compose env
  value contains shell metacharacters (`$(...)`, `;`, backticks).
- **Ownership:** user B calling `runBackup` on user A's project → `403` forbidden.
- **Atomicity:** mock a failing DB-dump layer → snapshot persisted as `failed`,
  not partial; a failing path layer after a successful DB layer also → `failed`.
- **Secrets:** repo password is stored encrypted (assert ciphertext ≠ plaintext),
  decrypted only at invocation, never present in any response body or log.
- **Stream path:** assert dump stream is piped to `restic --stdin` (no temp file
  written) for DB layers.
- Edge cases: missing `docker-compose.yml`, unknown image (no adapter), empty
  services map, free-space pre-check failure → clean `failed`.

### i18n
All user-facing backup errors and success messages localized via the prompt-01
server `t(key, vars)` helper in the caller's `req.language`. Locales: **en, ar,
fr, de, es, ru, zh** (7) with auto-detect from `Accept-Language`; **ar is RTL**.
Keys e.g. `backups.error.pathNotAllowed`, `backups.error.noAdapter`,
`backups.error.dumpFailed`, `backups.success.backupComplete`. Add a key-parity
test asserting all 7 locale dictionaries expose identical keys + placeholder vars.
No hardcoded user-facing strings.

### Documentation
- `/docs` page "Backup core" (what `scanProject` detects, the dump-then-restic
  rule, the `/var/www/*` allowlist) — authored in all 7 languages where
  user-facing.
- `ARCHITECTURE.md`: the `backups` module, the adapter registry, the injectable
  boundaries, the `Project` table. `.env.example`: any new var, documented.

## Agents & Skills

- **Agents:** `backend-dev` (module, adapters, orchestration); `typescript-pro`
  (boundary interfaces, `InferSchemaType` typing).
- **Skills:** `spec-driven-development` (spec → plan → tasks before code, per
  `.claude/rules/spec-driven-development.md`); `docker-workflow-automation`
  (dockerode exec patterns, container lifecycle); `verify` (exercise a scan + a
  mocked backup end-to-end); `code-review` (final pass — assert no string-interp
  shell, no plaintext secrets).

## Idempotency Contract

Re-running MUST NOT: create a second `modules/backups/` or duplicate the `Project`
model/index, re-mount `/api/backups` twice in `app.ts`, re-add env vars already
present in `config/env.ts`/`.env.example`, duplicate an adapter registry entry, or
stack `requireAuth` twice on the router. Detect existing files and reconcile in
place — adapters, routes, model, and the app mount are each declared exactly once.
