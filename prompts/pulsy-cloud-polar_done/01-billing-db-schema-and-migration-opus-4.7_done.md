# Billing Database Schema & Migration — Build Prompt

> **Data layer for Pulsy Cloud** — new Drizzle tables for subscriptions, customers, webhook idempotency, plan config, and Team organizations. Modeled on password-manager `payment.ts`.

---

## Agent

`polar-integration`. Invoke the `polar-provider` skill (DB-schema section of
`references/integration-checklist.md`) before writing tables.

## Mission

Add `packages/db/src/schema/billing.ts` (modeled on password-manager
`packages/server/src/db/schema/payment.ts`), Zod validation schemas, and a
generated drizzle migration. This is the data foundation every later billing
prompt depends on.

## Operating Constraints

| Rule | Detail |
|---|---|
| Per-user scoping | Every data table keeps `userId` (FK → `user`, cascade) and an **optional** `organizationId`. Per `.claude/rules/tob-authorization.md`. |
| Idempotency | `webhookEvent` has a **UNIQUE (provider, eventId)** constraint — the dedupe backbone for prompt 03. |
| One active sub | Enforce "one active subscription per scope" (UNIQUE partial on `userId`/`organizationId` + active status). |
| Dates | ISO-8601 UTC text, consistent with existing uptime tables. |
| IDs | nanoid string PKs, matching `uptimeMonitorId` conventions. |
| Migration tool | `drizzle-kit` — generate, do not hand-edit SQL. Docker-only (`make migrate`). |
| Excluded | No columns for multi-region or SMS/voice. |

## Phases

### Phase 0 — Study the model + current schema
0.1 Read password-manager `db/schema/payment.ts` (tables, enums, columns).
0.2 Read Pulsy `packages/db/src/schema/uptime-monitor.ts` for table/enum/index
idiom and `validation.ts` for the Zod pattern (`apiCreate*`, `superRefine`).

### Phase 1 — Define enums
`paymentProvider` (`polar`, extensible), `subscriptionStatus`
(`active`/`trialing`/`past_due`/`canceled`/`incomplete`/`paused`),
`webhookStatus` (`pending`/`processed`/`failed`/`skipped`), `billingInterval`
(`monthly`/`yearly`), `organizationMemberRole` (`owner`/`admin`/`member`).

### Phase 2 — Define tables in `billing.ts`
- `customer` — `customerId`, `userId` FK, `provider`, `providerCustomerId`, timestamps.
- `subscription` — `subscriptionId`, `userId` FK, optional `organizationId` FK,
  `plan` (text: `free`/`pro_monthly`/`pro_yearly`/`team_monthly`/`team_yearly`),
  `status`, `provider`, `providerSubscriptionId`, `currentPeriodStart/End`,
  `cancelAtPeriodEnd`, `trialEndsAt`, timestamps. UNIQUE active-per-scope.
- `webhookEvent` — `webhookEventId`, `provider`, `eventId`, `eventType`,
  `payload` (jsonb), `headers` (jsonb), `status`, `processedAt`, `retryCount`,
  `error`, timestamps. **UNIQUE (provider, eventId)**.
- `pricingTier` — `tierId`, `slug`, `name`, price columns, entitlement columns
  mirroring the §-tier table, Polar product id columns, timestamps.
- `organization` — `organizationId`, `ownerUserId` FK, `name`, `slug`, timestamps.
- `organizationMember` — `memberId`, `organizationId` FK (cascade), `userId` FK
  (cascade), `role`, `invitedAt`, `joinedAt`. UNIQUE (organizationId, userId).

Add indexes mirroring uptime conventions (user idx, status idx, scope idx).

### Phase 3 — Validation schemas
Add `apiCreateSubscription`, `apiCreateOrganization`, `apiInviteOrganizationMember`,
etc. to `packages/db/src/schema/validation.ts` (Zod, `superRefine` where
plan/role-specific). Export table types.

### Phase 4 — Migration
Generate the drizzle migration via `drizzle-kit` in the `pulsy-server`
container. Confirm it applies cleanly against a fresh DB.

### Tests
- Schema-level: migration applies and rolls forward cleanly (Docker `make migrate`).
- UNIQUE (provider, eventId) rejects a duplicate insert.
- UNIQUE active-subscription-per-scope rejects a second active sub.
- Zod schemas: 100% branch coverage for valid/invalid inputs incl. plan-id and
  role enums; org-member invite rejects unknown role.
- Cascade: deleting a `user` cascades subscription/customer/org-member rows.

### i18n
- No user-facing strings in schema. Validation error keys (if surfaced) are added
  in prompt 08; reference them by key here, do not hardcode messages.

### Documentation
- Note the new tables for the `ARCHITECTURE.md` §5 update — performed in prompt 10.

### Agents & Skills
- Agent: `polar-integration`. Skill: `polar-provider` (schema checklist).

## Idempotency Contract

Re-running MUST NOT create duplicate tables/columns or a second migration for an
already-applied schema. If `billing.ts` exists, reconcile columns in place and
regenerate the migration only if the schema diff is non-empty.
