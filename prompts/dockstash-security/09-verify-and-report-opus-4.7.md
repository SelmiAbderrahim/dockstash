# STEP 6 — Verify & Report: Full Suite + Coverage + npm audit + Final Report — Build Prompt

> **Closes the FIND→FIX→TEST→PREVENT→VERIFY loop from `prompts/SECURITY.md`.**
> Re-runs the full Docker toolchain (typecheck → lint → tests → coverage →
> `npm audit`), confirms no control/gate/lint was weakened to make a test
> pass, and produces the deliverable final report. Implements STEP 6 for ALL
> eight surfaces — this prompt OWNS the closing gate.

---

## Agent

`security-test-specialist` (`.claude/agents/testing/security-test-specialist.md`)
— owns the dependency/`npm audit`/ZAP gate and the final report. Coordinate
with `dependency-manager` (the `npm audit --audit-level=high` zero-high gate
+ pinned deps), `code-reviewer` (`/code-review branch` on the resulting
diff), and `production-validator` (the prod-readiness sanity check). Run
AFTER `01`–`08` have annotated their findings `— FIXED` in `findings.md`.

## Mission

1. Re-verify every finding in `prompts/dockstash-security/findings.md`:
   confirm each `— FIXED at file:line (prompt NN)` annotation is real by
   reading the cited code path. Re-open any finding whose fix is partial or
   missing.
2. Run the full Docker toolchain (STEP 6 of `SECURITY.md`): typecheck → lint
   → unit+integration tests → v8 coverage → `npm audit --audit-level=high`
   on `server/`, `client/`, and (if touched) `agent/`.
3. Confirm no security control, coverage gate, or lint rule was weakened to
   make a test pass. Confirm no Docker socket bind-mount and no shell-string
   spawn was introduced.
4. Produce the final report (per `SECURITY.md` STEP 6): findings table →
   per-finding fix summary → tests added (before/after status) → rules added
   → full suite + coverage + audit result. State plainly what was fixed and
   verified, what is still open, and what was deliberately not touched.

## Operating Constraints

| Rule | Detail |
|---|---|
| Docker-only | Every toolchain command runs in `docker run --rm -v "$PWD/<pkg>":/app -w /app node:20-bookworm …`. Never bare `npm`/`node`/`npx` on the host (`.claude/rules/docker-only-commands.md`). |
| No gate weakened | Never disable a security control, coverage gate, or lint rule to pass CI. If a test fails, surface it — do NOT silence it. |
| No socket / no shell | Confirm no `/var/run/docker.sock` bind-mount was added anywhere; no `child_process.spawn(..., { shell: true })` and no `exec(`/`sh -c` was added in `modules/backups/**` or `agent/src/**`. |
| Faithful reporting | If a test fails, show the output. If a fix is partial, say so. If `npm audit` reports a high/critical, do NOT downgrade the gate — file the advisory and surface it. |
| Read findings first | Read `prompts/dockstash-security/findings.md` end-to-end before running anything. The annotations drive the report. |
| No destructive git | Never `git stash`/`reset --hard`/`clean -fd`/`push --force`/`rebase`/`commit --amend`/`branch -D` without explicit per-turn confirmation (`git-destructive-commands.md`). |
| Do not commit/push | Unless explicitly asked. If asked, branch off `master` first. |

## Phases

### Phase 0 — Reconcile the findings
- 0.1 Read `prompts/SECURITY.md` STEP 6 (the verify block) and § Ground
  rules. Read `prompts/dockstash-security/findings.md` end-to-end.
- 0.2 For each finding annotated `— FIXED at file:line (prompt NN)`, READ the
  cited code path and confirm the fix matches the finding. Re-open (remove
  the `— FIXED` annotation, add `— REOPENED: <reason>`) any finding whose fix
  is partial, regressed, or absent.
- 0.3 List findings NOT yet annotated `— FIXED` — these are the "still open"
  rows in the final report. Do NOT silently fix them here (that belongs to
  the surface prompt); surface them as open.

### Phase 1 — Run the full Docker toolchain
Run each command in Docker (per `SECURITY.md` STEP 6). Capture the output
verbatim — the report includes the actual result, not a paraphrase.

