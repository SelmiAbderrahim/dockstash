# Dockerize the Stack & Strip Demo Features — Build Prompt

> **Turn the MERN starter into a containerized Dockstash control plane** — a
> `docker-compose.yml` orchestrating `api`, `web`, `mongo`, `redis`, and a
> least-privilege `docker-socket-proxy`, with restic + DB-dump clients baked into
> the api image — and **delete the demo features** (messaging, pages, sales,
> template, chat) while keeping auth, users, billing, communication, shared, and
> the Socket.IO server instance for later backup-log streaming.

---

## Agent

`build-engineer` (owns the build pipeline, Dockerfiles, `docker-compose.yml`,
`.dockerignore`, and the demo-strip surgery across `client/src/app/*` and
`server/src/app.ts` / `server/src/server.ts`). Coordinate with `cicd-engineer`
(healthcheck/restart/secret-injection conventions the later CI phase will reuse).

## Mission

The repo is the MERN starter described in `IDEA.md` Part B and `CLAUDE.md`. It
currently ships **demo features** that are not part of Dockstash, and **runs on
bare Node** (`CLAUDE.md` §9 "No Docker"). Per `IDEA.md` build-phase 1 + §9
"Docker-first deployment", do two things:

1. **Containerize the whole stack** — compose `api`, `web`, `mongo`, `redis`
   (for BullMQ later), `docker-socket-proxy`; healthchecks + restart policies on
   every service; named volumes for `mongo` + `redis`; secrets injected as
   env/Docker secrets, never baked.
2. **Strip the demo surface** — remove client `messaging` / `pages` / `sales` /
   `template` features and the server `chat` module, de-register their reducers,
   routes, mounts, and socket wiring — **but keep the Socket.IO server instance**
   in `server.ts` (reused later for live backup-log streaming).

> **This prompt supersedes `CLAUDE.md` §9 "No Docker".** Note the supersession in
> the prompt output and in the doc updates; do not delete §9's other "does NOT do"
> entries.

## Operating Constraints

| Rule | Detail |
|---|---|
| Keep, don't fork | Keep `server/src/modules/`: `auth`, `users`, `billing`, `communication`, and all of `server/src/shared/`. Keep `client/src/features/`: `auth`, `billing`, `dashboard`, `admin`. Only `messaging`/`pages`/`sales`/`template` (client) and `chat` (server) are removed. |
| Socket.IO stays | `server/src/server.ts` keeps `new IoServer(server)` with cors from `env.CLIENT_URL`. Remove only `registerChatSocket(io)` and the `chat` import. Leave the `io` instance wired and exported/available so a later phase streams restic logs over it. |
| Env from root only | No new `.env` in `client/` or `server/`. New compose/runtime vars flow through root `.env` and the zod schema in `server/src/config/env.ts`. See `.claude/rules/environment-variables.md`. |
| No hardcoded URLs | Compose service URLs (`mongo`, `redis`, api/web origins) come from env (`MONGODB_URI`, `CLIENT_URL`, `SERVER_URL`, a new `REDIS_URL`). No `localhost`/IP literals in source. See `.claude/rules/site-url-env-pattern.md`. |
| Named exports | Any touched module keeps named exports; no `export default` reintroduced. See `.claude/rules/mern-no-default-exports.md`. |
| Secrets never baked | `MASTER_ENCRYPTION_KEY`, `POLAR_*`, `RESEND_API_KEY` are injected at runtime as env / Docker secrets. Dockerfiles must not `COPY .env` or `ARG` a secret. |
| Socket-proxy least privilege | The `api` container reaches Docker **only** via `docker-socket-proxy`; it never bind-mounts `/var/run/docker.sock` directly. `/var/www` is mounted read-mostly. |
| Spec-driven | Non-trivial infra change → write a short spec first per `.claude/rules/spec-driven-development.md`. |
| Excluded | No CI pipeline here (that is a later phase), no multi-VPS agent token issuance, no BullMQ wiring yet — only the `redis` service so BullMQ has a host later. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `server/src/app.ts` (`createApp()` — middleware order `requestId →
  pinoHttp → express.json({limit:'1mb'}) → cors({origin:env.CLIENT_URL,
  credentials:true}) → passport.initialize() → routes → notFound → errorHandler`,
  and the route mounts `/api/auth`, `/api/users`, `/api/chat`,
  `/api/communication`, `/api/billing` + `protectedRouter`).
- 0.2 Read `server/src/server.ts` (`createApp()`, HTTP on `env.PORT`,
  `new IoServer(server)` cors from `CLIENT_URL`, `registerChatSocket(io)`,
  `connectDb()`, SIGTERM/SIGINT graceful shutdown).
