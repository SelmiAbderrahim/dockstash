# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MERN Starter — Claude Code Guide

## 1. Project Overview

This is a MERN stack starter (MongoDB, Express, React, Node) organized as feature modules on both client and server. The client runs React 18 with Redux Toolkit and Vite; the server runs Express with Mongoose 8. Both sides use TypeScript.

## 2. Stack

**Client**
- React 18, ReactDOM 18
- Redux Toolkit 2, react-redux 9
- React Router 6 (`createBrowserRouter`)
- Native `fetch` via `shared/api/client.ts` (no axios)
- Vite 6, TypeScript 5, Sass
- Socket.IO Client 4
- Vitest + React Testing Library for tests
- zod for form/API validation

**Server**
- Express 4, TypeScript 5
- Mongoose 8
- Passport (local + JWT strategies via `passport-jwt`)
- jsonwebtoken 9, bcryptjs
- Socket.IO 4
- pino / pino-http for structured logging
- zod for env validation (`src/config/env.ts`)
- Stripe, Mailgun integrations
- Vitest + supertest for integration tests; `mongodb-memory-server` for in-process MongoDB

## 3. Repo Layout

```
mern-starter/
├── client/
│   └── src/
│       ├── app/              # Store (store.ts), router (router.tsx), providers
│       ├── features/         # auth/, billing/, dashboard/, messaging/, admin/, pages/, sales/, template/
│       │   └── <name>/
│       │       ├── components/
│       │       ├── store/        # slice.ts, thunks.ts, selectors.ts
│       │       ├── api.ts        # Feature-scoped fetch calls via apiClient
│       │       ├── types.ts
│       │       ├── routes.tsx    # Route array exported for router.tsx
│       │       └── index.ts      # Public API — named re-exports only
│       └── shared/
│           ├── api/client.ts     # Typed fetch wrapper (ApiError, apiClient<T>)
│           ├── hooks/redux.ts    # useAppSelector / useAppDispatch typed hooks
│           └── utils/cookies.ts  # saveCookie / loadCookie / removeCookie
├── server/
│   └── src/
│       ├── app.ts            # createApp() — Express wiring, middleware, route mounts
│       ├── server.ts         # Entry point — connects DB, starts HTTP server
│       ├── config/           # env.ts (zod), db.ts, passport.ts, logger.ts
│       ├── modules/          # auth/, users/, billing/, chat/, communication/
│       │   └── <name>/
│       │       ├── <name>.controller.ts
│       │       ├── <name>.service.ts
│       │       ├── <name>.model.ts       # Mongoose model + InferSchemaType
│       │       ├── <name>.schema.ts      # zod request-body schemas
│       │       ├── <name>.routes.ts
│       │       ├── <name>.test.ts
│       │       └── index.ts
│       └── shared/
│           ├── middleware/   # error-handler, not-found, require-auth, request-id
│           ├── testing/      # mongo.ts (startMemoryMongo / stopMemoryMongo / clearCollections)
│           ├── types/        # express.d.ts augmentations
│           └── utils/        # http-error.ts (HttpError), async-handler.ts
├── .claude/                  # Claude Code configuration (see section 6)
├── .env                      # Environment variables (single source of truth)
├── .env.example              # Template — copy this to .env
└── .gitignore
```

## 4. How to Run

**ALL commands run inside Docker — never on the host.** See
`.claude/rules/docker-only-commands.md` (strict rule). Dev tooling uses
`node:20-bookworm` for CI parity; the stack runs via `docker compose`.

```bash
# Full stack (api, web, mongo, redis, docker-socket-proxy)
docker compose up -d --build
docker compose ps                    # all services should report `healthy`

# Install dependencies
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm install
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm install

# Type-check both sides
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck

# Lint
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint

# Run all tests
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm test
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm test

# Run a single test file
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/auth/auth.test.ts
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm \
  npx vitest run src/features/auth/store/slice.test.ts

# Production build
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run build   # tsup → dist/server.cjs
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run build   # tsc --noEmit && vite build
```

**Environment variables** — copy `.env.example` to `.env` at the repo root (never in subdirectories):

