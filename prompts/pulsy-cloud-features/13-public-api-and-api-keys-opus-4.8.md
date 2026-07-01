# Public REST API & API Keys — Build Prompt

> **Build the API the `apiAccess` entitlement promises** — issue hashed API keys,
> authenticate a versioned `/api/v1` REST surface with them, and gate read-only
> vs read-write by plan. Today `apiAccess: none|limited|full` and
> `assertApiAccessLevel()` exist but nothing reads them and there is no API.

---

## Agent

`uptime-monitor-specialist` (owns `uptime.ts` services + the `index.ts` Express
bootstrap). Security-sensitive — apply `.claude/rules/tob-secrets.md`,
`tob-authorization.md`, `tob-input-validation.md` throughout. `ui-designer`
(key UI), `translation-manager` (locales), `legal-pages-manager` (API terms).

## Mission

Stand up a first-party public API:
1. **API keys** — user-generated, shown once, stored hashed, revocable.
2. **Bearer auth middleware** — `Authorization: Bearer pul_…` resolves to a user.
3. **Versioned REST routes** under `/api/v1` reusing the uptime services, scoped
   to the key owner, gated by entitlement (`limited`=read, `full`=read+write).
4. **Management UI** + **API reference (OpenAPI)**.

## Operating Constraints

| Rule | Detail |
|---|---|
| Entitlement mapping | `assertApiAccessLevel(entitlements, "limited", t)` on reads, `"full"` on writes (ordered `none<limited<full`, already in `apps/server/src/billing/tier-guard.ts`). Reuse `errors.tierApiAccessNotAllowed` (exists, 5 locales). |
| OSS-default | Payments off ⇒ `team_yearly` ⇒ `apiAccess:"full"` ⇒ self-hosters get the full API free. No Polar in the path. |
| Secret handling | Generate `pul_` + `randomBytes(24).toString("base64url")`. **Store only `createHash("sha256")` of the key** (`apps/server/src/lib/crypto.ts` exposes `createHash` usage; `encrypt`/`decrypt` are for reversible secrets — keys are NOT reversible). Show plaintext exactly once at creation. Resolve by an **indexed hash lookup** (high-entropy random token → index lookup, no plaintext at rest; per `.claude/rules/monitor-sharing-patterns.md` this needs no `timingSafeEqual`). Never log keys; never return them after creation. |
| AuthN, not session | `/api/v1` uses the Bearer key, NOT better-auth cookies. better-auth has **no apiKey/bearer plugin** enabled (`apps/server/src/auth/auth.ts`) — build a custom middleware. |
| Mount order | Preserve `index.ts` order: cors → `app.all("/api/auth/*")` → raw webhook → `express.json()` → `/api/trpc` → **`/api/v1`** (after `express.json()`). CORS for `/api/v1` allows `Authorization` and is independent of the credentialed cookie CORS. |
| Scope | Every route filters by the resolved `userId`; reuse `findOwnedMonitorOrThrow` semantics. nanoid/UUID ids only. |
| Input validation | Reuse `apiCreateUptimeMonitor` / `apiUpdateUptimeMonitor` from `packages/db/src/schema/validation.ts` for write bodies; validate path/query params. No `as any`. |
| Reuse guards on writes | API writes call the SAME tier guards as tRPC create/update (`assertWithinMonitorLimit`, `assertCheckIntervalAllowed`) so the API can't bypass limits. |
| SSRF unchanged | Monitor create/update flows through the existing service path; user URLs already validated there (`lib/ssrf.ts`). |
| Rate limiting | Per-key fixed-window limiter (in-memory is fine for the single-replica deploy — **document the constraint**). `429` + `Retry-After`. |
| Errors | REST errors are JSON `{ error: { code, message } }`; message localized via `Accept-Language` reusing `lib/i18n.ts` `getTranslator`. Stable codes (401/403/404/422/429). |
| Excluded | No OAuth2, no granular scopes beyond read/write, no outbound webhooks, no GraphQL. |

## Phases

