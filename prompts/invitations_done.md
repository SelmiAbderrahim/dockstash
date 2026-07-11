# Superadmin Invitation Links & Influencer Outreach Pack — Build Prompt

> **Give the superadmin a growth lever** — mint single-use invitation links from a
> new superadmin tab that grant a chosen paid plan (`pro` or `business`) for
> **1 month or 1 year**, claimable at `/invite/:token` (through signup/login if
> needed). When the grant lapses the user falls back to `free` and the existing
> upgrade UI (`/billing?tab=plans`) takes over. Every claim emails the operator
> at `CONTACT_RECIPIENT`. Then ship the **`marketing/influencer-outreach/`**
> cold-DM pack that puts these links to work: scripts offering creators 1 free
> year of the Business plan.

---

## Agents

Primary implementer works solo (this is one feature slice across
`server/src/modules/billing/` + `modules/superadmin/` + the client `superadmin`
and `billing` features). Delegate review passes to `code-reviewer` and
`security-auditor` (new public token endpoint), UI polish to `react-specialist`.
Part 2 is skills-driven (see Phase 7 — this repo has no marketing agents).

## Mission

Today there is NO way to comp a plan: no CLI granter exists, the only path is
hand-editing a `Subscription` document. The superadmin screen
(`client/src/features/superadmin/components/SuperadminScreen.tsx:16`,
`TABS = ['overview','users','billing','audit','system']`, `?tab=` URL state via
`useTabParam`) has no invitation surface, and the entitlement resolver
(`server/src/modules/billing/entitlements.service.ts:43-90`) gates only on
`status` + `graceEndsAt` — it **never checks `currentPeriodEnd`** (`:69-81`),
so a time-boxed grant is currently unenforceable: an `active` row with a past
period end still entitles. Build the full feature:

1. **`Invitation` Mongoose model** (`modules/billing/invitation.model.ts`) —
   token, plan slug, grant duration, link expiry, single-use claim state,
   optional admin label. Typed via `InferSchemaType`, named export.
2. **Superadmin invitation routes** (create / list / revoke under
   `/api/superadmin/invitations`, gated at the app.ts mount) + a sanitized
   **public resolve** and a **verified claim** under a new `/api/invitations`
   mount.
3. **Time-boxed grant subscriptions** (`invite-grant-` prefixed
   `providerSubscriptionId`) with expiry enforced in the resolver AND a daily
   sweep — expired grantees land on `free` through the `applyProjectCap`
   funnel and see the existing upgrade/pricing UI. A real Polar purchase
   supersedes a live grant.
4. **Claim notification email** to `CONTACT_RECIPIENT` (silent-skip when
   unconfigured, never fails the claim).
5. **Superadmin "Invitations" tab** — create form + status list
   (pending / claimed / expired / revoked) with copy-URL and revoke.
6. **`/invite/:token` claim flow** through signup/login via a new
   `?invite=<token>` handoff param (none exists today — post-auth navigation
   is hardcoded, `Login.tsx:88-93` / `Register.tsx:73-78`).
7. **`marketing/influencer-outreach/`** — cold-DM pack (LinkedIn, X, other
   platforms) + reusable template, offer = 1 free year of Business.

## Operating Constraints