```env
NODE_ENV=development
PORT=8080
MONGODB_URI=mongodb://localhost:27017/mern-starter
JWT_SECRET=your-random-64-char-hex-string
SESSION_SECRET=your-random-64-char-hex-string
CLIENT_URL=http://localhost:3000
SERVER_URL=http://localhost:8080
LOG_LEVEL=info
# REQUIRED — AES-256-GCM master key that encrypts secrets at rest.
# Fails startup if missing or decodes to < 32 bytes. See
# `server/src/shared/crypto/README.md` for the rotation runbook.
MASTER_ENCRYPTION_KEY=your-random-64-char-hex-string
# Optional payments (Polar) — Free / self-host boots without these:
PAYMENT_PROVIDER=none
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
POLAR_SERVER=
POLAR_PRO_PRODUCT_ID=
POLAR_BUSINESS_PRODUCT_ID=
# Optional email (Resend) — Free / self-host boots without these:
RESEND_API_KEY=
RESEND_FROM=
# Optional alerting — sane default (24):
ALERT_HEARTBEAT_HOURS=24
# Optional legacy integrations:
STRIPE_SECRET_KEY=
MAILGUN_PRIVATE_KEY=
MAILGUN_DOMAIN=
```

Client-side env vars (Vite — prefix `VITE_`):

```env
VITE_API_BASE_URL=http://localhost:8080/api   # falls back to /api if omitted
VITE_SOCKET_URL=http://localhost:8080         # falls back to / if omitted
```

## 5. Conventions

These are the load-bearing rules. Each links to the full rule file in `.claude/rules/`.

- **Docker-only commands.** Every build/test/runtime command runs inside Docker — never bare `npm`/`node`/`npx`/`tsc`/`vitest` on the host. Dev tooling via `docker run --rm -v "$PWD/<side>":/app -w /app node:20-bookworm <cmd>` (CI parity); stack ops via `docker compose`. Host allows only `git`, `docker`, `gh`, and read-only file inspection.
  → `.claude/rules/docker-only-commands.md`

- **Feature-module isolation.** Client features live under `client/src/features/<name>/`; server modules under `server/src/modules/<name>/`. Cross-feature imports must go through `shared/` or each module's `index.ts` public API. Never reach into another feature's internals directly.
  → `.claude/rules/mern-feature-modules.md`

- **Named exports only.** No `export default` on components, actions, reducers, models, or utilities. Named exports enable reliable refactoring and IDE discoverability.
  → `.claude/rules/mern-no-default-exports.md`

- **Typed Mongoose schemas.** Every schema uses `InferSchemaType` (TypeScript) and exports the type alongside the model. No bare `mongoose.model()` calls without a type annotation.
  → `.claude/rules/mern-mongoose-typed-schemas.md`

- **Owner-scoped queries at query time.** Every owner-scoped resource load MUST filter by `owner` in the query itself (`Model.findOne({ _id, owner })`), NOT with a subsequent `if (row.owner !== userId)`. Foreign-owner requests return **404** (existence-cloak); every product router carries a cross-account test. Enforced by `server/src/shared/middleware/idor-meta.test.ts` and an ESLint `no-restricted-syntax` ban on `findById(req.params.*)` in controllers.
  → `.claude/rules/owner-scoped-queries.md`

- **Fleet-agent machine surface (`/api/agent`).** Composite-token verify preserves anchored `dsa_<24-hex>.<48-hex>` regex + dummy-record HMAC timing flatten + one generic 401. Every `/api/agent` handler scopes downstream DB touches by `req.agent.id` — `AgentJob.findById(req.params.jobId)` is forbidden. `rotateAgentKey` persists the new hash BEFORE composing the token; no route echoes `apiKeyHash`. Daemon requires `DOCKSTASH_URL` (no baked-in fallback) and never logs the Bearer. Cross-copy parity on `restic-runner`/`docker-client` (argv-only spawn, no shell, no raw socket) is enforced by twin meta tests on both sides.
  → `.claude/rules/agent-machine-surface.md`

