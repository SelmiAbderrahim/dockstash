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

```bash
# Install dependencies
npm --prefix client install
npm --prefix server install

# Start the server (port 8080)
npm --prefix server run dev          # tsx watch src/server.ts

# Start the client (port 3000)
npm --prefix client run dev          # vite

# Type-check both sides
npm --prefix client run typecheck
npm --prefix server run typecheck

# Lint
npm --prefix client run lint
npm --prefix server run lint

# Run all tests
npm --prefix server test
npm --prefix client test

# Run a single test file
npm --prefix server exec -- vitest run src/modules/auth/auth.test.ts
npm --prefix client exec -- vitest run src/features/auth/store/slice.test.ts

# Production build
npm --prefix server run build        # tsup → dist/server.cjs
npm --prefix client run build        # tsc --noEmit && vite build
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

- **Feature-module isolation.** Client features live under `client/src/features/<name>/`; server modules under `server/src/modules/<name>/`. Cross-feature imports must go through `shared/` or each module's `index.ts` public API. Never reach into another feature's internals directly.
  → `.claude/rules/mern-feature-modules.md`

- **Named exports only.** No `export default` on components, actions, reducers, models, or utilities. Named exports enable reliable refactoring and IDE discoverability.
  → `.claude/rules/mern-no-default-exports.md`

- **Typed Mongoose schemas.** Every schema uses `InferSchemaType` (TypeScript) and exports the type alongside the model. No bare `mongoose.model()` calls without a type annotation.
  → `.claude/rules/mern-mongoose-typed-schemas.md`

- **Environment variables from root `.env` only.** Never create `.env` files in subdirectories. Server config flows through `src/config/env.ts` (zod-validated). Client config uses `import.meta.env.VITE_*`.
  → `.claude/rules/environment-variables.md`

- **No hardcoded URLs.** All URLs derive from `CLIENT_URL` and `SERVER_URL` env vars (server) or `VITE_API_BASE_URL` / `VITE_SOCKET_URL` (client). Tests and seed scripts are the only exceptions.
  → `.claude/rules/site-url-env-pattern.md`

- **Tab state in URL query params.** Every tabbed interface persists active tab as `?tab=` so links are shareable and refresh-safe. Never use `useState` for tab state.
  → `.claude/rules/url-tab-state.md`

- **Anti-Codex UI patterns.** No card-lift-on-hover, gradient text, pill buttons, bounce/pulse animations, or `transition: all`. Flat borders, 6px button radius, 8px card radius, 150ms max transitions on `color`/`opacity` only.
  → `.claude/rules/ui-ux-patterns.md`

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
- **No monorepo tooling.** No Turborepo, no Nx, no Lerna. `client/` and `server/` are independent npm packages.
- **No GraphQL.** REST API via Express routes. No Apollo, no Relay.
- **No tRPC.** Standard Express route handlers returning JSON.
- **No PostgreSQL.** MongoDB via Mongoose is the primary database. Redis is now available (via the compose `redis` service, `REDIS_URL`) — reserved for BullMQ scheduling in a later phase.
- **~~No CSS-in-JS / No Tailwind.~~** Superseded. The client now uses **Tailwind CSS v4** (CSS-first, via `@tailwindcss/vite`; tokens in `client/src/styles/tailwind.css`, no `tailwind.config.js`). Still no styled-components / emotion. Legacy `.scss` is being retired as components migrate to Tailwind utilities.
- **~~No CI/CD pipeline.~~** Superseded by `prompts/dockstash-build/11-security-legal-and-ci-in-docker-*.md`. CI now runs in Docker (`node:20-bookworm` containers) via `.github/workflows/ci.yml`. Pipeline gates: typecheck → lint → vitest + coverage (v8 **100%** on lines/branches/functions/statements) → `npm audit --audit-level=high` (**zero high/critical**). No allow-list. See `docs/ci-gates.en.md`. App-layer hardening (helmet, express-rate-limit on `/api/auth/*` and the Polar webhook, CORS locked to `env.CLIENT_URL`, double-submit CSRF for cookie surfaces) and the GDPR data-rights module live under `server/src/modules/legal/` — see `docs/security-model.en.md` and `docs/data-rights.en.md`.
- **~~No i18n framework.~~** Superseded by `prompts/dockstash-build/01-i18n-foundation-seven-locales-autodetect-*.md`. i18n is now first-class: seven locales (`en, ar, fr, de, es, ru, zh`) with auto-detection (client uses `navigator.language`; server parses `Accept-Language` + honours `x-lang` header / `lang` cookie), RTL for Arabic, localized backend response messages, and full parity across every namespace. Client uses `i18next` + `react-i18next`; server uses a hand-written typed dictionary under `server/src/shared/i18n/`. See both `shared/i18n/README.md` files.
- **~~No design system.~~** Superseded. The client uses **shadcn/ui** (Radix-based, `new-york` style) as its component library. Generated primitives live in `client/src/shared/ui/` (imported via `@shared/ui/*`); the `cn()` helper is in `client/src/shared/lib/utils.ts`; theme tokens + light/dark (`.dark` class, manual toggle via `@shared/theme/ThemeProvider` + no-flash head script) live in `client/src/styles/tailwind.css`. `client/src/shared/ui/**` is excluded from coverage as vendored source. Note: the client is **React 18**, so native form primitives (`Input`, `Textarea`) are patched to use `forwardRef`.