| Rule | Detail |
|---|---|
| Admin gate | Management routes live in `modules/superadmin/` and are gated ONLY at the mount: `app.ts:142` `app.use('/api/superadmin', verified, requireRole(ROLE_SUPERADMIN), superadminRouter)` (`verified = [requireAuth, requireVerified]`, `app.ts:100`). The sub-router imports no auth middleware — `injection-and-output-meta.test.ts` polices this. |
| Public surface | Exactly ONE new unauthenticated endpoint: `GET /api/invitations/:token` (resolve). It returns ONLY `{ plan, grantDuration, expiresAt, status }` — never `label`, `claimedBy`, `createdBy`, or the Mongo `_id`. Centralize the shape in a `toPublicInvitation()` serializer (mirror `serializeAgent`-style serializers). `POST /api/invitations/:token/claim` sits behind `verified`. |
| Token | Server-generated only: `randomBytes(24).toString('base64url')` (mint idiom: `agents.service.ts:47-49`). Stored plaintext on a `unique: true` indexed field with an inline `// plaintext-safe: single-use capability link; superadmin copy-URL-from-list requires the raw value; revocable, grants nothing but a comped plan` annotation (secrets-rule escape hatch). Indexed-equality lookup — no timing-safe compare needed. Accepted from the URL only as a trimmed ≤128-char `[A-Za-z0-9_-]+` string via zod, NEVER a redirect path. |
| Grant rows | One `Subscription` row: `provider` = an existing `PAYMENT_PROVIDERS` value (confirm the enum at `subscription.model.ts:42-46` in Phase 0 — use `polar`), `providerSubscriptionId: 'invite-grant-<invitationId>'`, `planSlug` = the invitation's plan, `status: 'active'`, `currentPeriodEnd = claimedAt + duration` (calendar math, 2.2). The `{provider, providerSubscriptionId}` unique index (`subscription.model.ts:104`) keeps grant and Polar rows distinct; there is NO one-active-per-user index — `findEffectiveSubscription` (`:117-130`) ranks by `STATUS_PRIORITY`. ALL grant logic (resolver, sweep, supersede, reconcile exclusion) is scoped STRICTLY to the `invite-grant-` prefix — Polar rows keep status-only semantics (`past_due` renewal grace must survive; see the regression test). |
| Reconcile hazard | `reconcileSubscriptions` (`modules/billing/reconcile.ts:92-157`) heals rows Polar doesn't recognize down to `free`. Grant rows MUST be prefix-excluded from reconcile or every sweep window nukes live grants. |
| Atomicity | Claim = atomic `Invitation.findOneAndUpdate({ token, claimedAt: null, revokedAt: null, expiresAt: { $gt: now } }, { $set: { claimedAt, claimedBy } })` — the agent-job-lease idiom; two racing claimers, exactly one wins (memory-mongo has no multi-doc transactions, so no `db.transaction`). If the subsequent `Subscription.create` throws, compensate by unsetting `claimedAt`/`claimedBy` so the link returns to `pending`. |
| Email safety | Dockstash transactional email is **plaintext-only** — `sendEmail` (`modules/communication/mailers/resend.ts:77-94`) with `text:` only, never the `html:` field (no `escapeHtml` helper exists and none is needed). Reuse the `deliverContactForm` → `contactFormRecipient()` pattern (`communication.service.ts:14-39`, reads `env.CONTACT_RECIPIENT`). Unconfigured inbox or `RESEND_API_KEY` unset = silent skip; a throwing send is logged and NEVER fails the claim (fire after the claim commits). |
| OSS-default | With `PAYMENT_PROVIDER=none`, `resolveEntitlements` returns the business ceiling for everyone (`entitlements.service.ts:47-55`) — invitations are a Cloud-ops tool. The tab, routes, and model must still boot and work (grants are inert but harmless); `registerBillingCrons` already no-ops without a provider (`billing.cron.ts:32-35`) so the sweep is naturally provider-gated. Never call Polar in the claim path. |
| Free-landing funnel | The sweep lands users on `free` — it MUST call `applyProjectCap(userId, 'free', { priorSlug })` (`lifecycle.service.ts:218-222`) exactly like `expireGraceIfNeeded` (`:148-167`). `entitlement-meta.test.ts:271-306` statically asserts free-landing branches pair with `applyProjectCap` — extend it to cover the sweep. Pause, never delete. |
| Scope | zod on every input (schemas in `invitation.schema.ts` / additions to `superadmin.schema.ts`, `*Schema` + `z.infer` type convention). Only paid plans grantable — `z.enum(['pro','business'])`; `free` rejected at the schema. Slugs come from `PLAN_SLUGS` (`subscription.model.ts:4`); month/year is pricing-only in Dockstash, so the grant duration enum is independent of the slug. |
| Excluded | No multi-use links, no org/team-scoped grants, no custom durations beyond the two, no revoke-cancels-an-already-activated-grant, no email to the claimant (claim OR expiry), no OAuth `?invite=` handoff (login/register only), no changes to the verify-email flow, no invite analytics dashboard. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `modules/superadmin/`: `superadmin.routes.ts:16-27` (route verbs),
  `superadmin.controller.ts` (asyncHandler + `req.t('superadmin.success.*')`),
  `superadmin.schema.ts` (pagination idiom `:13-18`, `OBJECT_ID_PATTERN` `:5`),
  `superadmin.service.ts:148-171` (list/skip/limit/`pages` shape,
  `escapeRegExp`), `superadmin.test.ts:33-49` (`createUser` / `tokenFor` with
  the `JWT ` scheme).