- 1.1 **Server typecheck**:
  ```
  docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
  ```
- 1.2 **Server lint**:
  ```
  docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
  ```
- 1.3 **Server tests + coverage**:
  ```
  docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npx vitest run --coverage
  ```
  Confirm the v8 coverage threshold (lines/branches/functions/statements)
  holds at the repo's configured gate (100% per `docs/ci-gates.en.md`).
- 1.4 **Client tests + coverage**:
  ```
  docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npx vitest run --coverage
  ```
- 1.5 **Server `npm audit`**:
  ```
  docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm audit --audit-level=high
  ```
  Zero high/critical advisories is the gate. A high/critical advisory FAILS
  this step — surface it; do NOT downgrade the gate.
- 1.6 **Client `npm audit`** (and **agent `npm audit`** if `agent/` was
  touched):
  ```
  docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm audit --audit-level=high
  docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npm audit --audit-level=high   # only if agent/ touched
  ```
- 1.7 **Agent tests + coverage** (only if `agent/src` was touched by prompts
  `05`/`06`):
  ```
  docker run --rm -v "$PWD/agent":/app -w /app node:20-bookworm npx vitest run --coverage
  ```

### Phase 2 — Confirm no control was weakened
- 2.1 **Coverage gate intact**: assert the v8 thresholds in
  `server/vitest.config.ts` and `client/vitest.config.ts` (and
  `agent/vitest.config.ts` if present) are unchanged-or-tighter vs the
  pre-batch baseline. A lowered threshold is a finding.
- 2.2 **Lint rules intact**: assert no ESLint rule was disabled/relaxed in
  the security-relevant scopes (`.eslintrc*`, inline `eslint-disable`).
  Specifically the new `no-restricted-syntax` rules from `01`/`06`/`07`/`08`
  are present and active.
- 2.3 **No Docker socket bind-mount**: assert `docker-compose.yml` and any
  `docker-compose.*.yml` mount NO `/var/run/docker.sock` volume on the api
  service (or any service). The api reaches Docker only via
  `DOCKER_HOST=tcp://docker-socket-proxy:2375`.
- 2.4 **No shell-string spawn**: assert no `child_process.spawn(..., { shell:
  true })` and no `child_process.exec(`/`sh -c` was introduced in
  `modules/backups/**` or `agent/src/**`. (The `06` ESLint rule enforces
  this going forward; here we confirm it held.)
- 2.5 **No `StrictHostKeyChecking=no`**: grep the repo for the literal — none
  outside the test fixtures.
- 2.6 **No control-disable commits**: scan the diff for `eslint-disable`,
  `@ts-ignore`, `/* coverage ignore */`, `.skip`/`.only` in new tests. Each
  occurrence is flagged in the report with a justification demand.

### Phase 3 — Produce the final report
Write `prompts/dockstash-security/FINAL-REPORT.md` with these sections (per
`SECURITY.md` STEP 6):

- 3.1 **Findings table** — copied from `findings.md`, with each row's final
  status (`FIXED at file:line` / `OPEN` / `WONT-FIX: <reason>`). Sorted
  Critical → High → Medium → Low, grouped by surface.
- 3.2 **Per-finding fix summary** — one line per finding: `id — fix —
  file:line — prompt NN`. Cross-link the test that proves it.