- **Argv-only spawn + SSRF guard.** Every `child_process.spawn` in server AND agent code uses `shell: false` with a `string[]` argv; secrets travel via `env` (`RESTIC_PASSWORD`), never argv. `child_process.exec` is banned in `modules/backups/**` and `agent/src/**`. Every SSH invocation pins the host key (`StrictHostKeyChecking=yes` + pinned `UserKnownHostsFile`); `=no` / `=accept-new` is banned repo-wide. `/var/run/docker.sock` is bind-mounted ONLY into the least-privilege `docker-socket-proxy`; the api uses `DOCKER_HOST=tcp://docker-socket-proxy:2375`. Every server-side `fetch` on a user-supplied URL routes through `shared/net/safe-fetch.ts::safeFetch`, which enforces http(s) scheme, blocks loopback/private/link-local/metadata IPs (v4 + v6), and re-validates every redirect hop. Enforced by ESLint (`no-restricted-syntax` for `shell:true`, `no-restricted-imports` for `exec` in backups/agent) and `server/src/shared/middleware/command-execution-meta.test.ts`.
  → `.claude/rules/argv-only-spawn-and-ssrf.md`

- **No query injection + i18n-keys-only errors.** No Mongoose query builder in `server/src/modules/**` is fed a spread of `req.query`/`req.body`/`req.params` — every filter is a zod-parsed, typed object; every URL id is cast (`isValidObjectId` or an anchored `[0-9a-fA-F]{24}$` zod regex) BEFORE it reaches Mongoose (invalid → 400, never a CastError 500); no user-controlled `$where`/`$regex`/`$expr` anywhere. `/api/superadmin` is gated at the `app.ts` mount by `[requireAuth, requireVerified, requireRole(ROLE_SUPERADMIN)]` — the sub-router imports no auth middleware. Data-rights export uses `req.user.id` (never a body `userId`); deletion schedules a purge `ACCOUNT_DELETION_GRACE_HOURS` in the future via `PurgeQueue.enqueuePurge` (never a synchronous hard delete); `legalHold` on the user OR project blocks/skips purge. `error-handler.ts` emits i18n keys (resolved per `Accept-Language`) plus optional zod details only — never `err.stack`, never a raw `err.message`, never `...err` on the wire, even in development. Enforced by `server/src/shared/middleware/injection-and-output-meta.test.ts` + `server/src/shared/middleware/coverage.test.ts` (error-handler branches).
  → `.claude/rules/no-query-injection-and-i18n-errors.md`

- **Secrets & data-at-rest.** Every persisted secret (restic repo password, SSH private key, agent API secret) is an AES-256-GCM envelope produced by `shared/crypto/encryptSecret` — never plaintext, never a reused IV (fresh `randomBytes(12)` per call). `MASTER_ENCRYPTION_KEY` is env-only (no in-source default), rotation runs via `rotateStore` (decrypt-old → re-encrypt-new → atomic swap, all-or-nothing, idempotent re-run). The pino logger (`config/logger.ts`) has a `redact` block covering Authorization / Cookie / password / token / envelope / `MASTER_ENCRYPTION_KEY` / `SUPERADMIN_PASSWORD` / Polar creds / SSH keys — sourced from `REDACT_PATHS`. The superadmin seeder is idempotent and NEVER emits the plaintext password on any log line; `console.*` is banned repo-wide in `modules/superadmin/**`. `errorHandler` returns no `stack` in the response body. The self-backup restic password is HMAC-derived from the master key via `deriveSelfBackupPassword` — never the master key verbatim. Enforced by ESLint (`no-console` in `modules/superadmin/**`) and `server/src/shared/middleware/secrets-meta.test.ts` + `server/src/config/logger-redaction.test.ts`.
  → `.claude/rules/secrets-and-rotation.md`

- **Environment variables from root `.env` only.** Never create `.env` files in subdirectories. Server config flows through `src/config/env.ts` (zod-validated). Client config uses `import.meta.env.VITE_*`.
  → `.claude/rules/environment-variables.md`

- **No hardcoded URLs.** All URLs derive from `CLIENT_URL` and `SERVER_URL` env vars (server) or `VITE_API_BASE_URL` / `VITE_SOCKET_URL` (client). Tests and seed scripts are the only exceptions.
  → `.claude/rules/site-url-env-pattern.md`