- 0.2 Read the billing spine: `subscription.model.ts` (fields, `PLAN_SLUGS`,
  `STATUS_PRIORITY`, `findEffectiveSubscription`, the `PAYMENT_PROVIDERS` enum
  values `:42-46`), `entitlements.service.ts:43-90` (resolver),
  `lifecycle.service.ts` (`applyProjectCap` `:218`, `expireGraceIfNeeded`
  `:148-167`, `expireAllOverdueGraces` `:174-198`, `notifyLifecycleEvent`
  `:102-113`), `webhook/registry.ts:78-159` (`upsertSubscription`),
  `reconcile.ts:92-157`, `billing.cron.ts:31-52`, boot wiring
  `server.ts:44-46` + shutdown `:88`.
- 0.3 Read the guards that will police you:
  `shared/middleware/entitlement-meta.test.ts` (free-landing pairs `:271-306`,
  notifier checks `:322-339`), `injection-and-output-meta.test.ts` (superadmin
  mount), `idor-meta.test.ts` (new router → cross-account test expectations).
- 0.4 Read the client side: `SuperadminScreen.tsx` (TABS `:16`, `useTabParam`
  `:22`, `TabsContent` blocks `:49-63`), `BillingTab.tsx:24-99` (the canonical
  fetch/Skeleton/Alert/Empty/Table/Pagination tab), `features/superadmin/`
  `api.ts` + `store/{thunks,slice,selectors}.ts` + `types.ts`,
  `app/routes.tsx:20-44` (appShellRoutes spread; marketing SSR covers ONLY
  `marketingRoutes`, `entry-server.tsx:29`), auth pages (`Login.tsx:88-93`,
  `Register.tsx:73-78`, `VerifyEmail.tsx:27` + `features/auth/routes.tsx:17-18`
  for the `:token` route idiom), `features/billing/` (`BillingPage.tsx:19,126`,
  `PricingGrid.tsx`, `routes.tsx:16-23`), `shared/ui/status-chip.tsx:11-30`,
  `shared/hooks/useCopyToClipboard.ts`.
- 0.5 Read email + i18n: `communication.service.ts` (`deliverContactForm`
  `:28-39`, lifecycle mailers `:135,:159,:177`), `mailers/resend.ts:63-94`
  (`setResendTransport` seam, silent-skip), `shared/i18n/` (`locales.ts:1` — 7
  locales, `en.ts:353` `DictionaryShape`, parity test `i18n.test.ts:39-71`,
  error-handler key detection `shared/middleware/error-handler.ts:7-22`).

### Phase 1 — Model & schemas
New `server/src/modules/billing/invitation.model.ts`:
```
Invitation
  token         String  required unique index   -- randomBytes(24).toString('base64url')
                                                 -- // plaintext-safe: single-use capability link (see constraints)
  planSlug      String  enum ['pro','business'] required
  grantDuration String  enum ['one_month','one_year'] required
  label         String  maxlength 120           -- optional admin note; NEVER public
  expiresAt     Date    required                -- link expiry (not grant expiry)
  revokedAt     Date    default null            -- null = live
  claimedAt     Date    default null            -- set atomically on claim
  claimedBy     ObjectId ref User default null  -- audit; survives user deletion (no cascade)
  createdBy     ObjectId ref User required
  { timestamps: true }
  index { createdAt: -1 }
```
- 1.1 `InferSchemaType` + named exports (`Invitation`, `InvitationDocument`,
  `GRANT_DURATIONS`, `GRANTABLE_PLAN_SLUGS`). Document the derived-status
  contract in the schema doc comment: `revokedAt → revoked; else claimedAt →
  claimed; else expiresAt <= now → expired; else pending` (claimed outranks
  expired — a claim that happened before expiry stays "claimed" forever). No
  stored status field.
