# Dockstash — Security Remediation Prompt Batch

These 10 prompts decompose `prompts/SECURITY.md` into **one self-contained,
end-to-end remediation spec per threat surface**, plus a read-only recon pass
that feeds them and a final verify-and-report pass that closes the loop. Each
prompt implements the **find → adversarial-inputs → fix → test → prevent**
mini-loop for its surface; together they cover the full six-step
FIND→FIX→TEST→PREVENT→VERIFY loop `SECURITY.md` mandates.

Scope is the **Dockstash** repo only — Express 4 + Mongoose 8 + React 18 +
Passport (local + JWT) + BullMQ/Redis + Polar, plus the pull-based fleet-agent
daemon (`agent/`). The crown-jewel risks are **command execution, cross-tenant
resource isolation, machine-token scope, and webhook integrity** — these prompts
target those surfaces with concrete file paths so an agent goes straight to the
code path instead of re-discovering the architecture.

Source of truth: `prompts/SECURITY.md`. Do not invent a scope document — read
`SECURITY.md` and the rules it references first.

## Prompts (run in numeric order)

| # | Surface / step | Today's risk | File |
|---|----------------|--------------|------|
| 00 | STEP 1 — Recon: findings table across all 8 surfaces | No unified read-only recon; fixes get attempted blind | `00-recon-findings-opus-4.8.md` |
| 01 | Surface #1 — Authentication & session (Passport JWT) | alg-confusion, raw-body mount order, CSRF-bearer exemption drift, OTP gate not live | `01-auth-session-passport-jwt-opus-4.8.md` |
| 02 | Surface #2 — Cross-account / IDOR isolation | `findById` without owner join; nested-child IDOR; agent-job IDOR | `02-cross-account-idor-isolation-opus-4.8.md` |
| 03 | Surface #3 — Plan caps / entitlement bypass (tier gating) | caps checked only in worker/resolver; TOCTOU at cap boundary | `03-plan-caps-entitlement-bypass-opus-4.8.md` |
| 04 | Surface #4 — Webhook & payment integrity (Polar) | parse-before-verify; `===` on signature; skip-on-missing-secret; replay double-grant | `04-webhook-payment-integrity-polar-opus-4.8.md` |
| 05 | Surface #5 — Fleet-agent machine surface (`/api/agent`) | agent-job lookup by id alone; token echoed; composite-token verify drift | `05-fleet-agent-machine-surface-opus-4.8.md` |
| 06 | Surface #6 — Command execution / SSRF / input validation | shell-string spawn; SSH auto-accept; raw docker socket; alert-webhook SSRF | `06-command-execution-ssrf-input-validation-opus-4.8.md` |
| 07 | Surface #7 — Secrets & data-at-rest | plaintext secret; reused IV; leaked secret in route/log; pino redaction gaps | `07-secrets-data-at-rest-opus-4.8.md` |
| 08 | Surface #8 — Injection & output | Mongo operator injection; superadmin tenant leak; raw exception leakage | `08-injection-and-output-opus-4.8.md` |
| 09 | STEP 6 — Verify & report: full suite + coverage + npm audit gate + final report | No closing gate; partial fixes ship unproven | `09-verify-and-report-opus-4.8.md` |

**Recommended sequence** (from `SECURITY.md` § Agents & skills):
`00` (read-only recon) FIRST → it produces the findings table that prioritizes
`01`–`08`. Run the surface prompts in numeric order — `02` (IDOR), `05`
(agent), `06` (command exec), `04` (webhook) are the highest-value Dockstash
surfaces and must not be skipped. Close with `09` (verify + report), which
re-runs the full Docker toolchain and produces the deliverable report.

## Step → prompt mapping

| `SECURITY.md` step | Prompt(s) |
|---|---|
| STEP 1 — FIND | `00` (recon, all surfaces) |
| STEP 2 — ADVERSARIAL INPUTS | folded into `01`–`08` (per surface) |
| STEP 3 — FIX | folded into `01`–`08` (per surface) |
| STEP 4 — TEST | folded into `01`–`08` (per surface) |
| STEP 5 — PREVENT | folded into `01`–`08` (per surface) |
| STEP 6 — VERIFY & REPORT | `09` (final gate + report) |

## Agents & skills matrix

Agents from `.claude/agents/`; skills from the Skill tool. Run a
`/security-review` skill pass on **01, 04, 05, 06, 07** before merging — these
hold the crown-jewel surfaces.

