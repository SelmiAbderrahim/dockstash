# Surface #5 — Fleet-Agent Machine Surface (`/api/agent`) — Build Prompt

> **Closes findings under threat surface #5 of `prompts/SECURITY.md`.** Owns
> the composite-token verify properties (timing flatten, single generic 401),
> per-agent scope on EVERY `/api/agent` handler (the highest-value IDOR in the
> product), token lifecycle (issued once, rotation invalidates immediately),
> and the agent daemon's `SERVER_URL` pin + no-token-logging + no-shell-
> injection discipline. Implements STEP 2 → STEP 3 → STEP 4 → STEP 5 for this
> surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `backend-dev` for the
agent-api handlers and the agent-daemon (`agent/src`) rewrites. Run `00-recon-
findings` FIRST and read its surface-#5 rows. Cross-link with prompt `02`
(agent-job IDOR by job-id-alone is the joint surface) and prompt `06`
(executor/restic-runner/docker-client shell-injection is surface #6).

## Mission

For every Critical/High finding under surface #5 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs: a second agent's token, a tampered composite
   token, a job-id-alone lookup, a token-echo route, a rotation that leaves
   the old hash valid.
2. Fix: every `/api/agent` handler scopes to `req.agent.id`/`req.agent.owner`;
   the verify path preserves timing flatten + single 401; rotation
   invalidates immediately; the daemon pins `SERVER_URL` and never logs its
   token.
3. Add supertest tests: a second agent gets 401/404 on another agent's job;
   tampered token → single generic 401; replayed/rotated token → reject.
4. Add a STEP 5 meta-guard: "every `/api/agent` handler scopes to
   `req.agent.id`" + a server/agent cross-copy parity check.

## Operating Constraints

| Rule | Detail |
|---|---|
| Composite-token verify properties | `dsa_<24-hex agentId>.<48-hex secret>`; secret HMAC-SHA256 keyed by master key; verified with `timingSafeEqual`; unknown-id path still pays the HMAC cost against a DUMMY record (timing flatten); always ONE generic 401 (no distinguishing error). |
| Per-agent scope | EVERY `/api/agent` handler scopes to `req.agent.id`/`req.agent.owner`. Agent-job lookups JOIN on `agentId` — never by job id alone. |
| Token lifecycle | Issued once, never returned again. Rotation (`rotateAgentKey`) invalidates the old hash immediately (atomic swap). No route echoes an existing secret. |
| Daemon pin | `agent/src/api-client` pins `SERVER_URL` from config (no hardcoded host), never logs its Bearer token. |
| No shell injection | `agent/src/{executor,restic-runner,docker-client}` spawn argv-only — never a shell string with server-supplied params. (Full treatment in surface #6; here we flag and hand off.) |
| Timing flatten symmetry | The agent verify path's timing-flatten approach should mirror the webhook verify path's (surface #4) — keep them consistent. |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | The agent surface returns ONE generic 401 (no body) — no key needed. Any admin-facing agent-management error is a key in ALL 7 dictionaries. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#5 rows. Read
  `prompts/SECURITY.md` § "5. FLEET-AGENT MACHINE SURFACE".
- 0.2 Read `server/src/shared/middleware/require-agent-auth.ts` end-to-end.
  Confirm the five verify properties (composite format, HMAC-SHA256 hash,
  `timingSafeEqual`, dummy-record timing flatten, single generic 401).
- 0.3 Read `server/src/modules/agents/agent-api.{routes,controller}.ts` —
  every handler. List which look up by job id alone (the IDOR surface).
- 0.4 Read `modules/agents/agents.model.ts` (`apiKeyHash`), `agent-jobs.*`,
  `agent-api.service` (claim/result/config-fetch).
- 0.5 Read `agent/src/{api-client,executor,restic-runner,docker-client,
  config}` — the daemon side. Confirm `SERVER_URL` pin, no token logging, no
  shell string.

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs:
- Agent A's composite token requesting agent B's job id (`POST /api/agent/
  jobs/:id/claim`, `/result`, `/config`) — assert 200 today (finding), 401/404
  after fix.
- A tampered composite token (`dsa_` + malformed agentId/secret, a secret for
  a non-existent agentId, a secret with a wrong length) — assert a single
  generic 401 with NO distinguishing body/timing.
- An agent-job lookup by job id ALONE (no `agentId` join) in any handler —
  assert cross-agent access today (finding), scoped access after fix.
- A rotation that leaves the old hash valid — assert the old token still
  authenticates today (finding), rejected immediately after fix.
- A route that echoes an existing secret (e.g. a GET that returns the agent
  record with `apiKeyHash` or, worse, the plaintext) — assert leakage today
  (finding), redaction after fix.
- A daemon log line containing its Bearer token — assert the token appears in
  logs today (finding), absent after fix.

### Phase 2 — Fix (STEP 3)
- 2.1 **Per-agent scope**: for every `/api/agent` handler, replace
  `AgentJob.findById(req.params.jobId)` with
  `AgentJob.findOne({ _id: req.params.jobId, agentId: req.agent.id })` (or
  the equivalent that JOINs through the agent's owner). Claim/result/config
  handlers all touch ONLY the calling agent's jobs/records.
- 2.2 **Verify properties**: confirm `require-agent-auth.ts` (a) parses the
  composite format, (b) HMAC-SHA256-hashes the provided secret with the master
  key, (c) compares with `timingSafeEqual` against the stored hash, (d) on an
  unknown agentId loads a DUMMY record and still runs the HMAC + compare (so
  timing is flat), (e) returns ONE generic 401 always. Restore any regressed
  property.
- 2.3 **Token lifecycle**: rotation (`rotateAgentKey`) atomically swaps the
  `apiKeyHash` (and bumps a `keyVersion`/`rotatedAt` if present); the old
  hash is invalid on the very next request. Remove any route that returns an
  existing secret — the plaintext is shown exactly ONCE at creation/rotation
  and never persisted/logged.
- 2.4 **Daemon pin + no-log**: `agent/src/api-client` reads `SERVER_URL` from
  `agent/src/config` (which reads from the daemon's env/config file — no
  hardcoded host). The Bearer token is never passed to the logger; the pino
  redaction in the daemon covers `Authorization`/`Bearer`. (Mirrors the server
  redaction from surface #7.)
- 2.5 **No shell injection (handoff)**: flag any `executor`/`restic-runner`/
  `docker-client` spawn that concatenates server-supplied params into a shell
  string; the fix belongs to prompt `06`. Note the handoff in `findings.md`.

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server):
- **Per-agent scope**: seed owner A → agent A → job A; owner B → agent B →
  job B. Agent A's token requests job B by id → 401/404 (NEVER 200). State
  fail-before status. Cover claim, result-report, and config-fetch handlers.
- **Composite-token verify**: a valid token → 200; a tampered secret → 401;
  an unknown agentId → 401; ALL three return the IDENTICAL response body +
  headers (no distinguishing message). A timing test (best-effort) asserts
  unknown-id and wrong-secret take comparable time (within tolerance).
- **Rotation invalidates immediately**: after `rotateAgentKey`, the OLD token
  → 401 on the next request; the NEW token → 200. The plaintext of the new
  token is returned exactly once (at the rotation response) and never again.
- **No secret echo**: a `GET /api/agents/:id` (or admin listing) does NOT
  return `apiKeyHash` or any plaintext secret in the response body.
- **No token in daemon logs**: run the daemon's api-client against a test
  server, capture the daemon's pino destination, assert no log line contains
  the Bearer token.
- **Daemon `SERVER_URL` pin**: a config without `SERVER_URL` fails fast at
  startup (no hardcoded fallback host).

### Phase 4 — Prevent (STEP 5)
- a) **Meta-test**: "every handler in `modules/agents/agent-api.*` references
  `req.agent.id` (or `req.agent.owner`) in its DB query". Scan the controller
  for the handlers and assert each one's query shape includes the agent
  scope. List handlers lacking it and FAIL.
- b) **Meta-test**: "the agent verify middleware (`require-agent-auth.ts`)
  references `timingSafeEqual`, loads a dummy record on the unknown-id path,
  and returns a single 401 status". A static scan that fails on regression.
- c) **Cross-copy parity check**: `restic-runner`, `docker-client`, and the
  adapter paths are MANUALLY VENDORED into BOTH `server/src/modules/backups/`
  AND `agent/src/`. A high-value guard is a CI step that diffs the two copies
  (or a meta-test that imports both and asserts byte-shape parity on the
  spawn helpers). Coordinate with prompt `06` which owns the spawn fix; here
  we add the parity harness.
- d) Add `.claude/rules/agent-machine-surface.md` (MANDATORY REQUIREMENT
  header, Correct/Forbidden examples, Validation Checklist) and a one-line
  entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5. Cross-reference
  `docs/fleet-agents.en.md`.

