# Custom-Domain Status Pages — Build Prompt

> **Make the entitlement real** — introduce a first-class status-page entity, let
> users attach a verified custom domain to it, and serve the public page by Host
> header. Today there is only a per-user "all public monitors" page and a
> `customDomainStatusPages` flag that gates nothing.

---

## Agent

`uptime-monitor-specialist` (owns `uptime.ts`, `public.status`, the schema) +
`ui-designer` (management + public render). `translation-manager` for 5 locales.
Reuse the shared DNS-wizard pattern from `.claude/rules/service-component-patterns.md`
for the verify UI.

## Mission

Close a semantic gap first. Today:
- The public page is **per-user**: `public.status` (`uptime.ts:1538`) takes a
  `userId` and returns all monitors where `isPublic = true`; web route
  `apps/web/src/routes/status.$userId.tsx`.
- `maxStatusPages` is **mis-enforced as the count of public monitors**
  (`uptime.ts:440-459`), and the frontend usage view exposes
  `usage.publicStatusPageCount` (`apps/server/src/trpc/routers/billing.ts`
  `entitlements`).
- `uptime_monitor` has only `isPublic / statusPageTitle / statusPageDescription`
  (`packages/db/src/schema/uptime-monitor.ts:97-100`).
- `customDomainStatusPages` + `assertCustomDomainAllowed()` exist but are unused;
  no domain column, no host-based routing.

"25 status pages" + "custom-domain status pages" require a real **status-page
entity** (named page → slug → selected monitors → optional one verified custom
domain). Build that entity, DNS verification + Host routing, and migrate the
legacy per-user page onto it.

## Operating Constraints

| Rule | Detail |
|---|---|
| Entitlement gates | `maxStatusPages` → `assertWithinStatusPageLimit` counting **pages** (not public monitors now); custom domain → `assertCustomDomainAllowed`. Both in `apps/server/src/billing/tier-guard.ts`; errors `errors.tierStatusPageLimitReached` / `errors.tierCustomDomainNotAllowed` already exist in all 5 locales. |
| Usage reconcile | Update the `entitlements` procedure's `usage.publicStatusPageCount` to count `uptime_status_page` rows (not public monitors), and the web `useBillingEntitlements` consumer that reads it. |
| OSS-default | Payments off ⇒ `team_yearly` ⇒ 25 pages + custom domains free. No Polar in the path. |
| Public sanitization | The public resolve is a `publicProcedure` — one of the only public data surfaces (`.claude/rules/tob-authorization.md`, `.claude/rules/monitor-sharing-patterns.md`). Return ONLY the exact safe fields the current `public.status` returns (name, status, uptimePercentage, responseTime, lastCheckedAt, overall, recent incidents). NEVER url, httpStatus, TLS, channels, credentials, owner id/email. Centralize the picker (like `toSharedMonitorConfig` at `uptime.ts:198`); never inline an alternative shape. |
| Domain ownership | Serve a custom domain only after **DNS verification** (a TXT challenge at `_pulsy-verify.<domain>`). Unverified/unpublished → `NOT_FOUND` (indistinguishable from missing). |
| SSRF | DNS verification resolves a user hostname with Node `dns/promises` (not `fetch`). Any HTTP probe added must use `safeFetch()` (`apps/server/src/lib/ssrf.ts`). |
| Input validation | Strict hostname Zod schema: no scheme/path/port, lowercased, punycode-safe, ≤253 chars, reject IPs and `*`. Use the `api{Action}{Entity}` idiom in `validation.ts`. |
| TLS note | Cert issuance for custom domains is the operator's reverse proxy (nginx/Traefik) — document the CNAME + proxy expectation; no in-app ACME. |
| Scope | Every management query scoped by `ctx.user.id`. |
| Excluded | No multi-domain-per-page, no page password protection, no per-page theming beyond title/description/logoUrl. |

## Phases

### Phase 0 — Map & confirm
Read `uptime.ts` (`publicRouter.status` ~1537-1613; the status-page limit block
~440-459; `toSharedMonitorConfig` ~198), `status.$userId.tsx` + its hook chain
(`UptimeService.getPublicStatus` → `trpcQuery("uptimeMonitor","public.status")` →
`uptimeKeys.public.status`), `billing.ts` `entitlements` (the `usage` shape), and
`packages/db/src/schema/uptime-monitor.ts`. Confirm the entity design below in a
short note before writing migrations.