- **Tab state in URL query params.** Every tabbed interface persists active tab as `?tab=` so links are shareable and refresh-safe. Never use `useState` for tab state.
  → `.claude/rules/url-tab-state.md`

- **Monochrome design system (visual source of truth).** Achromatic shadcn neutral tokens (near-black primary ↔ near-white in dark mode; color only for destructive/success state), one Instrument Serif italic accent max per display headline, flat 1px-border cards (`shadow-xs` max), whitespace-separated sections, token-inverted dark CTA bands, `pattern-dot-grid` hero backdrop, lucide icons only. Never reintroduce a brand hue, palette classes, or hex colors. The `dockstash-design` skill has canonical snippets.
  → `.claude/rules/dockstash-design-system.md`

- **Anti-Codex UI patterns.** No card-lift-on-hover, gradient text, pill buttons, bounce/pulse animations, or `transition: all`. Accessibility/forms/loading-state sections in force; visuals superseded by the design-system rule above.
  → `.claude/rules/ui-ux-patterns.md`

- **Interaction hygiene (promoted).** Every clickable shows pointer/not-allowed cursors from the base primitive; async actions disable + show the shared `Spinner` via `Button` `loading`, restore on success AND error; all six states (default/hover/focus-visible/active/disabled/loading) present.
  → `.claude/rules/interaction-hygiene.md`

- **Shared layout system (promoted).** Exactly one Header/Footer/shell system in `client/src/shared/components/` — two variants (app sidebar shell + marketing top-nav), never inlined `<header>`/`<footer>` in feature layouts, `Sheet` mobile menu + `ThemeToggle` + locale switcher on both.
  → `.claude/rules/shared-layout-system.md`

- **Destructive git commands require explicit confirmation.** `git stash`, `git reset --hard`, `git clean -f`, `git commit --amend`, `git push --force`, and similar commands must never run without per-turn user approval.
  → `.claude/rules/git-destructive-commands.md`

- **Spec-driven development for non-trivial features.** Start with a specification (problem statement, acceptance criteria, edge cases) before implementation. Bug fixes and one-liners skip the full workflow.
  → `.claude/rules/spec-driven-development.md`

## 5a. Key Architecture Patterns

These patterns are used throughout the codebase and are not obvious from file names alone.

### Client: RTK slice + thunk pattern

Each feature has `store/thunks.ts` (async logic, calls `api.ts`), `store/slice.ts` (`extraReducers` handles pending/fulfilled/rejected), and `store/selectors.ts`. Thunks use `rejectWithValue` to pass typed error strings to the slice.

### Client: API calls

All HTTP calls go through `shared/api/client.ts` → `apiClient<T>(path, options)`. It reads `VITE_API_BASE_URL`, attaches the JWT from the `token` cookie when `auth: true`, and throws `ApiError` on non-2xx responses. Feature `api.ts` files are thin wrappers over `apiClient`.

### Client: Path aliases

TypeScript and Vite are both configured with path aliases:

| Alias | Resolves to |
|-------|-------------|
| `@/*` | `src/*` |
| `@app/*` | `src/app/*` |
| `@features/*` | `src/features/*` |
| `@shared/*` | `src/shared/*` |

Always use these aliases — never relative `../../` imports across feature boundaries.

### Server: Controller → Service → Model

Controllers parse/validate requests (zod schemas in `*.schema.ts`), call service functions, and return HTTP responses. Services contain business logic and call Mongoose models. Controllers are kept thin; no DB calls in controllers.

### Server: Error handling

`HttpError` (`shared/utils/http-error.ts`) provides `HttpError.badRequest()`, `.unauthorized()`, `.conflict()`, etc. All route handlers are wrapped with `asyncHandler` (`shared/utils/async-handler.ts`) so thrown `HttpError` instances are caught by the global error handler middleware.

### Server: Auth middleware

`shared/middleware/require-auth.ts` — a Passport JWT middleware that populates `req.user`. Apply it per-route or mount the `protectedRouter` from `modules/auth/index.ts` for grouped routes.

## 6. Working with Claude in This Repo

