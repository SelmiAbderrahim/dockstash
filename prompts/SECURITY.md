# SECURITY.md — Dockstash Security Audit → Fix → Test → Prevent Prompt

Paste the prompt block below into a Claude Code session — or hand it to one of the security
agents/skills listed in **§ Agents & skills** — to run a full **find → fix → prove → prevent**
loop against the Dockstash codebase.

Scope: *this* repo only — Express 4 + Mongoose 8 + React 18 + Passport (local + JWT) +
BullMQ/Redis + Polar, plus the pull-based **fleet agent** daemon (`agent/`), self-hostable via
`docker compose up`. This is **not** a generic web-app checklist. It targets the specific
authorization, plan-cap-bypass, webhook-integrity, machine-token, command-execution, and
secret-handling surfaces this product actually exposes, with concrete file paths, so an agent
can go straight to the code path instead of re-discovering the architecture.

Dockstash orchestrates Docker backups: it `exec`s into tracked containers via a socket proxy,
spawns `restic`/`ssh`, and hands per-agent Bearer tokens to remote daemons. The crown-jewel
risks here are **command execution, cross-tenant resource isolation, and machine-token scope**
— not the LLM/vendor-crawl surfaces of a content product. Audit accordingly.

Everything runs **inside Docker** (`.claude/rules/docker-only-commands.md`) — no bare `npm`/
`node`/`npx`/`vitest` on the host. See **§ Notes for the operator** at the bottom.

---

## Agents & skills to drive this prompt

Use the repo's own tooling rather than a cold session — these carry the Dockstash rules and
hotspots as context:

| Tool | Kind | Best for |
|------|------|----------|
| `security-auditor` | agent (`.claude/agents/quality/security-auditor.md`) | **Read-only recon** (Read/Grep/Glob only). Run FIRST to produce the findings table without touching the tree. Knows the hotspots: Polar webhook raw-body mount order, agent composite-token verify, AES-256-GCM secret envelopes, restic/ssh argv-only spawn, docker-socket-proxy least privilege, entitlement caps before create. |
| `security-review-specialist` | agent (`.claude/agents/security/security-review-specialist.md`) | Deep semantic pass with Edit/Bash — the **fix + test** steps. Adapted from Anthropic's claude-code-security-review. |
| `security-test-specialist` | agent (`.claude/agents/testing/security-test-specialist.md`) | OWASP ZAP, `npm audit`, dependency/supply-chain scanning, zero-high-vuln gate enforcement (STEP 6). |
| `/security-review` | skill (`.claude/skills/security-review/`) | Scan modes: `full`, `branch`, `targeted`, `deps`, `secrets`, `auth`, `api`, `docker`, `pipeline`. Use `branch` on a PR, `auth`/`api` to narrow a pass. |
| `/code-review` (built-in) | skill | Correctness-focused diff review; complements the security pass on the same change. |
| `code-review-graph` MCP | MCP server | `get_impact_radius_tool` / `get_review_context_tool` to see what a fixed function touches before you edit it. |

**Recommended sequence:** `security-auditor` (recon, read-only) → this prompt with
`security-review-specialist` (fix + test) → `security-test-specialist` (dependency/ZAP gate)
→ `/code-review branch` on the resulting diff.

Governance rules the audit must honor live under `.claude/rules/` (see the list inside the
prompt). New prevention rules (STEP 5) go in the same directory and get a one-line entry in
`.claude/rules/README.md`.

---

## Prompt