| Prompt | Primary agent | Supporting agents | Skills |
|--------|---------------|-------------------|--------|
| 00 Recon findings | `security-auditor` | — | `security-review` (`full` mode, read-only) |
| 01 Auth & session | `security-auditor` | `typescript-pro` | `security-review` (`auth` mode), `backend-i18n` |
| 02 IDOR isolation | `security-auditor` | `backend-dev` | `security-review` (`api` mode), `vitest-unit-testing` |
| 03 Plan caps / entitlements | `security-auditor` | `backend-dev` | `security-review` (`api` mode), `spec-driven-development` |
| 04 Webhook / payment integrity | `security-auditor` | `backend-dev` | `security-review` (`api` mode), `payment-orchestrator` |
| 05 Fleet-agent surface | `security-auditor` | `backend-dev` | `security-review` (`auth` + `api` mode) |
| 06 Command exec / SSRF | `security-auditor` | `backend-dev` | `security-review` (`docker` mode), `docker-workflow-automation` |
| 07 Secrets / data-at-rest | `security-auditor` | `typescript-pro` | `security-review` (`secrets` mode) |
| 08 Injection / output | `security-auditor` | `backend-dev` | `security-review` (`api` mode) |
| 09 Verify & report | `security-test-specialist` | `dependency-manager`, `code-reviewer` | `security-review` (`deps` mode), `lint`, `code-review` (`branch`) |

## Shared context every prompt assumes

- **Scope source of truth:** `prompts/SECURITY.md` — read it before any prompt
  here. The eight threat surfaces (§ "Threat surfaces specific to this
  codebase — audit EACH explicitly") and the six-step deliverable list
  (§ "Deliverables — do ALL of these, in order") are the contract.
- **Reference map:** `server/src/app.ts` (middleware + route mount order),
  `server/src/config/`, `server/src/shared/{middleware,crypto,i18n}/`,
  `server/src/modules/{billing,auth,agents,backups,users,scheduler,recovery,
  alerting,audit,health,legal,superadmin,settings}/`, and the agent daemon at
  `agent/src/`. Each surface prompt names its exact paths.
- **Rules honored live** (under `.claude/rules/`): `docker-only-commands.md`
  (every build/test/runtime cmd runs in Docker — never bare `npm`/`node`/`npx`
  on the host), `environment-variables.md` (root `.env` only — no subdirectory
  `.env`), `site-url-env-pattern.md` (no hardcoded URLs; `CLIENT_URL`/
  `SERVER_URL`), `git-destructive-commands.md` (no destructive git without
  per-turn confirmation), `mern-feature-modules.md`, `mern-mongoose-typed-
  schemas.md`.
- **i18n:** **7 locales — `en, ar, fr, de, es, ru, zh`** — server dictionaries
  under `shared/i18n/`, client under its locale files. Every new/changed
  user-facing error message is an i18n key present in ALL 7 dictionaries; key
  parity tests stay green. RTL for `ar` (`rtl-support-arabic.md`).
- **Tests:** vitest both sides. Server: node, `fileParallelism:false`, v8
  coverage, supertest against `createApp()`, `mongodb-memory-server`.
  Router-level integration tests are mandatory — the guarantee must hold
  through the REAL router, not a service unit. External systems (Restic,
  dockerode, SSH, Polar REST) are **injectable** so orchestration is
  unit-testable with recorded/redacted fixtures.
- **Cross-copy parity:** `restic-runner`, `docker-client`, and adapter paths
  are **manually vendored** into BOTH `server/src/modules/backups/` AND
  `agent/src/`. A guard tightened on one side silently regresses if the copies
  drift — a CI parity check between the two copies is a high-value STEP 5 guard
  (see prompt `06`).
- **CI gates** (`docs/ci-gates.en.md`): typecheck → lint → v8 coverage →
  `npm audit --audit-level=high` (zero high/critical). Do not weaken a gate,
  coverage threshold, or lint rule to make a test pass.
- **Ground rules** (`SECURITY.md` § Ground rules): report outcomes faithfully;
  never disable a security control, coverage gate, or lint rule to pass CI;
  never bind-mount `/var/run/docker.sock`; never spawn a subprocess through a
  shell; never run destructive git without per-turn confirmation; do not commit
  or push unless asked (if asked, branch off `master` first).

## Conventions

- **Model tier:** every executable prompt ends `-opus-4.8.md` (Hardest tier —
  security-critical work). This alias is mapped in the executor's
  `MODEL_ALIASES` (`prompt-executor/prompt_executor/config.py` →
  `claude-opus-4-8[1m]`), so `prompt_executor.py --mode=auto` routes each file
  automatically. On credit/quota errors it sticky-swaps to its peer `gpt-5.5`.
- Run the prompts in order (`00` → `09`). On completion, rename a finished
  file with a `_done` suffix (see `prompts/RENAME-PROMPT-FILE.md`). `README.md`
  is a reference file — the executor skips it.
- **Read-only first:** `00` is `security-auditor` (Read/Grep/Glob only) — it
  produces the findings table that drives the rest. The surface prompts
  (`01`–`08`) are `security-review-specialist` (Edit/Bash) for the fix+test
  steps; `09` is `security-test-specialist` for the dependency/ZAP gate.