- 0.3 Read `server/src/modules/chat/` (`chat.socket.ts` `registerChatSocket`,
  Conversation/Message models, controller/routes/index) to know exactly what the
  `chat` mount + socket registration pull in.
- 0.4 Read `client/src/app/store.ts` (reducer registry) and
  `client/src/app/router.tsx` (route spreads) to find each demo feature's
  `reducer` and `routes` registration. Read `client/src/features/{messaging,
  pages,sales,template}/index.ts` for their public surface, and grep for any
  socket wiring in the messaging feature.
- 0.5 Read `server/src/config/env.ts` to see the existing zod `env`/`Env` shape
  before adding `REDIS_URL`.

### Phase 1 — Strip the server demo (`chat`)
- 1.1 Delete `server/src/modules/chat/` entirely.
- 1.2 In `server/src/app.ts`: remove the `chat` import and the
  `app.use('/api/chat', …)` mount. Leave the other four mounts +
  `protectedRouter` untouched; preserve middleware order exactly.
- 1.3 In `server/src/server.ts`: remove the `registerChatSocket` import and call.
  **Keep** `const io = new IoServer(server, { cors: { origin: env.CLIENT_URL,
  credentials: true } })` and its graceful-shutdown close. Add a one-line comment
  marking `io` as reserved for backup-log streaming.
- 1.4 Run `npm --prefix server run typecheck` — fix any now-dangling references.

### Phase 2 — Strip the client demo (messaging / pages / sales / template)
- 2.1 Delete `client/src/features/messaging/`, `pages/`, `sales/`, `template/`.
- 2.2 In `client/src/app/store.ts`: remove each deleted feature's reducer from the
  `configureStore({ reducer: { … } })` registry and its import.
- 2.3 In `client/src/app/router.tsx`: remove each deleted feature's spread
  `...messagingRoutes` (etc.) and import; ensure remaining routes
  (`auth`/`billing`/`dashboard`/`admin`) still resolve to a valid default route.
- 2.4 Remove any messaging Socket.IO client wiring (provider/hook) from
  `client/src/app/providers.tsx` if present.
- 2.5 Run `npm --prefix client run typecheck` — fix dangling imports/aliases.

### Phase 3 — Env & config additions
- 3.1 Add `REDIS_URL` to the zod schema in `server/src/config/env.ts` (optional
  for now; BullMQ phase will require it). Keep `MONGODB_URI`, `PORT(8080)`,
  `CLIENT_URL`, `SERVER_URL`, `JWT_SECRET`, `SESSION_SECRET` as-is.
- 3.2 Document every compose/runtime var in root `.env.example` with comments;
  verify `.gitignore` still ignores `.env`. No subdirectory `.env`.

### Phase 4 — Dockerfiles
- 4.1 `server/Dockerfile` (the `api` image): multi-stage. Build stage runs
  `npm ci` + `npm run build` (tsup → `dist/server.cjs`). Runtime stage on a slim
  Node base **bakes the backup toolchain**: `restic`, `postgresql-client`
  (`pg_dump`/`pg_dumpall`), `default-mysql-client`/`mariadb-client`
  (`mysqldump`), and `mongodb-database-tools` (`mongodump`/`mongorestore`) — so
  no host tooling is assumed. Run as a non-root user. `HEALTHCHECK` hits a health
  route on `PORT`. Never `COPY .env`; never `ARG` a secret.
- 4.2 `client/Dockerfile` (the `web` image): build stage runs `npm ci` +
  `npm run build` (Vite → static assets); runtime stage serves the static build
  via nginx (or document serving it from the `api`). `HEALTHCHECK` on the nginx
  port. Pass `VITE_API_BASE_URL` / `VITE_SOCKET_URL` as build args sourced from
  env, not literals.
- 4.3 `.dockerignore` at repo root (and/or per-context): exclude
  `node_modules`, `.git`, `dist`, `.env`, test artifacts, coverage.