- 1.2 zod in `modules/billing/invitation.schema.ts` (`*Schema` + `z.infer`
  convention):
  - `createInvitationSchema` — `planSlug: z.enum(['pro','business'])`,
    `grantDuration: z.enum(['one_month','one_year'])`,
    `expiresInDays: z.coerce.number().int().min(1).max(365).default(30)`,
    `label: z.string().trim().max(120).optional()`.
  - `listInvitationsSchema` — mirror the superadmin pagination idiom
    (`page` / `limit` coerce, `superadmin.schema.ts:13-18`).
  - `invitationIdParamsSchema` — anchored `/^[0-9a-fA-F]{24}$/` (reuse the
    `OBJECT_ID_PATTERN` idiom) for revoke.
  - `invitationTokenParamsSchema` —
    `token: z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/)`.
- 1.3 No migrations (Mongoose). Export the new pieces through
  `modules/billing/index.ts` (named re-exports only) so superadmin can import
  via the module's public API.

### Phase 2 — Grant lifecycle service
New `server/src/modules/billing/invitation.service.ts`:
- 2.1 `deriveInvitationStatus(row, now)` — pure, exported:
  `'pending' | 'claimed' | 'expired' | 'revoked'` per the 1.1 contract.
- 2.2 `claimInvitation(userId, token, { t })`:
  - already-subscribed guard FIRST: `findEffectiveSubscription(userId)` — if
    the effective row entitles a paid slug (status `active`, or `past_due`
    within grace), throw `HttpError.conflict(t('invitations.error.alreadySubscribed'))`
    and leave the link `pending` for someone else. Never clobber a paid sub.
  - the atomic one-winner `findOneAndUpdate` from the constraints table; when
    it returns null, re-read the row and throw the precise error:
    `invitations.error.notFound` / `.expired` / `.revoked` / `.alreadyClaimed`.
  - grant end via calendar math on the claim instant:
    ```ts
    const end = new Date(claimedAt);
    if (grantDuration === 'one_month') end.setUTCMonth(end.getUTCMonth() + 1);
    else end.setUTCFullYear(end.getUTCFullYear() + 1);
    ```
  - `Subscription.create` per the Grant-rows constraint; on throw, compensate
    (unset `claimedAt`/`claimedBy`) then rethrow.
- 2.3 `sweepExpiredInviteGrants(now = new Date())` — mirror
  `expireAllOverdueGraces` (`lifecycle.service.ts:174-198`): find
  `{ providerSubscriptionId: /^invite-grant-/, status: 'active',
  currentPeriodEnd: { $lte: now } }`, flip each to `status: 'canceled'`, then
  `applyProjectCap(userId, 'free', { priorSlug })`. Per-user failures logged,
  loop continues (non-fatal, same as the grace sweep).
- 2.4 Resolver enforcement in `entitlements.service.ts`: inside
  `resolveEntitlements`, a row whose `providerSubscriptionId` starts with
  `invite-grant-` AND whose `currentPeriodEnd <= now` is **non-entitling** —
  falls through to `free` (exact-time enforcement, no sweep-lag window). Polar
  rows explicitly untouched (they may legitimately carry a past
  `currentPeriodEnd` while `active` until the renewal webhook lands).
- 2.5 Webhook supersede in `webhook/registry.ts::upsertSubscription`: in the
  `status === 'active'` branch (`~:122`), before/alongside the upgrade side
  effects, flip the user's live `invite-grant-` rows to `canceled` — purchase
  beats grant. No `applyProjectCap` here (the user is landing on a paid plan,
  not free).
- 2.6 Reconcile exclusion in `reconcile.ts`: `reconcileSubscriptions` must
  skip `invite-grant-` rows entirely (they have no Polar counterpart to
  reconcile against).
- 2.7 Register the sweep in `billing.cron.ts` beside the existing two jobs
  (`:37-44`): id `billing.invite-grant-expiry`, cron `30 3 * * *`, handler
  `() => void sweepExpiredInviteGrants()`. Add it to `unregisterBillingCrons`
  (`:48-52`). `NodeCronScheduler.register` is idempotent by id — rely on that.

