# Dockstash — Build Prompt Batch

These 12 prompts turn `IDEA.md` (the Dockstash architecture + product spec) into an executable
build plan: a MERN orchestrator around **Restic** that makes backing up any Docker project one
click — **secure, 100%-tested, Polar-billed, Resend-simple**. Each prompt is a standalone,
end-to-end build spec (backend + Mongo schema + UI + i18n×7 + tests + docs + env + idempotency),
matching the format of `prompts/pulsy-cloud-features/`.

They build **on the existing MERN starter in this repo** — passport-JWT auth, zod-validated
`server/src/config/env.ts`, typed `apiClient` (`client/src/shared/api/client.ts`), Socket.IO, and
the vitest + supertest + `mongodb-memory-server` harness — and **reuse** all of it.

## Prompts (run in numeric order)

| # | Feature | Today's state | File |
|---|---------|---------------|------|
| 00 | Dockerize stack + strip demo | No Docker; demo features (messaging/pages/sales/template + chat) still present | `00-dockerize-stack-and-strip-demo-opus-4.7.md` |
| 01 | i18n foundation — 7 locales + auto-detect | No i18n; English-only (CLAUDE.md §9) | `01-i18n-foundation-seven-locales-autodetect-opus-4.7.md` |
| 02 | Crypto / secrets / env foundation | No at-rest encryption; env lacks Polar/Resend/encryption vars | `02-crypto-secrets-and-env-foundation-opus-4.7.md` |
| 03 | Backup core — scan + adapters + restic | No backup engine | `03-backup-core-scan-adapters-restic-opus-4.7.md` |
| 04 | Verification — `restic check` + restore drill | No proof a backup restores | `04-backup-verification-check-and-restore-drill-opus-4.7.md` |
| 05 | Scheduler + queue (BullMQ) + live logs | No scheduler, no queue, no log streaming | `05-scheduler-queue-bullmq-socketio-opus-4.7.md` |
| 06 | Polar billing core + webhooks | Billing is Stripe-only, no provider abstraction | `06-polar-billing-core-and-webhooks-opus-4.7.md` |
| 07 | Plans / entitlements / lifecycle + billing UI | No entitlements, no per-project metering | `07-plans-entitlements-lifecycle-and-billing-ui-opus-4.7.md` |
| 08 | Observability — Resend + alerts + audit + health | Mailer is Mailgun; no failure alerts/heartbeat/audit | `08-observability-resend-alerts-audit-health-opus-4.7.md` |
| 09 | Disaster recovery — self-backup + export/import | Tool can't recover itself | `09-disaster-recovery-selfbackup-and-export-opus-4.7.md` |
| 10 | Shadcn 4-screen dashboard + setup wizard | No product UI | `10-shadcn-four-screen-dashboard-and-wizard-opus-4.7.md` |
| 11 | Security + legal + CI in Docker | No rate-limit/helmet/CSRF, no CI, no GDPR flows | `11-security-legal-and-ci-in-docker-opus-4.7.md` |
| 13 | Billing-lapse data integrity + dunning notifications | Downgrade destructively prunes snapshots below the new tier's retention ceiling (contradicts "never deleted"); cancel/revoke webhook skips pausing; dunning/downgrade emails never wired; reconcile can't heal a fully-canceled subscription; paused projects' schedules keep firing; fleet-agent cap not re-asserted on downgrade; GDPR purge can orphan a legal-hold project | `13-billing-lapse-data-integrity-and-notifications-opus-4.7.md` |

**Dependency order:** 00 (containers) → 01 + 02 (cross-cutting foundations: i18n + crypto) →
03 + 04 (backup engine + proof) → 05 (orchestration) → 06 + 07 (billing plumbing → model/UI) →
08 (alerting) → 09 (DR) → 10 (full UI, surfaces every feature) → 11 (hardening + CI gates, last) →
13 (closes lifecycle-wiring gaps left by 07 + 08, run any time after both).
Each prompt names the prior prompts it assumes.

## Agents & skills matrix

Agents come from `.claude/agents/`; skills from the Skill tool. Run a `security-review` skill pass
on **02, 06, 11** before merging.

| Prompt | Primary agent | Supporting agents | Skills |
|--------|---------------|-------------------|--------|
| 00 Dockerize / strip | `build-engineer` | `cicd-engineer` | `docker-workflow-automation`, `verify`, `code-review` |
| 01 i18n foundation | `backend-dev` | `react-specialist` | `backend-i18n`, `shadcn-design-system-compliance`, `code-review` |
| 02 Crypto / secrets / env | `security-auditor` | `typescript-pro` | `security-review`, `code-review` |
| 03 Backup core | `backend-dev` | `typescript-pro` | `spec-driven-development`, `docker-workflow-automation`, `unit-test → vitest-unit-testing` |
| 04 Verification / drill | `tester` | `backend-dev` | `enterprise-testing-framework`, `comprehensive-testing-strategy`, `verify` |
| 05 Scheduler + queue | `backend-dev` | — | `docker-workflow-automation`, `vitest-unit-testing` |
| 06 Polar billing core | `backend-dev` | `security-auditor` | `payment-orchestrator`, `security-review` |
| 07 Plans / entitlements / UI | `backend-dev` | `react-specialist` | `shadcn-design-system-compliance`, `ui-ux-pro-max`, `url-tab-state` (rule) |
| 08 Observability / Resend | `backend-dev` | — | `postal-transactional-email`, `backend-i18n` |
| 09 Disaster recovery | `backend-dev` | — | `spec-driven-development`, `docker-workflow-automation` |
| 10 Shadcn dashboard | `react-specialist` | `testing-accessibility-auditor` | `ui-ux-pro-max`, `shadcn-design-system-compliance`, `verify`, `run` |
| 11 Security / legal / CI | `security-auditor` | `cicd-engineer`, `dependency-manager` | `security-review`, `lint` |