### Phase 1 — Schema & migration
Add to `packages/db/src/schema/uptime-monitor.ts`:
```
uptime_status_page
  statusPageId        text pk ($defaultFn nanoid)
  userId              text fk -> user (cascade)
  slug                text notnull            -- public path /s/:slug; unique per user
  title               text notnull
  description         text
  logoUrl             text
  isPublished         boolean notnull default false
  customDomain        text                    -- nullable; unique platform-wide when set
  domainVerified      boolean notnull default false
  domainVerifyToken   text                    -- TXT challenge value (randomBytes base64url)
  domainVerifiedAt    text
  createdAt           text notnull
  uniqueIndex (userId, slug); uniqueIndex (customDomain) where not null; index (userId)

uptime_status_page_monitor
  id                  text pk ($defaultFn nanoid)
  statusPageId        text fk -> uptime_status_page (cascade)
  uptimeMonitorId     text fk -> uptime_monitor (cascade)
  sortOrder           integer notnull default 0
  uniqueIndex (statusPageId, uptimeMonitorId); index (statusPageId)
```
- 1.1 Relations + `$inferSelect/$inferInsert` exports.
- 1.2 **Data migration:** for each user with ≥1 `isPublic` monitor, create one
  `uptime_status_page` (slug `default`, title from existing `statusPageTitle` or a
  default) and link those monitors. Keep `isPublic` as a deprecated back-compat
  read path (comment it). Generate via `pnpm --filter @pulsy/db generate`; hand-add
  only the backfill SQL into the generated file, documenting why (drizzle-kit can't
  express it). Update `drizzle/meta`.
- 1.3 Zod in `validation.ts`: `apiCreateUptimeStatusPage`, `apiUpdateUptimeStatusPage`,
  `apiSetStatusPageMonitors`, `apiAttachCustomDomain` (strict hostname),
  `apiResolveStatusPage`. Use `.superRefine()`/`requireField()` for conditional rules.

### Phase 2 — Backend: management sub-router (`uptimeMonitor.statusPage.*`)
`protectedProcedure`, Zod, `userId`-scoped; register under `uptimeRouter`:
- `list / one / create / update / delete` — `create` calls
  `assertWithinStatusPageLimit(entitlements, currentPageCount, ctx.t)`.
- `setMonitors` — replace the page's monitor set; verify every id belongs to the
  caller (count-mismatch → `NOT_FOUND`, mirroring `share.create`).
- `attachDomain` — `assertCustomDomainAllowed` first; validate hostname; enforce
  global uniqueness; generate `domainVerifyToken` (`randomBytes(24).toString("base64url")`,
  like share tokens); set `domainVerified=false`. Return the TXT record name+value.
- `verifyDomain` — resolve `_pulsy-verify.<domain>` TXT via `dns/promises`; on
  match set `domainVerified=true`, `domainVerifiedAt`. Idempotent.
- `detachDomain` — clear the domain fields.

### Phase 3 — Backend: public resolve
Add to `publicRouter` (the only public surface besides `status` / `sharedLink`):
- `statusPageBySlug({ userId, slug })` and `statusPageByDomain({ host })`.
- By domain requires `domainVerified && isPublished`; otherwise `NOT_FOUND`.
- Return ONLY the sanitized aggregate (reuse the exact `public.status` shape via a
  shared picker; compute overall status + last-7-day incidents identically).
- Keep legacy `public.status({ userId })` working (delegate to the user's
  `default` page) so existing `status.$userId.tsx` links don't 404.

### Phase 4 — Host-based routing
- 4.1 Server: the public resolve-by-Host is what makes a custom domain work.
  Confirm the CORS allow-list in `index.ts` does not reject verified custom-domain
  origins on the public GET path (public reads are uncredentialed); document that
  the reverse proxy must forward the original `Host`.
- 4.2 Web: add route `apps/web/src/routes/s.$slug.tsx` (slug page). The public
  render component detects a custom-domain context (when `window.location.host`
  is not the app host → resolve via `statusPageByDomain`, else by slug). **Extract
  the shared presentational pieces from `status.$userId.tsx`** into a
  `<PublicStatusContent>` rather than duplicating; `status.$userId.tsx`,
  `s.$slug.tsx`, and the domain path all render it.

### Phase 5 — Frontend management UI
- 5.1 Service/hooks/keys: status-page methods on
  `apps/web/src/services/uptime/uptimeService.ts`, hooks in `hooks/uptime/`, and a
  `statusPages.*` group in `uptimeKeys` (`queryKeys.ts`).