### Phase 3 — HTTP surface
- 3.1 Superadmin routes in `superadmin.routes.ts` (controller in
  `superadmin.controller.ts`, thin, delegating to the billing module's public
  API):
  - `POST /invitations` — parse `createInvitationSchema`, mint token, insert
    (`expiresAt = now + expiresInDays * 86400_000`), return the full row incl.
    `token` (the UI builds the URL from `window.location.origin`).
  - `GET /invitations` — paginated, newest first, `{ invitations, total, page,
    pages }` shape (`superadmin.service.ts:148-171` idiom), claimant email
    populated in one query, `status` derived via 2.1. Returns `token`
    (superadmin-only surface).
  - `PATCH /invitations/:id/revoke` — sets `revokedAt` (never deletes —
    audit). Rejects claimed links (`invitations.error.alreadyClaimed`);
    revoking must not touch an already-activated grant.
- 3.2 New `modules/billing/invitation.routes.ts`, mounted in `app.ts` as
  `app.use('/api/invitations', invitationRouter)`:
  - `GET /:token` — public. Unknown token →
    `HttpError.notFound('invitations.error.notFound')`. Known token →
    `toPublicInvitation()` payload `{ plan, grantDuration, expiresAt, status }`
    even when expired/revoked/claimed (the claim page renders a friendly
    dead-link state from `status`).
  - `POST /:token/claim` — behind `verified` (route-level
    `[requireAuth, requireVerified]`) → `claimInvitation(...)`; on success
    fires the Phase 4 email (post-claim, fire-and-forget) and returns
    `{ plan, grantDuration, currentPeriodEnd }`.

### Phase 4 — Claim notification email
In `modules/communication/communication.service.ts`:
- `deliverInvitationClaimedEmail({ claimant, planSlug, grantDuration,
  currentPeriodEnd, label })` — exact `deliverContactForm` shape (`:28-39`):
  recipient from `contactFormRecipient()` (`env.CONTACT_RECIPIENT`), subject +
  plaintext body from the server dictionary (`email.inviteClaimed.subject` /
  `.body`, rendered in `DEFAULT_LOCALE`; keys shipped in all 7 locales for the
  parity gate). Body: claimant name + email, plan, grant window (claimedAt →
  currentPeriodEnd), invitation `label`, and a link to
  `${CLIENT_URL}/superadmin?tab=invitations` (normalize the trailing slash,
  `verifyUrlFor` idiom `auth.service.ts:55-57`). Text only — never set `html`.
  Unconfigured recipient/API key → silent skip (`sendEmail` already does
  this); a send failure is logged and never propagates to the claim response.

### Phase 5 — Superadmin "Invitations" tab
- 5.1 Add `'invitations'` to `TABS` (`SuperadminScreen.tsx:16`) + a
  `<TabsContent value="invitations"><InvitationsTab /></TabsContent>` block —
  the trigger renders automatically from the array; label via
  `t('tabs.invitations')`.
- 5.2 New `features/superadmin/components/InvitationsTab.tsx` (copy the
  `BillingTab.tsx:24-99` skeleton):
  - Create form: plan `Select` (pro / business), duration `RadioGroup`
    (1 month / 1 year), link-expiry `Select` (7/30/60/90-day presets feeding
    `expiresInDays`), optional label `Input`. Submit via `Button loading`
    (interaction-hygiene rule). On success: sonner `toast` + copy-ready URL.
  - List `Table`: label, plan, duration, `StatusChip` (tones per SPEC-A1:
    pending=`warning`, claimed=`success`, expired=`muted`,
    revoked=`destructive` — `shared/ui/status-chip.tsx` names invites as an
    intended consumer), claimant email, expiry date, created date, inline
    actions: copy URL (`useCopyToClipboard`,
    `${window.location.origin}/invite/${token}`) + revoke (disabled for
    claimed/revoked). Reuse `features/superadmin/components/Pagination.tsx`.
  - Monochrome design system: semantic tokens only, flat cards, lucide icons,
    RTL logical utilities (`ps-`/`pe-`), all six interaction states.