## Shared context every prompt assumes

- **Existing server modules** (`server/src/modules/`): `auth` (`authRouter`, `protectedRouter`),
  `users` (`User`, `ROLE_*`, `toPublicUser`), `billing` (**Stripe** — `stripe.client.ts`,
  `getStripe`, `handleStripeWebhook` → refactored behind `IPaymentProvider` in 06),
  `communication` (**Mailgun** — `mailers/mailgun.ts`, `sendEmail` → swapped to Resend in 08),
  `chat` (`chat.socket.ts`, `registerChatSocket` → removed in 00, **the Socket.IO `io` instance is
  kept** for backup-log streaming).
- **Module shape:** `<name>.controller.ts` / `.service.ts` / `.model.ts` (Mongoose
  `InferSchemaType` + named export) / `.schema.ts` (zod) / `.routes.ts` / `.test.ts` / `index.ts`
  (named re-exports). Mount in `server/src/app.ts` behind `requireAuth`.
- **Shared infra:** `requireAuth`, `errorHandler`, `notFound`, `requestId`
  (`server/src/shared/middleware/`); `HttpError` (`.badRequest/.unauthorized/.forbidden/
  .notFound/.conflict/.internal`) + `asyncHandler` (`shared/utils/`); `startMemoryMongo` /
  `stopMemoryMongo` / `clearCollections` (`shared/testing/mongo.ts`); crypto helper
  `shared/crypto/` (`encryptSecret`/`decryptSecret`, added in 02).
- **Env:** all new vars (`PAYMENT_PROVIDER`, `POLAR_*`, `MASTER_ENCRYPTION_KEY`, `RESEND_*`,
  `ALERT_HEARTBEAT_HOURS`) flow through the zod schema in `server/src/config/env.ts` (root `.env`
  only — `.claude/rules/environment-variables.md`). Polar/Resend are **optional** so the Free /
  self-host tier runs without them.
- **Client:** features under `client/src/features/<name>/` (components, `store/{slice,thunks,
  selectors}.ts`, `api.ts`, `types.ts`, `routes.tsx`, `index.ts`); `apiClient<T>`
  (`shared/api/client.ts`); register reducers in `app/store.ts`, routes in `app/router.tsx`;
  path aliases `@/@app/@features/@shared`; **Shadcn + Tailwind** for the product UI.
- **i18n (from 01):** **7 locales — `en, ar, fr, de, es, ru, zh`** — with **auto-detection**
  (client `navigator.language`; server `Accept-Language`) and **RTL for `ar`**. Every user-facing
  client string **and** backend response message (errors + success) is localized; key-parity is
  tested. This supersedes CLAUDE.md §9's "English-only".
- **Tests:** vitest both sides. Server: node, `fileParallelism:false`, v8 coverage, supertest
  against `createApp()`, `startMemoryMongo`. Client: jsdom + React Testing Library. **100%
  coverage gate** (lines/branches/functions/statements) enabled in 11; external systems (Restic,
  dockerode, SSH, Polar REST) are **injectable** so orchestration is unit-testable with mocks.
- **Docs:** `/docs` (created in this batch) — user-facing pages authored in **all 7 languages**;
  skip docs only where purely internal.
- **Docker-first** (00, supersedes CLAUDE.md §9 "No Docker"); pinned deps from public npm only;
  conventional commits; destructive git only with per-turn confirmation
  (`.claude/rules/git-destructive-commands.md`).
- **Pulsy references to mirror** (`/home/serverlessbase/pulsy`): `apps/server/src/services/
  polar.ts`, `payments/providers/polar.ts`, `webhooks/handlers/polar-handler.ts`,
  `webhooks/webhook-router.ts`, `billing/plans.ts`, `billing/pulsy-polar-config.ts`.

## Conventions

- **Model tier:** every executable prompt ends `-opus-4.7.md` (Hardest tier). This alias **is**
  mapped in the executor's `MODEL_ALIASES` (`prompt-executor/prompt_executor/config.py` →
  `claude-opus-4-7[1m]`), so `prompt_executor.py --mode=auto` routes each file automatically with
  no `-m/--model` override needed. On credit/quota errors it sticky-swaps to its peer `gpt-5.5`.
- Run the prompts in order (`00` → `11`). On completion, rename a finished file with a `_done`
  suffix (see `prompts/RENAME-PROMPT-FILE.md`). `README.md` is a reference file — the executor
  skips it.