### Phase 0 — Map
Read `index.ts` (mount order + CORS construction), `trpc/trpc.ts` `createContext`
(session shape, `getEffectiveLanguage`/`getTranslator`), `tier-guard.ts`
(`assertApiAccessLevel`), `lib/crypto.ts` (the SHA-256 `createHash` pattern in
`getKey`), `webhooks/payment-route.ts` (the **factory-handler** shape for a
non-tRPC route), and the uptime services in `services/uptime/` (so REST delegates
to services, not duplicated SQL).

### Phase 1 — Schema & migration
New `packages/db/src/schema/api-key.ts` (export from `schema/index.ts`):
```
api_key
  apiKeyId      text pk ($defaultFn nanoid)
  userId        text fk -> user (cascade)
  name          text notnull
  keyPrefix     text notnull            -- first ~8 chars, shown in UI
  hashedKey     text notnull            -- sha256(full key)
  lastUsedAt    text
  expiresAt     text                    -- nullable
  revokedAt     text                    -- nullable; revoked keys never authenticate
  createdAt     text notnull
  uniqueIndex (hashedKey); index (userId)
```
Relations + `$inferSelect/$inferInsert`. Zod `apiCreateApiKey` (`name` 1–100) in
`validation.ts`. Generate via `pnpm --filter @pulsy/db generate`; update `drizzle/meta`.

### Phase 2 — Key service + auth middleware
- 2.1 `apps/server/src/services/api-keys/api-key-service.ts`:
  `createApiKey(userId, name)` → `{ row, plaintext }` (plaintext ONCE);
  `listApiKeys(userId)` (masked — prefix + lastUsedAt only); `revokeApiKey`;
  `resolveApiKey(plaintext)` → `{ user, entitlements } | null` (hash → indexed
  lookup → reject revoked/expired → bump `lastUsedAt` async via
  `getPulsyEntitlements`).
- 2.2 `apps/server/src/api/middleware.ts`: Express middleware extracting the Bearer
  token → `resolveApiKey` → attach `req.apiUser` + `req.entitlements`; 401 on
  missing/invalid (localized via `Accept-Language`). Helper `requireApiAccess(level)`
  → 403 `errors.tierApiAccessNotAllowed` when below the route's need.

### Phase 3 — REST router (`/api/v1`)
`apps/server/src/api/v1/router.ts` — an Express `Router` mounted in `index.ts`
after `express.json()`, behind the API-key middleware + per-key rate limiter.
Owner-scoped; reuse services:
- `GET /v1/monitors`, `GET /v1/monitors/:id` — read (`limited`).
- `GET /v1/monitors/:id/checks | /incidents | /stats` — read (`limited`).
- `POST /v1/monitors` (count+interval guards), `PATCH /v1/monitors/:id`,
  `DELETE /v1/monitors/:id` — write (`full`).
- `POST /v1/monitors/:id/check-now` — write (`full`).
Consistent JSON envelopes + cursor pagination (`?limit&cursor`) on lists.

### Phase 4 — Frontend key management
- Service/hooks/keys: a `services/uptime/` (or new `services/apiKeys/`) module,
  hooks, and an `apiKeys.*` query-key group; calls via `trpcQuery`/`trpcMutation`
  for the management procedures (expose key CRUD via a tRPC `apiKey.*` sub-router
  so the dashboard uses the same session auth as everything else — the REST API
  is for external callers, the dashboard manages keys over tRPC).
- UI under `apps/web/src/components/uptime/` (coverage scope): an "API keys" area
  — create (modal shows plaintext ONCE + copy + "you won't see this again"), list
  (name, prefix, lastUsed, created), revoke (type-to-confirm danger pattern per
  `.claude/rules/bulk-selection-patterns.md`). Gate behind
  `entitlements.apiAccess !== "none"`; gate idiom via `useBillingEntitlements()`
  → `!paymentsEnabled` ⇒ free; else `none` ⇒
  `<UpgradePrompt reason="apiAccessLocked" />` (reason **already exists**); else
  the manager. A small "API access: Limited/Full" badge. Uncodixify, RTL, dark-mode.

