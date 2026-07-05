# Phase 00 — Setup, Baseline & Ledger — Design-Upgrade Prompt

> **Establish the yardstick before touching a pixel.** Boot the compose stack, record
> `BASE_COMMIT`, create the append-only evidence ledger with **every** G/BAN/SEC/SPEC
> ID seeded at `todo`, and run GATE-CORE + the BAN block **once as the baseline** —
> seeding genuine pre-existing BAN hits into the exceptions table. Fix nothing yet.
> This phase produces the single source of truth ("done" = green in the ledger) that
> every later phase reads on resume.

---

## Agent

`react-specialist` (primary) + `Accessibility Auditor` (advisor). No code changes this
phase — this is instrumentation. **This phase blocks all others**: `01…06` refuse to
start until the ledger exists and the Phase-0 baseline gate run is recorded in §3.

## Skill gates (MANDATORY — load before touching the surface)

Skills are **gates, not suggestions** (Execution Contract rule 1). A phase that skipped
its skill is not done (**G-01**).

| Skill | Load it for | Satisfies |
|---|---|---|
| `dockstash-design` | the visual authority behind every BAN/SPEC ID you seed into the ledger | G-01, G-02 |
| `seo-audit` | it informs the Phase-1 audit; establish the CWV/meta baseline lens now | G-01, G-10 |
| `spec-driven-development` | this run is a non-trivial multi-surface change — the ledger IS the spec artifact | G-01 |

## Mission

Read `prompts/MASTER-DESIGN.md` (the archived source of truth), `GATE-MACHINERY.md`,
`REFERENCE-UI-SPEC.md`, `GUARDRAILS.md` (this folder). Then:

1. **Record the base commit.** `BASE_COMMIT=$(git rev-parse HEAD)` → ledger header. Any
   uncommitted design work already in flight in the tree is **part of this run** and is
   gated like everything else.
2. **Create the evidence ledger** (`GATE-MACHINERY.md` §a) at
   `.claude/plans/design-upgrade-ledger.md` — copy the §a template **verbatim** (same
   section numbers and headings; do not paraphrase — later phases grep it), and create
   the evidence dir `.claude/plans/design-upgrade-evidence/`. Seed the traceability
   matrix (§1) with **every** ID at `todo`: **G-01…G-20** (20), **BAN-01…BAN-12** (12),
   **SEC-01…SEC-13** (13), **SPEC-01…SPEC-12** (12), **SPEC-A1…SPEC-A5** (5) —
   **exactly 62 rows**. Verify with the §a seed one-liner; `FAIL` = re-seed before
   moving on.
3. **Boot the stack.** `docker compose up -d --build`; `docker compose ps` — every
   container healthy (`api`, `web`, `mongo`, `redis`, `docker-socket-proxy`). Derive
   `$WEB` from `.env` (`GATE-MACHINERY.md` header). Paste `docker compose ps` into §3.
4. **Run the baseline.** GATE-CORE (§b) + the BAN block (§d) **once**. This is the
   yardstick — **do not fix anything.** Seed genuinely pre-existing BAN hits (esp.
   BAN-07 named exports, BAN-08 URL fallbacks — likely `server/src/config/env.ts` zod URL
   defaults + client origin fallbacks) into ledger §2 with `file:line` + justification.

### Expected baseline state (verified against this tree — do not be surprised, do not "fix")

Record these as the baseline; they are the *inputs* to later phases, not failures of
this one:

- **GATE-CORE is expected green** — typecheck/lint/100%-coverage already pass in all
  three packages (CI enforces them). If any command is red at baseline, that is a
  **concurrent-session or drift signal**: check `git status`, log to §5 — still fix
  nothing.
- **No E2E suite**: `client/e2e/` absent, Playwright not in `client/package.json` —
  Phase 3 creates it (G-20).
- **Missing primitives**: no `client/src/shared/ui/spinner.tsx`, no `loading` prop in
  `client/src/shared/ui/button.tsx` — Phase 2 adds them (G-08).