## i18n

The `/api/agent` surface returns ONE generic 401 (no body) — no key needed.
Admin-facing agent-management errors (rotation success/failure, key reveal
copy in the UI) land in ALL 7 server + client dictionaries. Parity test
green. RTL for `ar`.

## Documentation

- `docs/fleet-agents.en.md` — annotate the composite-token verify properties,
  per-agent scope (`req.agent.id` on every handler), token lifecycle (issued
  once, rotation invalidates immediately, no echo), daemon `SERVER_URL` pin +
  no-token-logging, and the cross-copy parity guard.
- `docs/security-model.en.md` — note that the agent surface is timing-flat,
  single-401, per-agent-scoped.
- `CLAUDE.md` §5 — reference the new rule file.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (agent-api
  handlers + daemon rewrites).
- **Skills:** `/security-review` `auth` + `api` mode (deep semantic pass —
  **required** before merge); `code-review` (final diff pass — assert no
  `AgentJob.findById(req.params.jobId)` without an agent-id join, no echo of
  an existing secret, no `console.log`/logger call with the Bearer token).

## Idempotency Contract

Re-running MUST NOT: re-scope an already-scoped handler (detect `req.agent.id`
in the query and skip), add a second `timingSafeEqual` to the verify path,
re-create the rotation atomic swap, re-add the daemon `SERVER_URL` pin, or
duplicate the meta-tests/parity check. Detect existing controls and reconcile
in place. A re-run that finds the surface clean appends "re-verified
YYYY-MM-DD — surface #5 clean" to `findings.md`. Findings fixed here are
annotated with `— FIXED at file:line (prompt 05)` for `09`'s report.