- 5.2 UI under `apps/web/src/components/uptime/` (in coverage scope): a "Status
  pages" area — list, create/edit (title, description, slug, monitor multi-select
  via the `useBulkSelection` pattern), publish toggle, and a **Custom domain**
  card showing the DNS record + a "Verify" button with a **not-verified / verified**
  badge (shared DNS-wizard pattern). Gate the custom-domain card behind
  `entitlements.customDomainStatusPages`; gate "create page" at `maxStatusPages`.
  Gate idiom: `useBillingEntitlements()` → `!paymentsEnabled` ⇒ free; else
  entitlement false ⇒ `<UpgradePrompt reason="customDomainLocked" />` /
  `reason="statusPageLimitReached"` (both reason codes **already exist** in
  `components/billing/upgrade-prompt.tsx`); else feature.
- 5.3 Uncodixify, RTL (logical props, `rtl:scale-x-[-1]` on directional icons),
  dark-mode tokens, 44px targets, URL tab state if tabbed.

### Tests
Server (vitest, real Postgres, **100% v8 coverage enforced**): `authedCaller` /
`publicCaller` (`test/trpc-caller.ts`), factories + `useCleanDatabase()`
(`test/db.ts`), `mockFetch` for any HTTP. **Mock `dns/promises` resolvers**
(inject or `vi.mock`) for verify tests.
- **Add `uptime_status_page` + `uptime_status_page_monitor` to `ALL_TABLES`
  (cascade-safe order, children before parents) and `createTestStatusPage` /
  `createTestStatusPageMonitor` factories in `test/db.ts`.**
- Limit: at `maxStatusPages` → create rejected with
  `errors.tierStatusPageLimitReached`; counting is **pages** (regression vs old).
- Custom domain: non-entitled → `errors.tierCustomDomainNotAllowed`; invalid
  hostnames (scheme/port/path/IP/`*`/>253) rejected by Zod; duplicate domain →
  conflict; verify flips `domainVerified` only on a matching TXT.
- Public sanitization: `statusPageByDomain`/`BySlug` never leak url/channels/
  credentials/owner identity; unverified/unpublished → `NOT_FOUND`;
  verified+published → safe aggregate.
- Scope: cross-user `setMonitors` with a foreign id → `NOT_FOUND`; all management
  queries filtered by `userId`.
- Migration/back-compat: a user with 2 public monitors gets one `default` page
  linking both; legacy `public.status({userId})` still returns them; `usage`
  count now reflects pages.
Web (jsdom, **100% on `components/uptime/**`**): gated cards hidden/upgrade-
prompted without entitlement; verify badge reflects state; `<PublicStatusContent>`
renders for slug + domain contexts. Mock the Service layer; `createWrapper()`.

### i18n
- Frontend `statusPage.*` in all 5 `uptimeMonitor.json` (page CRUD, slug, publish,
  custom domain, DNS record, verify, verified/not-verified) — identical interp
  vars; ensure `upgrade.blocked.customDomainLocked` / `.statusPageLimitReached`
  exist in all 5 (billing namespace).
- Server: add new error keys (`errors.statusPageSlugTaken`,
  `errors.customDomainTaken`, `errors.customDomainNotVerified`) to `DICTIONARIES`
  in `lib/i18n.ts` (all 5) and extend the completeness list in `lib/i18n.test.ts`.

### Documentation
- `ARCHITECTURE.md`: new tables (§5), `statusPage.*` + public resolve (§6),
  custom-domain/Host routing + proxy/TLS expectation (§4 + §12).
- `docs/`: "Custom-domain status pages" — CNAME + TXT steps, reverse-proxy TLS
  note, plan requirement; refresh `docs/screenshots/status-page.png` if the UI
  changed materially.
- `.env.example`: document `STATUS_PAGE_APEX` / verification host if introduced
  (else reuse `SITE_URL`). `CHANGELOG.md` entry. Docker-only dev (`pulsy-*`).

## Agents & Skills

- **Agents:** `uptime-monitor-specialist` (entity + public resolve + migration),
  `ui-designer` (management + public render), `translation-manager` (5 locales).
- **Skills:** `uptime-monitor` (feature map); `ui-ux-pro-max` +
  `shadcn-design-system-compliance` (mgmt + public UI, DNS-wizard pattern);
  `security-review` (**run it** — new public data surface + DNS/SSRF + open-
  redirect-adjacent host routing); `verify` + `run` (slug + custom-domain render
  end-to-end); `code-review` (final pass). `nextjs-seo` is **N/A** (Vite SPA, not
  Next.js) — do not invoke.

## Idempotency Contract

Re-running MUST NOT: re-create the two tables/migration, re-run the data backfill
(guard on "default page already exists for user"), duplicate the public procedures
or the `s.$slug` route, double-add `ALL_TABLES` entries, or stack guards. Legacy
`public.status` and `status.$userId.tsx` must keep working after every run.
Reconcile schema, routes, the `usage` count change, and `ALL_TABLES` in place.