- **No `--warning` token** in `client/src/styles/tailwind.css` — Phase 2 adds it (G-19).
- **Inlined marketing chrome**: `MarketingLayout.tsx` carries its own `<header>`
  (≈line 53) and `<footer>` (≈line 108) — Phase 2 consolidates (G-09).
- **CSP disabled**: `server/src/shared/middleware/security-headers.ts` has
  `contentSecurityPolicy: false` — Phase 6 enables it (SEC-11).
- **Promoted rules absent**: `.claude/rules/interaction-hygiene.md` and
  `.claude/rules/shared-layout-system.md` do not exist — Phase 2 creates them (G-17).
- **Ad-hoc superadmin widgets**: `client/src/features/superadmin/components/StatTile.tsx`
  and `Pagination.tsx` exist — Phase 2 absorbs them into shared primitives (SPEC-05/07).

### The G-IDs this run must close (seeded here, owned by later phases)

Copy verbatim into the ledger matrix; the *verified by* column is the closing evidence.

- **G-01** Each phase's mandatory skill(s) loaded and applied. *— §3 skill-load entries.*
- **G-02** Complies with the design authority: monochrome tokens only, no banned
  patterns, no reintroduced brand hue. *— BAN-01…06 + BAN-12 PASS.*
- **G-03** WCAG AA: contrast ≥4.5:1 body, visible focus, full keyboard reach, SR labels.
  *— `a11y` Playwright project green + keyboard sweep note.*
- **G-04** Verified in **both** light and dark on every touched surface. *— §e index.*
- **G-05** Flawless 320px→ultrawide; RTL correct for `ar`. *— screenshots at
  320/768/1024/1440/1920 + `locale-ar` project green.*
- **G-06** Every user-facing string in all **7 locales**. *— i18n parity suites green.*
- **G-07** `prefers-reduced-motion` honored; 60fps; CLS ~0. *— `cwv.spec.ts` green +
  reduced-motion note.*
- **G-08** Interaction hygiene: pointer cursor, in-button loading, all states. *—
  button/spinner unit tests + BAN sweep + per-surface checklist.*
- **G-09** One shared header/footer/shell; no inlined/duplicated. *— Phase-2 gate +
  grep of `MarketingLayout.tsx`.*
- **G-10** SEO/AI surfaces valid: JSON-LD, meta/OG, hreflang, canonical. *— Phase-4 curl
  gates PASS.*
- **G-11** Repo gates green in **all three packages** (typecheck/lint/100% v8). *—
  GATE-CORE exit 0.*
- **G-12** Landing "wow" without a CWV regression. *— `cwv.spec.ts` + Phase-3 shots.*
- **G-13** No regression: register-agent → assign project → run backup → restore intact.
  *— GATE-E2E four projects green on the final run.*
- **G-14** Security: every SEC-01…13 green. *— Phase-6 ledger entries.*
- **G-15** Ledger complete: zero non-green IDs, no empty Evidence on done rows.
- **G-16** Adversarial pass: Phase-5 + Phase-6 gate blocks re-run from a clean boot, all
  green.
- **G-17** The two promoted conventions exist as rule files and are indexed. *—
  `test -f .claude/rules/interaction-hygiene.md && test -f
  .claude/rules/shared-layout-system.md && grep -q interaction-hygiene CLAUDE.md &&
  grep -q shared-layout-system CLAUDE.md`.*
- **G-18** Reference UI spec applied to **every** authenticated surface (incl. every
  superadmin tab). *— per-surface SPEC checklist + §e screenshots both themes.*
- **G-19** SPEC-A1…A5 amendments written into `dockstash-design-system.md` + tokens in
  `tailwind.css` (light+dark). *— `grep -q 'warning' client/src/styles/tailwind.css &&
  grep -qi 'status chip' .claude/rules/dockstash-design-system.md`.*
- **G-20** Playwright E2E suite exists, wired to compose, green (four projects). *—
  `test -d client/e2e` + all projects passing.*

## Scope fence — NOT this phase

Touching any of these here is a gate violation (log the slip in §5, revert the edit):