### Phase 5 — Docs / OpenAPI
- `docs/api/openapi.yaml` + a human "API reference": auth header, base URL from
  `SITE_URL`, every endpoint, the read/write tier gate, rate-limit headers, error
  shape. Optionally serve at `GET /api/v1/openapi.json` (public, no key).

### Tests
Server (vitest, real Postgres, **100% v8 coverage enforced**): the `/api/v1`
routes are Express, not tRPC — test via `supertest` against the app (or call the
exported router factory like `payment-route.ts` tests do) + `authedCaller` for the
tRPC `apiKey.*` management procedures. Use `useCleanDatabase()`; `mockFetch` where
needed.
- **Add `api_key` to `ALL_TABLES` (cascade-safe order) and a `createTestApiKey`
  factory in `apps/server/test/db.ts`.**
- Key lifecycle: create returns plaintext once + a stored hash that is NOT the
  plaintext; list never returns the secret; revoke → 401; expired → 401.
- Auth middleware: missing/garbage/revoked Bearer → 401; valid → resolves the
  right user.
- Entitlement gate: `apiAccess:"none"` → 403 all; `"limited"` → reads 200 / writes
  403; `"full"` → all 200. Drive via the entitlement resolver, not hand-set flags.
- Scope: key A cannot read/modify user B's monitor (404); list returns only the
  owner's rows.
- Tier limits via API: `POST /v1/monitors` past `maxMonitors` and below
  `minCheckIntervalSeconds` rejected exactly like tRPC (shared guard).
- Rate limit: N+1 within the window → 429 + `Retry-After`.
- Security: keys never in logs/responses; SHA-256 hashing asserted.
- OSS regression: payments-off → full API works for the default user.
Web (jsdom, **100% on `components/uptime/**`**): gated area hidden/upgrade-
prompted without entitlement; create shows plaintext once; revoke confirm flow.
Mock the Service layer; `createWrapper()`.

### i18n
- REST + middleware error messages localized via `Accept-Language` reusing
  `lib/i18n.ts`; add `errors.apiKeyInvalid`, `errors.apiKeyRevoked`,
  `errors.rateLimited`, `errors.apiKeyNotFound` to `DICTIONARIES` (all 5) and
  extend the completeness list in `lib/i18n.test.ts`.
- Frontend `apiKeys.*` block in all 5 `uptimeMonitor.json` (identical interp
  vars); ensure `upgrade.blocked.apiAccessLocked` exists in all 5.

### Documentation
- `ARCHITECTURE.md`: `api_key` table (§5); `/api/v1` surface + middleware + the
  Express mount-order change (§6 + §4); rate-limit single-replica caveat (§4).
- `.env.example`: `API_RATE_LIMIT_PER_MIN` (sensible default) + any `API_V1_ENABLED`
  toggle. `CHANGELOG.md` entry. `README.md`: a "Public API" mention linking the
  reference. Docker-only dev (`pulsy-*`).

## Agents & Skills

- **Agents:** `uptime-monitor-specialist` (keys + REST + middleware), `ui-designer`
  (key manager UI), `translation-manager` (locales), `legal-pages-manager`
  (acceptable-use / API terms wording).
- **Skills:** `uptime-monitor` (services to delegate to); `security-review`
  (**required** — token generation/storage, auth middleware, rate limiting,
  scope); `polar-provider` + `polar-api` (entitlement-resolver + plan-mapping
  context); `ui-ux-pro-max` + `shadcn-design-system-compliance` (key UI);
  `verify` (`curl` a key end-to-end against `/api/v1`); `code-review` (final pass).

## Idempotency Contract

Re-running MUST NOT: re-create the `api_key` table/migration or its `ALL_TABLES`/
factory entry, re-mount the `/api/v1` router or middleware twice in `index.ts`,
duplicate routes or the `apiKey.*` tRPC sub-router, or stack guards. The mount-
order invariant (cors → `/api/auth/*` → raw webhook → `express.json()` →
`/api/trpc` → `/api/v1`) must hold after every run. Reconcile in place.