- 3.3 **Tests added** — per test: name, file, "FAILED before / PASSES after"
  status, which finding(s) it covers. Note the concurrency tests (surface
  #3), the cross-account matrix (surface #2), the agent IDOR tests (surface
  #5), the webhook fail-closed tests (surface #4), the argv-only-spawn tests
  (surface #6), the no-secret-in-response/log tests (surface #7), the
  operator-injection tests (surface #8), the alg-pin tests (surface #1).
- 3.4 **Rules + meta-tests added** — each `.claude/rules/<topic>.md` and each
  repo-wide meta-test/ESLint `no-restricted-syntax` rule introduced by the
  batch, with the surface it guards.
- 3.5 **Full suite + coverage + audit result** — the verbatim summary line
  of each command from Phase 1 (pass/fail + coverage % + advisory count). Do
  NOT paraphrase — the report is the receipt.
- 3.6 **Open items** — findings still OPEN, advisories that failed the gate,
  any "deliberately did NOT touch and why" (e.g. a finding deferred to a
  future batch with a stated reason).
- 3.7 **Sign-off** — a one-line statement: either "All eight surfaces
  verified; suite green; 100% coverage on every touched package; zero
  high/critical advisories" OR "OPEN items remain — see §3.6" with the count.
  The first form is permitted ONLY when every Phase-1 coverage run reported
  100/100/100/100 — otherwise the sign-off is the second form.

### Phase 4 — Branch / commit hygiene (only if asked)
- 4.1 If the operator asks to commit/PR: branch off `master` first
  (`git switch -c security/<short-description>`), stage only the security-
  batch changes, write a conventional commit message, and push the branch
  for a PR. Do NOT push to `master`. Do NOT force-push. Do NOT run any
  destructive git command without per-turn confirmation.
- 4.2 Suggest the operator run `/code-review branch` on the resulting diff
  (complements the security pass) and `/security-review deps` once more on
  the merged branch.

## Coverage & Success Gate — NON-NEGOTIABLE (blocks sign-off)

The batch is signed off ONLY when, **inside Docker**, every touched package is
**100% passing** with v8 coverage **100% on lines / branches / functions /
statements**. This is a hard gate on §3.7 — a red suite or any package below
100% forces the "OPEN items remain" sign-off, never "verified".

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npx vitest run --coverage   # if agent/src touched
```

- Capture the coverage summary table verbatim for each package — the report is the receipt.
- If coverage is <100%, name the exact uncovered file:line in §3.6 and route it back to
  the owning surface prompt. Do NOT reach for `/* c8 ignore */` or a lowered threshold to
  paper over it — that is a weakened gate (Phase 2.1) and itself a finding.
- A `npm audit` high/critical, a failing test, or a sub-100% package are ALL blockers:
  surface them; never downgrade a gate to produce a clean report.

## Tests

No new tests are written in this prompt — it runs the existing suite
produced by `01`–`08` and reports the result. The deliverable is
`FINAL-REPORT.md`.

## i18n

No i18n changes in this prompt. The parity test run in Phase 1.3/1.4 is the
verification that `01`–`08` kept the 7-locale dictionaries aligned.

## Documentation

- `prompts/dockstash-security/FINAL-REPORT.md` — the deliverable (Phase 3).
- `docs/ci-gates.en.md` — annotate any new gate introduced by the batch
  (the `no-restricted-syntax` rules, the meta-tests, the cross-copy parity
  check, the `npm audit` zero-high confirmation).
- `CLAUDE.md` §5 — reference any new rule files (consolidated list from the
  surface prompts).
- Do NOT modify the surface code in this prompt — fixes belong to `01`–`08`.
  If Phase 0 finds a regression, re-open the finding and assign it back to
  the surface prompt; do not patch it here.

## Agents & Skills

- **Agents:** `security-test-specialist` (primary — the gate + report);
  `dependency-manager` (`npm audit` zero-high + pinned deps);
  `code-reviewer` (`/code-review branch` on the diff — complements the
  security pass); `production-validator` (prod-readiness sanity check).
- **Skills:** `/security-review` `deps` mode (the dependency/supply-chain
  pass — **required** before sign-off); `lint` (format/lint/type-check wired
  into the verify phase); `code-review` (final diff pass — assert no
  control-disable, no socket mount, no shell-string spawn, no
  `StrictHostKeyChecking=no`).

## Idempotency Contract

Re-running MUST NOT: re-run any toolchain command redundantly (run each
exactly once per verify pass), duplicate `FINAL-REPORT.md` (overwrite in
place — each run produces a fresh report with a new timestamp header), or
re-open a finding that Phase 0 already confirmed fixed (unless a regression
is actually observed in the cited code path). A re-run that produces an
identical-or-better report (same gate result, same or fewer OPEN items) is
the success state. A re-run that finds a NEW regression updates §3.6 and
demotes the sign-off line accordingly.