| Deferred work | Owner |
|---|---|
| Any source-code fix, however small (BAN hits, lint, styling) | Phase 2+ |
| Audit narrative / friction analysis / SEO findings | Phase 1 |
| Tokens, primitives, shell, rule files | Phase 2 |
| Playwright / `client/e2e/` | Phase 3 |
| CSP or any security change | Phase 6 |

This phase writes exactly **two** artifacts: the ledger + the evidence dir. Nothing
else in the tree changes.

## Operating Constraints

| Rule | Detail |
|---|---|
| No fixes this phase | Baseline only. The first fix belongs to Phase 2. Recording a pre-existing hit ≠ fixing it. |
| Ledger is truth | "done" REQUIRES a non-empty Evidence cell → §3 gate-run or §4 file. Never trust transcript memory over the ledger. |
| Never weaken a gate | Pre-existing BAN-07/08 hits go to §2 with justification; patterns are never loosened. BAN-09 never enters §2 (target = zero repo-wide). |
| No hardcoded ports | Derive `$WEB` from `.env` `WEB_PORT`. Local bundle may bake prod origin — use a Playwright origin proxy later, not an `.env` edit (memory). |
| Concurrent sessions | Before calling any gate red, `git status` for foreign changes; isolate vitest `reportsDirectory`; foreign-caused failures go to §5. |
| No destructive git | No `reset --hard`/`stash`/`clean`/`checkout --`/`--amend`/force-push without fresh per-turn approval. |

## Execute → Validate → Test

**Execute**
1. Load the three skills; read the four reference docs.
2. Write `BASE_COMMIT`, `STARTED`, seed the full ID matrix at `todo`.
3. `docker compose up -d --build && docker compose ps` → paste into §3.

**Validate** (baseline yardstick — record, do not fix)
```bash
# GATE-CORE (GATE-MACHINERY.md §b) — record each final status line into §3:
npm --prefix client run typecheck; npm --prefix server run typecheck; npm --prefix agent run typecheck
npm --prefix client run lint;      npm --prefix server run lint;      npm --prefix agent run lint
(cd client && npx vitest run --coverage); (cd server && npx vitest run --coverage); (cd agent && npx vitest run --coverage)
# BAN block (GATE-MACHINERY.md §d) — seed pre-existing hits into ledger §2:
# ...paste the full g(){...} block from §d...
```

**Test**
- No new tests this phase. Confirm the *existing* suites' baseline pass/fail state is
  captured in §3 verbatim — this is the regression yardstick for G-11/G-13.
- **STOP-and-fix does not apply to the baseline** (failures are recorded, not fixed) —
  but a *broken boot* (`docker compose ps` unhealthy) is a hard STOP: fix the stack
  before proceeding, since every later gate depends on it.

## Gate out (Phase 0 → 1) — every box has a check command; all must PASS

- [ ] `BASE_COMMIT` + `STARTED` in ledger header —
      `grep -E '^BASE_COMMIT: [0-9a-f]{7,40}' .claude/plans/design-upgrade-ledger.md && grep -E '^STARTED: ' .claude/plans/design-upgrade-ledger.md`.
- [ ] Full ID matrix seeded at `todo` — §a seed one-liner prints `PASS ledger seed (62)`.
- [ ] Evidence dir exists — `test -d .claude/plans/design-upgrade-evidence && echo PASS`.
- [ ] `docker compose ps` (all healthy) pasted into §3 —
      `grep -q 'docker compose ps' .claude/plans/design-upgrade-ledger.md && echo PASS`.
- [ ] Baseline GATE-CORE (9 commands) + BAN block (12 IDs) recorded in §3; every
      pre-existing BAN hit seeded in §2 with `file:line` —
      `grep -c 'BAN-' .claude/plans/design-upgrade-ledger.md` covers all 12 in §3.
- [ ] `$WEB` derivation confirmed — `curl -fsS "$WEB/api/health" >/dev/null && echo PASS`.
- [ ] Zero tree changes outside the two artifacts —
      `git status --porcelain | grep -v '.claude/plans/design-upgrade'` is empty (modulo
      pre-existing/foreign lines recorded at step 1).

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