```text
You are a security auditor and remediation engineer working INSIDE the Dockstash
repository. You have Read/Grep/Glob/Edit/Bash and can run the test suite (in Docker). Your
job is a complete loop: find real vulnerabilities, fix them, prove the fix with tests, and
add a governance rule so the class of bug cannot silently return.

Do NOT invent a scope document — the scope is this repository. Read these first and treat
them as the source of truth for intended behavior:

  - CLAUDE.md                                      (§2 stack, §5 conventions, §9 "does NOT do")
  - .claude/rules/docker-only-commands.md           (every build/test/runtime cmd runs in Docker)
  - .claude/rules/mern-feature-modules.md           (module isolation, public API via index.ts)
  - .claude/rules/mern-mongoose-typed-schemas.md    (typed schemas, InferSchemaType)
  - .claude/rules/environment-variables.md          (root .env only)
  - .claude/rules/site-url-env-pattern.md           (no hardcoded URLs; CLIENT_URL/SERVER_URL)
  - .claude/rules/git-destructive-commands.md       (never destructive git without confirmation)
  - docs/security-model.en.md                       (operator threat model — app hardening,
                                                     SSH host-key pinning, restic escrow,
                                                     master-key rotation, socket least-privilege)
  - docs/ci-gates.en.md                             (the gates you must not weaken)
  - docs/fleet-agents.en.md                          (pull-based agent daemon, /api/agent surface)
  - docs/polar-billing-and-webhooks.en.md            (webhook + subscription lifecycle)
  - docs/plans-and-limits.en.md                      (tiers, entitlement caps)
  - docs/data-rights.en.md                           (GDPR export/deletion)
  - server/src/shared/i18n/README.md                 (7-locale error-message dictionaries)

Reference map — the code you will be auditing lives here:
  - server/src/app.ts                               (middleware + route mount order)
  - server/src/config/                               (env.ts=zod env, passport.ts, logger.ts=redaction)
  - server/src/shared/middleware/                   (require-auth, require-role, require-agent-auth,
                                                     csrf, rate-limit, security-headers, no-store,
                                                     language, error-handler)
  - server/src/shared/crypto/                       (encryptSecret/decryptSecret=AES-256-GCM,
                                                     hashApiSecret/verifyApiSecret, keyRegistry, rotate)
  - server/src/shared/i18n/                          (dictionaries + locales.ts, 7 locales)
  - server/src/modules/billing/                      (entitlements.service.ts=assertProjectCap etc.,
                                                     webhook/{verify,ingest,handler}, providers/{polar,stripe},
                                                     plans.ts, order/subscription/customer/webhook-event models)
  - server/src/modules/auth/                         (passport.strategies, login-otp, trusted-device,
                                                     oauth/, auth.service token issuance/reset)
  - server/src/modules/agents/                       (agent-api.* = /api/agent machine surface,
                                                     agent-jobs.*, agents.model apiKeyHash)
  - server/src/modules/backups/                      (restic-runner=argv spawn, ssh-transport=host-key
                                                     pin, docker-client=socket-proxy, mirror.service,
                                                     restore.service, pitr, scan, discover)
  - server/src/modules/{users,scheduler,recovery,alerting,audit,health,legal,superadmin,settings}/
  - agent/src/                                        (fleet daemon: poller, executor, api-client,
                                                     restic-runner, docker-client, backup, config)

### Threat surfaces specific to this codebase — audit EACH explicitly

1. AUTHENTICATION & SESSION (Passport JWT)  [surface #1]
   - In server/src/app.ts confirm the Polar webhook raw-body route
     (app.post('/api/billing/webhook', createWebhookRateLimiter(), express.raw(...), webhookHandler))
     is mounted BEFORE `app.use(express.json(...))`. A handler after express.json() gets an
     already-consumed body stream — the HMAC then verifies against an empty buffer. Verify the
     current line numbers, don't assume.
   - Identity is read ONLY via Passport 'jwt' in shared/middleware/require-auth.ts. The strategy
     (modules/auth/passport.strategies.ts) extracts `Authorization: JWT <token>` and MUST pin the
     algorithm to HS256 (defend against alg=none / alg-confusion). It re-hydrates the user from DB
     per request so deletions/role changes apply immediately. Flag any hand-parsed token, any
     second `jsonwebtoken.verify` with a loose `algorithms`, any identity read off `req.cookies`.
   - Passwords: bcryptjs, generic "invalid email or password" (no enumeration). Email-verify and
     password-reset tokens must be CSPRNG and SHA-256-hashed AT REST (raw only emailed), with
     bounded TTL; forgot-password/resend must be non-enumerating. Flag plaintext token storage or
     an enumerable response.
   - Cookie/CORS/CSRF: CORS is `credentials: true` scoped to env.CLIENT_URL ONLY — flag a wildcard
     or reflected origin with credentials. CSRF (shared/middleware/csrf.ts) is double-submit and
     EXEMPTS requests bearing an `Authorization` header (bearer JWT can't be sent cross-origin
     silently). Confirm the CSRF cookie's `secure` flag in production, and whether `requireCsrf`
     is actually mounted on any cookie-authenticated mutating surface — if a cookie surface exists
     that skips it, that's a finding.
   - Rate limiters (shared/middleware/rate-limit.ts): createAuthRateLimiter on `/api/auth/*`
     credential mutations, createWebhookRateLimiter pre-HMAC, createContactRateLimiter on the
     contact form, createAgentRateLimiter on `/api/agent`. The read-only OAuth capability probe
     (oauthPublicRouter) is intentionally mounted BEFORE the auth limiter — confirm credential
     POSTs (sign-in/up/reset) are NOT similarly exempt. Note the limiter store is in-memory
     per-process; flag if a multi-instance deployment could bypass it AND that is load-bearing.
   - Superadmin step-up: login from an untrusted device requires email OTP (login-otp.service,
     trusted-device.model) and issues NO JWT until the challenge verifies. Confirm the OTP gate is
     in the live login path, not merely defined.

2. CROSS-ACCOUNT / IDOR ISOLATION  [surface #2]
   - EVERY resource load MUST be owner-scoped AT QUERY TIME:
       Model.findOne({ _id, owner: req.user.id })   (never findById(id) + a separate ownership if)
     Flag any findById(...) / findOne({ _id }) not joined to the owner, and anything with NO
     ownership check. Audit per module: backups (projects/snapshots), scheduler, recovery,
     agents, alerting, audit(log), settings, billing, legal.
   - Nested ownership: a snapshot/schedule/restore-drill/agent-job belongs to a project/agent that
     belongs to a user. An attacker can pass ANY id in the URL — confirm the parent is owner-scoped
     first and the child JOINs back to `owner`, not just the parent id.
   - Existence-leak policy: decide and enforce ONE convention per resource. NOTE: this repo's
     `requireRole` (shared/middleware/require-role.ts) returns 403 for an authenticated
     lower-privilege user (it does NOT 404-cloak) — do not "fix" that to 404 blindly. For
     OWNER-scoped resources, prefer 404 on a non-owned existing id so existence isn't leaked;
     flag inconsistency, but match the existing per-module convention rather than inventing one.
   - Role gates: only `/api/superadmin` is gated by requireRole(ROLE_SUPERADMIN) in app.ts.
     Confirm the middleware is APPLIED in the chain, not just exported, and that ROLE_ADMIN (rank 4)
     has no unintended write path if any admin surface exists.

3. PLAN CAPS / ENTITLEMENT BYPASS (tier gating)  [surface #3]
   - Cap enforcement lives in modules/billing/entitlements.service.ts: assertProjectCap,
     assertScheduleAllowed, assertRestoreDrillAllowed, assertAlertsAllowed, assertMultiVpsAllowed,
     assertMirrorAllowed, assertPitrAllowed, clampRetentionDays/clampRetentionPolicy, classifyCron.
     Every gated create/enable MUST call the matching assert at the API layer BEFORE the domain
     record is reserved or a queue job is enqueued. Required order: parse (zod) -> own (load
     owner-scoped) -> assertCapacity -> reserve -> enqueue. Flag caps checked only in a BullMQ
     worker, only in the resolver, or skipped on a create path.
   - Concurrency/TOCTOU: two simultaneous "create project" requests at remaining==1 must not both
     pass. If the cap is a read-then-write count, prove whether a unique index / atomic guard
     closes the window; flag if not.
   - Tier definitions come from plans.ts + the pricing-tier model — flag ad-hoc numeric limits
     hardcoded in a feature module instead of resolved from the tier.
   - Money is server-derived: subscription/order amounts come from the provider webhook + tier
     catalog, never a client-supplied amount trusted without re-derivation.

4. WEBHOOK & PAYMENT INTEGRITY (Polar)  [surface #4]
   - Standard-Webhooks HMAC verified on the RAW body BEFORE JSON.parse (modules/billing/webhook/
     verify + ingest). Flag any parse-before-verify, any `===`/`!=` string compare on the signature
     (must be timingSafeEqual), any missing/optional check. NOTE: POLAR_WEBHOOK_SECRET is optional
     in env — confirm that when it is UNSET the webhook FAILS CLOSED (rejects) rather than skipping
     verification. A skip-on-missing-secret is a Critical finding.
   - Idempotency: webhook-event.model records processed events; a replayed event must not
     double-grant a subscription or double-apply a lifecycle transition. Refunds/cancellations post
     linked state, never a silent hard delete of history.
   - The webhook route sits behind createWebhookRateLimiter BEFORE express.raw; confirm a flood of
     forged signatures can't exhaust CPU or the DB before rejection, and the limiter never consumes
     the body used for HMAC.

5. FLEET-AGENT MACHINE SURFACE (/api/agent)  [surface #5]
   - The `/api/agent` router (modules/agents/agent-api.*) authenticates daemons via
     require-agent-auth.ts: composite token `dsa_<24-hex agentId>.<48-hex secret>`, secret hashed
     with hashApiSecret (HMAC-SHA256 keyed by master key), verified with timingSafeEqual, unknown-id
     path still pays the HMAC cost against a dummy record (timing flatten), always ONE generic 401.
     Confirm none of these properties has regressed and no path returns a distinguishing error.
   - Per-agent scope: EVERY /api/agent handler must scope to `req.agent.id`/`req.agent.owner`. An
     agent claiming a job, reporting a result, or fetching config MUST only touch jobs/records for
     ITS OWN agent id — never another agent's or another owner's. Flag any agent-job lookup by job
     id alone without the agent-id join. This is the highest-value IDOR surface in the product.
   - Token lifecycle: issued once, never returned again; rotation (rotateAgentKey) invalidates the
     old token immediately. Flag any route that echoes an existing secret, or a rotation that leaves
     the old hash valid.
   - The agent daemon (agent/src): api-client must pin SERVER_URL from config (no hardcoded host),
     must not log its Bearer token, and executor/restic-runner/docker-client must not shell-inject
     server-supplied job parameters (see surface #6).

6. COMMAND EXECUTION / SSRF / INPUT VALIDATION  [surface #6]
   - Dockstash spawns external binaries. restic-runner (modules/backups/backups.restic-runner.ts)
     MUST spawn argv-only via child_process.spawn (NEVER a shell string, never `exec`/`sh -c`), pass
     the repo password via env not argv, and force safe SSH options for SFTP repos. Audit every
     spawn/exec across backups (restic-runner, ssh-transport, docker-client, mirror.service,
     restore.service, pitr, scan) AND agent/src (executor, restic-runner, docker-client): any
     user/job-supplied value (project name, path, repo URL, container id, cron) concatenated into a
     shell string is a command-injection finding.
   - SSH host-key pinning: ssh-transport MUST verify the pinned host key
     (STORAGE_SSH_HOST_KEY_FINGERPRINT), never fall back to StrictHostKeyChecking=no / auto-accept.
   - Docker socket: the api reaches Docker only via DOCKER_HOST=tcp://docker-socket-proxy:2375 with
     the endpoint allowlist (CONTAINERS/EXEC/INFO); it must NEVER bind-mount /var/run/docker.sock.
     Flag any direct socket mount, any dockerode/raw-socket path, any exec into a container the
     requesting user does not own.
   - SSRF: any server-side fetch that takes a user-supplied host/URL must enforce a scheme allowlist
     AND reject internal/loopback/link-local/metadata targets (169.254.169.254, 127.0.0.0/8, 10/8,
     172.16/12, 192.168/16, ::1, fc00::/7), re-validating on redirect. The known live surface is the
     alert webhook (modules/alerting/alert.service.ts `defaultWebhookPoster` POSTs to
     `project.alertWebhookUrl`, validated only as an http(s) URL in the alerts schema — no private-IP
     block). Also check mirror/remote destinations. zod-validate every request body (*.schema.ts).

7. SECRETS & DATA-AT-REST  [surface #7]
   - Restic repo passwords, SSH keys, and any at-rest secret use the AES-256-GCM envelope in
     shared/crypto (encryptSecret/decryptSecret, keyed by MASTER_ENCRYPTION_KEY; rotation via
     keyRegistry.ts + rotate.ts::rotateStore; re-encrypt is idempotent when keyVersion==target).
     Flag plaintext secret storage, a hardcoded key, an IV reused across encryptions, or a secret
     returned by any route. The plaintext restic password is shown once and never persisted/logged.
   - pino redaction (config/logger.ts) must cover Authorization headers, cookies, JWTs, passwords,
     SUPERADMIN_PASSWORD, POLAR_* creds, agent Bearer tokens, MASTER_ENCRYPTION_KEY, SSH keys. No
     secret in logs, thrown error messages, or recorded fixtures.
   - SUPERADMIN_EMAIL/PASSWORD seeder (modules/superadmin/superadmin.seed.ts) must be idempotent,
     never overwrite an existing account, and redact the password from every log line.
   - No `.env` outside repo root (environment-variables.md); no hardcoded URLs (site-url-env-pattern).

8. INJECTION & OUTPUT  [surface #8]
   - No Mongoose query built from unsanitized req.body/req.query enabling operator injection
     ({ $gt: '' }, $where, $regex DoS). Cast/validate every id (isValidObjectId); never spread
     req.query into a filter.
   - Role/authz output: superadmin endpoints must not leak other tenants' data; the superadmin
     console is gated by requireRole(ROLE_SUPERADMIN) — confirm every sub-route inherits it.
   - Data-rights export/delete (legal module) is owner-scoped, cannot exfiltrate another tenant,
     and honors the deletion grace window before a hard purge (docs/data-rights.en.md).
   - Error messages that reach the client are i18n keys, not raw exception text (no stack/secret
     leakage through the error handler).

### Deliverables — do ALL of these, in order

STEP 1 — FIND. Produce a findings table. Each finding:
  - id, title, file:line, threat surface (1-8 above), concrete failure scenario
    (specific inputs/state -> wrong output/access/spend), severity
    (Critical / High / Medium / Low), and confidence.
  Rank Critical/High first. Prefer FEWER, CONFIRMED findings over a long speculative list —
  read the code path end-to-end before asserting a bug. Mark anything unproven as "PLAUSIBLE".

STEP 2 — ADVERSARIAL INPUTS. For the top findings, write at least five realistic adversarial
  inputs (a raw HTTP request, a crafted agent token / job id, a forged/replayed Polar webhook,
  a project name or repo URL crafted for command injection, a concurrent double-request at the
  cap boundary) that would trigger each.

STEP 3 — FIX. For every Critical and High finding, implement the minimal correct fix in the
  repo, matching existing conventions:
    - Owner-scope the query at load time; scope every /api/agent handler to req.agent.id.
    - Move/add the matching entitlements assert to the API path if a cap bypass exists; keep the
      parse->own->assert->reserve->enqueue order.
    - Add zod validation + argv-only spawn (no shell) / SSRF guard where user input reaches a
      subprocess or server-side fetch.
    - Verify-before-parse for the webhook; fail CLOSED when POLAR_WEBHOOK_SECRET is unset;
      timingSafeEqual for signatures/keys.
    - Error messages as i18n keys present in ALL 7 locales (en, ar, fr, de, es, ru, zh):
      server dictionaries under shared/i18n/, client under its locale files. Parity tests stay green.
  Do NOT bind-mount the Docker socket, introduce a shell-string spawn, or add a raw vendor SDK
  outside its provider boundary. Do NOT weaken a rule, coverage gate, or lint rule to make a test
  pass. If a fix is risky or ambiguous, STOP and describe it instead of guessing.

STEP 4 — TEST. For EACH fixed finding add tests that FAIL before the fix and PASS after
  (state this explicitly per test):
    - Router-level integration tests via supertest against createApp() — the guarantee must hold
      through the REAL router, not just a service unit.
    - Cross-account test: a second user gets 404/403 (per the module's convention, NOT 200) on
      every owner-scoped resource touched; a second AGENT gets 401/404 on another agent's job.
    - Cap-bypass test: set a cap to N, create N, assert the N+1th is rejected with the correct
      localized message; add a concurrency test proving no over-cap under parallel requests.
    - Webhook test: tampered signature -> 4xx and NO state change; replayed event -> no double
      grant; unset secret -> reject (fail closed).
    - Command-injection test: a project name / repo URL containing shell metacharacters is passed
      as an argv element, never interpreted by a shell; host-key mismatch aborts the transfer.
    - SSRF test: internal/metadata IPs and non-http(s) schemes are rejected before any fetch.
  Use mongodb-memory-server for Mongo and recorded/redacted fixtures for external providers.
  Keep the CI coverage gate green on owned code.

STEP 5 — PREVENT. For each fixed CLASS of bug, add a guard so it cannot silently return.
  Preferred order:
    a) A machine-checked guard — a Vitest test in the module, OR a repo-wide meta-test
       (e.g. "every product router has a cross-account test", "every gated create calls an
       entitlements assert", "no child_process spawn uses a shell string"), OR an ESLint
       no-restricted-imports / no-restricted-syntax rule (e.g. ban `shell: true`, ban a raw
       docker socket path). NOTE: restic-runner/docker-client/adapters/paths are MANUALLY VENDORED
       into both server/src/modules/backups and agent/src — a guard tightened on one side silently
       regresses if the copies drift. A CI parity check between the two copies is a high-value guard.
    b) A markdown rule under .claude/rules/<topic>.md following the existing format
       (MANDATORY REQUIREMENT header, Correct/Forbidden examples, Validation Checklist), plus
       a one-line entry in .claude/rules/README.md. Update CLAUDE.md §5 if load-bearing.
  Prefer an EXECUTABLE check over prose whenever the invariant can be a test.

STEP 6 — VERIFY & REPORT. Run (Docker-only, per .claude/rules/docker-only-commands.md):
    docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
    docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
    docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npx vitest run --coverage
    docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npx vitest run --coverage
    docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm audit --audit-level=high
    # If the agent daemon was touched:
    docker run --rm -v "$PWD/agent":/app -w /app node:20-bookworm npx vitest run --coverage
  Then produce a final report: findings table -> per-finding fix summary (file:line) -> tests
  added (before/after status) -> rules added -> full suite + coverage + audit result. State
  plainly what was fixed and verified, what is still open, and what you deliberately did NOT
  touch and why.

### Ground rules
  - Every build/test/runtime command runs in Docker — never bare npm/node/npx on the host.
  - Report outcomes faithfully. If a test fails, show the output. If a fix is partial, say so.
  - Never disable a security control, coverage gate, or lint rule to pass CI.
  - Never bind-mount /var/run/docker.sock or spawn a subprocess through a shell.
  - Never run destructive git commands without explicit per-turn confirmation.
  - Do not commit or push unless asked; if asked, branch off master first.
```

---

## Notes for the operator

- **Docker-only:** every toolchain command runs inside `node:20-bookworm` (dev tooling) or via
  `docker compose` (stack) per `.claude/rules/docker-only-commands.md`. A green host run that
  can't be reproduced in a container is not a valid result.
- **Two-pass:** hand this prompt to `security-auditor` (read-only recon) FIRST for the findings
  table, then to `security-review-specialist` (or a `coder` agent) for the fix/test/prevent
  steps. Follow with `security-test-specialist` for the `npm audit` / dependency / ZAP gate.
- **Narrow a run** with the `/security-review` skill modes — `auth`, `api`, `secrets`, `deps`,
  `docker`, or `branch` on a PR — instead of a full sweep when you already know the surface.
- **Highest-value Dockstash surfaces** an auditor should not skip: (5) fleet-agent job scoping,
  (6) restic/ssh/docker command execution, (2) cross-account resource isolation, (4) fail-closed
  webhook verification. These are what this product exposes that a generic checklist misses.
- **The prevention step (STEP 5) is the durable payoff:** a leak fixed once but re-tested and
  rule-guarded stays fixed. Favor a meta-test that scans ALL modules (or an ESLint rule banning
  `shell: true` / a raw docker socket mount) over a rule that only a human reviewer enforces.
- **CI parity:** fixes must survive the same gate CI runs — typecheck → lint → v8 coverage →
  `npm audit --audit-level=high` (zero high/critical). See `docs/ci-gates.en.md`.
```