- 5.3 Extend the RTK layers: `features/superadmin/api.ts` (fetch/create/revoke
  via `apiClient` + the local `withQuery` helper), `store/thunks.ts`
  (`createAsyncThunk` + `messageFromError` template `:25-35`), `store/slice.ts`
  (pending/fulfilled/rejected branches; mutations set `actionPending` +
  `message`), `store/selectors.ts`, `types.ts` (`SuperadminState` +
  `invitations`, `loadingInvitations`). Reducer/routes are already wired
  (`app/store.ts:11,23`, `app/routes.tsx:14,34`) — no new wiring.

### Phase 6 — Claim flow (`/invite/:token`)
- 6.1 New route in `features/billing/routes.tsx`: `{ path: 'invite/:token',
  element: <InvitationClaimPage /> }` — **unguarded** (public resolve must
  render logged-out), inside the CSR app shell (NOT marketing SSR; the `:token`
  segment outranks the marketing `*` catch-all, see `app/routes.tsx:50-51`).
  Token via `useParams` (`VerifyEmail.tsx:27` idiom).
- 6.2 Auth handoff — build the param that doesn't exist yet: `Login.tsx` and
  `Register.tsx` read `?invite=` via `useSearchParams`, validated as a token
  only (trimmed, ≤128 chars, `[A-Za-z0-9_-]+` — NEVER a path):
  ```ts
  const invite = /^[A-Za-z0-9_-]{1,128}$/.test(raw ?? '') ? raw : '';
  ```
  After successful auth, when `invite` is present and the user is verified,
  navigate to `/invite/${invite}` instead of the hardcoded `/dashboard`
  (`Login.tsx:88-93`, `Register.tsx:73-78`; superadmins keep their
  `/superadmin` branch). The login ↔ signup cross-links must carry the param.
  OAuth (`OAuthCallback.tsx`) and the verify-email flow are explicitly
  untouched (Excluded).
- 6.3 New `features/billing/components/InvitationClaimPage.tsx`:
  - No session → redirect to `/login?invite=${token}` (the `RequireAuth.tsx`
    redirect idiom, but parameterized).
  - Pre-claim: `GET /api/invitations/:token` → offer summary (plan name via
    the existing `t('plan.${slug}')` keys, `BillingPage.tsx:83`, duration,
    link expiry) + one-click "Activate" `Button loading`.
  - Authenticated-but-unverified: render a "verify your email first" state
    (the server claim is behind `requireVerified`) with a CTA to
    `/verify-email`.
  - Dead links: distinct friendly states for expired / revoked / claimed
    (from resolve `status`) and an `alreadySubscribed` error state from the
    claim mutation — each with a CTA to `/dashboard` or `/billing?tab=plans`.
  - Success: confirmation with the grant end date, CTA to `/dashboard`. After
    the grant lapses users see the existing upgrade surfaces
    (`BillingPage`/`PricingGrid`) — build NO new upgrade UI.
- 6.4 Extend `features/billing/api.ts` + `store/thunks.ts`/`slice.ts`/
  `selectors.ts`/`types.ts` for resolve + claim (same RTK layering as the rest
  of billing).

### Tests
Server (`server/`, vitest + supertest against `createApp()`,
`mongodb-memory-server` via `shared/testing/mongo.ts`
(`startMemoryMongo`/`stopMemoryMongo`/`clearCollections`), per-suite
`createUser`/`tokenFor` helpers with the `JWT ` header scheme
(`superadmin.test.ts:33-49`), **100% v8 coverage enforced** — `include:
src/**`, no config edits needed):
- Superadmin routes: create/list/revoke happy paths; non-superadmin caller →
  403 (Member AND Admin roles); unauthenticated → 401; revoke of a claimed
  link rejected; revoke is soft (`revokedAt` set, doc remains); list derives
  all four statuses; zod rejects `free`, `expiresInDays` out of 1–365,
  >120-char label; invalid `:id` → 400, never a CastError 500.