```
.claude/
├── agents/       # Agent definitions (specialized personas for complex tasks)
├── commands/     # Slash commands (SpecKit integration)
├── helpers/      # Shared helper scripts
├── hooks/        # Claude Code hooks
├── plans/        # Feature plans from spec-driven development
├── prompts/      # Prompt templates
├── rules/        # Governance rules (the authority files summarized in this CLAUDE.md)
├── skills/       # Skill definitions (reusable workflows)
└── settings.json # Claude Code permissions and configuration
```

**Rule files** (`.claude/rules/`) are the source of truth. This CLAUDE.md summarizes them for quick reference. When in doubt, read the rule file.

**Cursor and Windsurf** — `.cursorrules` and `.windsurfrules` mirror this file. Changes here should be propagated to those files.

**AGENTS.md** — the index file that both Claude Code and OpenCode read first. It links to this file and to rule files for feature-specific work.

## 7. Adding a Feature

Follow these steps to add a new feature (e.g., "notifications"):

### Client

1. Create `client/src/features/notifications/`
2. Add files:
   - `components/` — React components specific to notifications
   - `store/slice.ts` — RTK slice (`createSlice`, `extraReducers` for async thunks)
   - `store/thunks.ts` — `createAsyncThunk` functions; call `api.ts`
   - `store/selectors.ts` — memoized selectors
   - `api.ts` — fetch calls via `apiClient<T>` from `@shared/api/client`
   - `types.ts` — TypeScript interfaces for the feature's domain objects
   - `routes.tsx` — route array to spread into `app/router.tsx`
   - `index.ts` — Public API: named re-exports only
3. Wire into the app:
   - Register the reducer in `client/src/app/store.ts`
   - Spread the routes in `client/src/app/router.tsx`

### Server

1. Create `server/src/modules/notifications/`
2. Add files:
   - `notifications.model.ts` — Mongoose schema with `InferSchemaType`, named export
   - `notifications.schema.ts` — zod schemas for request body validation
   - `notifications.service.ts` — business logic; calls the model
   - `notifications.controller.ts` — request parsing (zod), delegates to service, returns JSON; wrap with `asyncHandler`
   - `notifications.routes.ts` — `express.Router()`, apply `requireAuth` where needed
   - `notifications.test.ts` — supertest integration tests using `startMemoryMongo`
   - `index.ts` — Public API: named re-exports
3. Wire into the app:
   - Mount routes in `server/src/app.ts`: `app.use('/api/notifications', notificationsRouter)`

### What NOT to Do

- **Never import from another feature's internals.** If feature A needs something from feature B, B must export it through its `index.ts`, and A imports from the public API.
- **Never duplicate shared logic across features.** Put it in `shared/` (utils, components, middleware).
- **Never create a module for a single function.** Put it in `shared/utils/` instead.
- **Never use default exports.** Named exports everywhere.
- **Never hardcode URLs or config values.** Use environment variables.

## 8. Testing

**Both client and server use Vitest.**

- Server integration tests use `supertest` against `createApp()` and `mongodb-memory-server` for an in-process MongoDB (no external DB required).
- Client unit tests use Vitest + React Testing Library.
- Test files live next to the module: `<module>.test.ts`.

```bash
# All tests
npm --prefix server test
npm --prefix client test

# Single file (server)
npm --prefix server exec -- vitest run src/modules/auth/auth.test.ts

# Single file (client)
npm --prefix client exec -- vitest run src/features/auth/store/slice.test.ts

# Watch mode
npm --prefix server exec -- vitest
npm --prefix client exec -- vitest
```

**Server test anatomy:**

```typescript
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());
```

**Conventions:**
- Test the public API of each module, not internal implementation details.
- Each test file is self-contained: imports what it needs, sets up its own fixtures.
- No hard coverage percentage requirement — aim for meaningful coverage on business logic.

## 9. Things This Repo Does NOT Do

This list prevents agent assumptions from drifting into unrelated territory:

- **~~No Docker.~~** Superseded by `prompts/dockstash-build/00-dockerize-stack-and-strip-demo-*.md`. Dockstash is now Docker-first: `docker-compose.yml` at the repo root orchestrates `api`, `web`, `mongo`, `redis`, and a least-privilege `docker-socket-proxy`. See `docs/running-with-docker.md`.
- **~~No SSR.~~** Superseded. The public marketing surface (`client/src/features/marketing/`) is now server-rendered via Vite native SSR — the public entrypoint is a Node server (`client/server.js`) that renders marketing routes with `client/src/entry-server.tsx` (React Router `createStaticHandler` + `renderToString` + `react-helmet-async`) so crawlers and AI engines receive full HTML with `<title>`, meta, Open Graph, hreflang, and JSON-LD. The authenticated dashboard stays a CSR SPA (`entry-client.tsx` hydrates only when server-rendered). Still no Next.js and no RSC. SEO infra (`/robots.txt`, `/sitemap*.xml`) is served by `server/src/modules/seo/` and proxied through the web server. See `client/server.js` and `client/src/shared/seo/`.
- **No monorepo tooling.** No Turborepo, no Nx, no Lerna. `client/`, `server/`, and `agent/` are independent npm packages. (`agent/` is the fleet-agent daemon — a pull-based backup worker installed on remote VPS hosts, image `selmiabderrahim/agent`; it authenticates to the server's `/api/agent/*` machine surface with a per-agent Bearer token and vendors copies of the backup adapters/restic-runner/docker-client. See `docs/fleet-agents.en.md`.)
- **No GraphQL.** REST API via Express routes. No Apollo, no Relay.
- **No tRPC.** Standard Express route handlers returning JSON.
- **No PostgreSQL.** MongoDB via Mongoose is the primary database. Redis is now available (via the compose `redis` service, `REDIS_URL`) — reserved for BullMQ scheduling in a later phase.
- **~~No CSS-in-JS / No Tailwind.~~** Superseded. The client now uses **Tailwind CSS v4** (CSS-first, via `@tailwindcss/vite`; tokens in `client/src/styles/tailwind.css`, no `tailwind.config.js`). Still no styled-components / emotion. Legacy `.scss` is being retired as components migrate to Tailwind utilities.
- **~~No CI/CD pipeline.~~** Superseded by `prompts/dockstash-build/11-security-legal-and-ci-in-docker-*.md`. CI now runs in Docker (`node:20-bookworm` containers) via `.github/workflows/ci.yml`. Pipeline gates: typecheck → lint → vitest + coverage (v8 **100%** on lines/branches/functions/statements) → `npm audit --audit-level=high` (**zero high/critical**). No allow-list. See `docs/ci-gates.en.md`. App-layer hardening (helmet, express-rate-limit on `/api/auth/*` and the Polar webhook, CORS locked to `env.CLIENT_URL`, double-submit CSRF for cookie surfaces) and the GDPR data-rights module live under `server/src/modules/legal/` — see `docs/security-model.en.md` and `docs/data-rights.en.md`.
- **~~No i18n framework.~~** Superseded by `prompts/dockstash-build/01-i18n-foundation-seven-locales-autodetect-*.md`. i18n is now first-class: seven locales (`en, ar, fr, de, es, ru, zh`) with auto-detection (client uses `navigator.language`; server parses `Accept-Language` + honours `x-lang` header / `lang` cookie), RTL for Arabic, localized backend response messages, and full parity across every namespace. Client uses `i18next` + `react-i18next`; server uses a hand-written typed dictionary under `server/src/shared/i18n/`. See both `shared/i18n/README.md` files.
- **~~No design system.~~** Superseded. The client uses **shadcn/ui** (Radix-based, `new-york` style) as its component library, styled by the **Dockstash monochrome design system** (`.claude/rules/dockstash-design-system.md`): achromatic neutral tokens in oklch, Inter + JetBrains Mono + Instrument Serif (italic display accent only), flat bordered surfaces, dot-grid hero backdrops, token-inverted dark CTA bands. Generated primitives live in `client/src/shared/ui/` (imported via `@shared/ui/*`); the `cn()` helper is in `client/src/shared/lib/utils.ts`; theme tokens + light/dark (`.dark` class, manual toggle via `@shared/theme/ThemeProvider` + no-flash head script) live in `client/src/styles/tailwind.css`. `client/src/shared/ui/**` is excluded from coverage as vendored source. Note: the client is **React 18**, so native form primitives (`Input`, `Textarea`) are patched to use `forwardRef`.