### Phase 5 — `docker-compose.yml` (repo root)
- 5.1 Services:
  - `mongo` — official image, named volume `mongo-data`, healthcheck
    (`mongosh --eval "db.adminCommand('ping')"`), `restart: unless-stopped`.
  - `redis` — official image, named volume `redis-data`, healthcheck
    (`redis-cli ping`), `restart: unless-stopped`.
  - `docker-socket-proxy` — `tecnativa/docker-socket-proxy` (or equivalent),
    bind-mounts `/var/run/docker.sock`, exposes **only** the endpoints the agent
    needs (`CONTAINERS=1`, `EXEC=1`, `INFO=1`; everything else `0`), healthcheck,
    `restart: unless-stopped`. This is the **only** service touching the raw
    socket.
  - `api` — built from `server/Dockerfile`; `DOCKER_HOST=tcp://docker-socket-
    proxy:2375`; mounts `/var/www:ro` (read-mostly); depends_on `mongo`, `redis`,
    `docker-socket-proxy` (with `condition: service_healthy`); env from root
    `.env`; secrets (`MASTER_ENCRYPTION_KEY`, `POLAR_*`, `RESEND_API_KEY`) via
    `secrets:` / env, **never** in the image; healthcheck on its health route;
    `restart: unless-stopped`.
  - `web` — built from `client/Dockerfile`; depends_on `api`; healthcheck;
    `restart: unless-stopped`.
- 5.2 Named volumes `mongo-data`, `redis-data` declared at the top level. Use a
  single app network. Reference Docker secrets via the compose `secrets:` block;
  do not inline secret values.
- 5.3 Confirm `MONGODB_URI` points at the `mongo` service host and `REDIS_URL` at
  `redis` — both from env, no literals.

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage, supertest
against `createApp()`, `startMemoryMongo`/`stopMemoryMongo`/`clearCollections`
from `server/src/shared/testing/mongo.ts`): **100% coverage target**
(lines/branches/functions/statements).
- App-wiring regression: `supertest(createApp())` — `GET /api/chat/*` now
  returns 404 (mount removed); `/api/auth`, `/api/users`, `/api/communication`,
  `/api/billing` still mount; middleware order preserved (request-id header
  present, JSON body limit honored, CORS reflects `CLIENT_URL`).
- `env.ts`: schema accepts a valid `REDIS_URL` and tolerates it absent (optional);
  existing required vars still fail hard when missing.
- Socket: `server.ts` still constructs the `io` instance and closes it on
  shutdown; assert no `registerChatSocket` import remains (grep-style unit guard).
Client (`client/`, vitest + RTL, jsdom): store no longer registers the removed
reducers (`store.getState()` has no `messaging`/`pages`/`sales`/`template` keys);
router resolves a valid default route and renders the dashboard shell with
loading/empty/error states intact.
- Mock boundaries: keep the Socket.IO server and Docker client behind injectable
  interfaces so later phases unit-test orchestration without real infra.

### i18n
No new user-facing strings are introduced by this phase, but the **i18n
foundation prompt (`01-*`) is a hard dependency for every later feature**. Do not
hardcode any English error/success strings in touched files. Where a removed demo
feature contributed locale entries, delete those orphaned keys so the `01-*`
key-parity test (en, ar, fr, de, es, ru, zh) stays clean. RTL (`ar`) and
auto-detection are owned by `01-*`; this phase only avoids regressions.

### Documentation
- `/docs`: add a "Running Dockstash with Docker" page (compose up, the five
  services, healthchecks, where secrets come from). User-facing → author in all 7
  locales (en, ar, fr, de, es, ru, zh) once `01-*` lands; stub `en` now if `01-*`
  is not yet merged and note the follow-up.
- `CLAUDE.md`: amend §9 to record that Docker is now first-class for Dockstash
  (this prompt supersedes "No Docker"); leave the other §9 entries.
- `.env.example`: document `REDIS_URL` and every compose var with comments.
- Note the demo-strip in the changelog/PR body (features removed, Socket.IO
  retained).

## Agents & Skills

- **Agents:** `build-engineer` (primary — Dockerfiles, compose, demo-strip),
  `cicd-engineer` (healthcheck/restart/secret conventions for the later CI phase).
- **Skills:** `docker-workflow-automation` (compose orchestration, service
  topology, secret injection); `spec-driven-development` (short spec before the
  infra change); `code-review` (final pass on the strip + compose); `run` /
  `verify` (bring the stack up, confirm `api`/`web`/`mongo`/`redis`/socket-proxy
  are healthy and the removed routes 404).

## Idempotency Contract

Re-running MUST NOT: re-create already-deleted demo directories; double-remove a
reducer/route/mount (detect already-stripped state and skip); add a second copy
of any service to `docker-compose.yml`; re-add `REDIS_URL` to the env schema;
duplicate volumes, networks, or the socket-proxy; or re-introduce
`registerChatSocket`. Reconcile compose services, env schema, store/router
registrations, and Dockerfiles **in place** — converge to the same final state on
every run.