- Claim: correct `currentPeriodEnd` for BOTH durations (calendar math incl. a
  month-end claim like Jan 31); expired / revoked / already-claimed /
  already-subscribed each throw their distinct key; **concurrent double-claim**
  (`Promise.all`, two users) leaves exactly one winner and one grant row;
  compensating rollback — force `Subscription.create` to throw and assert the
  link returns to `pending`.
- Public resolve: sanitization (assert `label`, `claimedBy`, `createdBy`,
  `_id` ABSENT from the payload); dead links resolve with the right `status`;
  unknown/malformed token → 404/400.
- Entitlements: live grant → the granted plan's entitlements; elapsed grant →
  `free` at read time (resolver, no sweep); **regression** — a Polar `active`
  row with a past `currentPeriodEnd` stays entitled (prefix scoping works);
  `PAYMENT_PROVIDER=none` still returns the business ceiling.
- Sweep: flips only elapsed `invite-grant-` rows and calls `applyProjectCap`
  (assert a project over the free cap gets paused); leaves live grants and
  Polar rows alone. Webhook supersede: a Polar activation cancels the live
  grant first. Reconcile: `invite-grant-` rows skipped.
- Email: `setResendTransport` seam asserts recipient/subject/text payload;
  unset `CONTACT_RECIPIENT` or `RESEND_API_KEY` → no send, claim still 200; a
  throwing transport → claim still 200.
- Meta-tests: extend `entitlement-meta.test.ts` so the sweep's free-landing
  branch is statically asserted to pair `applyProjectCap`; satisfy
  `idor-meta.test.ts` expectations for the new `/api/invitations` mount (the
  role/cross-account tests above are the coverage); `injection-and-output-meta`
  must stay green (no auth imports in the superadmin sub-router).
- i18n: add every new key to the parity expectations in
  `shared/i18n/i18n.test.ts` (the typed `DictionaryShape` already fails the
  compile on a missing locale).

Client (`client/`, vitest + jsdom, **100% coverage** on `src/**` — `shared/ui`
and `**/types.ts` are excluded, everything else you add must be fully
covered):
- Store tests per the `features/superadmin/store/thunks.test.ts` template
  (`vi.mock('../api')`, local `configureStore`, `thunk.fulfilled.match`).
- Component tests per `superadminComponents.test.tsx:1-60` (Provider +
  I18nextProvider + HelmetProvider + MemoryRouter + TooltipProvider wrapper,
  `initI18n({ initialLocale: 'en' })`, `baseState()` + preloadedState, mocked
  api): create form validates + submits + shows copy URL; table renders all
  four `StatusChip` tones; revoke disabled when claimed; claim page renders
  offer, activates, and renders each dead-link / unverified / error state;
  Login/Register `?invite=` consumption (valid token navigates, path-shaped
  value ignored).

Target — **100% pass, 100% coverage, Docker-only** (never host `npm`):
```bash
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm test
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm test
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run lint
```

### i18n
Seven locales everywhere: `en, ar, fr, de, es, ru, zh`.
- Client: an `invitations` block + `tabs.invitations` label in all 7
  `client/src/shared/i18n/locales/{locale}/superadmin.json` files (form
  labels, durations, statuses, copy/revoke/toasts) and an `invite` block in
  all 7 `billing.json` files (claim page: offer summary, activate, success,
  expired/revoked/claimed/alreadySubscribed/verifyFirst states). Identical
  `{{var}}` interpolation across locales. Existing namespaces only — no
  `resources.ts`/`NAMESPACES` edits.
- Server: `invitations.error.{notFound,expired,revoked,alreadyClaimed,alreadySubscribed}`,
  `superadmin.success.{invitationCreated,invitationRevoked}`, and
  `email.inviteClaimed.{subject,body}` added to
  `shared/i18n/dictionaries/en.ts` first (source of truth), then all 6 other
  dictionaries — the `DictionaryShape` type makes a missing key a compile
  error, and `i18n.test.ts` enforces `{{var}}` parity.
- No hardcoded user-facing strings anywhere; error keys must pass the
  error-handler's key-shape detection (`errors.`-style dotted keys,
  `error-handler.ts:7-22`).

### Documentation
- `docs/plans-and-limits.*.md` (all 7 locale files): short "Invitation
  grants" section — what a grant is, prefix semantics, lapse behavior, that a
  purchase supersedes a grant.
- `.env.example`: ensure `CONTACT_RECIPIENT=` is present with a one-line
  comment (it already exists in `config/env.ts:101-104`; no new env var).
- State explicitly in the PR/commit body: no new env vars, no migrations, no
  coverage-config edits.

### Phase 7 — Part 2: Influencer outreach pack (`marketing/`)
The repo-root `marketing/` folder EXISTS (positioning/launch docs). Add the
subfolder:
```
marketing/influencer-outreach/
  README.md          — the program: offer = 1 free year of Business via an
                       invitation link; how to mint one (superadmin →
                       Invitations tab); label attribution convention
                       ("li-<handle>", "x-<handle>", "yt-<handle>", …) so
                       claims map back to the DM that produced them;
                       single-use + link-expiry mechanics ("expires in 30
                       days" is honest urgency); how to track claimed status
                       in the tab; reply & objection handling.
  linkedin-dm.md     — ready-to-send cold DM + 2 follow-ups (day 3, day 8) +
                       a <300-char connection-note variant.
  x-dm.md            — X/Twitter DM + a public-reply opener variant for
                       closed DMs; respects platform length limits.
  other-platforms.md — adaptations for Reddit (modmail/DM etiquette,
                       subreddit self-promo norms), YouTube creators
                       (business-inquiry email), Bluesky DM.
  dm-template.md     — the base template with {name} / {platform} /
                       {content_reference} / {invite_link} slots, a
                       personalization checklist (must reference one real
                       piece of the person's content), and the offer framing.
```
- 7.1 Author with these skills (no marketing agents exist in this repo):
  `cold-email` (structure, follow-up cadence, CTA), `hormozi-grand-slam-offer`
  (frame the free year via the value equation + risk reversal — it's free,
  single-use, expires), `hormozi-lead-magnets` (the invite link IS the
  magnet), `social-content` (per-platform voice), `marketing-psychology`
  (reciprocity + scarcity, no dark patterns).
- 7.2 Content rules: every message personalized (no mail-merge blast copy);
  target audience = DevOps/self-hosting/Docker creators (Dockstash backs up
  Docker projects — volumes, databases, configs — restic-based); honest
  scarcity only (the link really is single-use and really expires); include a
  disclosure note — if the creator posts about Dockstash, they must disclose
  the free year (FTC-style material-connection disclosure); the ask is "try
  it, share it if you like it", never pay-for-praise. Reference the REAL
  product surface (`/invite/<token>` URLs on `CLIENT_URL`, the plan name
  "Business (1 year)").
- 7.3 English only; plain markdown; no i18n, no code, no coverage
  implications.

## Agents & Skills

- **Agents (Part 1):** solo implementation; `code-reviewer` +
  `security-auditor` for review (new token surface + new public endpoint),
  `react-specialist` for the two UI surfaces, `unit-test-specialist` if the
  coverage tail drags.
- **Skills:** `dockstash-design` (both new UI surfaces — StatusChip tones,
  monochrome tokens, interaction hygiene), `security-review` (**required** —
  new public token endpoint + grant path), `verify` + `run` (end-to-end: mint
  a link as superadmin → open `/invite/:token` logged-out → sign up → verify
  → activate → assert the billing overview reflects the plan → assert the
  operator email fired via the transport seam), `code-review` (final pass).
  Part 2 skills as listed in 7.1.

## Idempotency Contract

Re-running MUST NOT: duplicate the `'invitations'` `TABS` entry, register a
second `billing.invite-grant-expiry` cron (register-by-id is idempotent —
still don't add a second call site), stack the resolver (2.4) / webhook
supersede (2.5) / reconcile exclusion (2.6) edits, duplicate i18n keys in any
dictionary or JSON file, re-add the `.env.example` line, or duplicate route
mounts in `app.ts`. Marketing files are reconciled in place (overwrite, never
append duplicates). On completion, rename this file with the `_done` suffix
(see `prompts/RENAME-PROMPT-FILE.md`).
