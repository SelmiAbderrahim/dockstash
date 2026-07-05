# Phase 05 — Verify & Harden — Design-Upgrade Prompt

> **Prove every surface, in every mode, with no regression.** Accessibility sweep,
> light/dark parity, 320px→ultrawide + RTL responsiveness, reduced-motion/60fps/CLS,
> the emoji + banned-pattern visual review, and the full no-regression check of every
> product flow. This is where G-03/04/05/07/13/18 are closed with ledger evidence. The
> Reference UI spec (SPEC-01…12) must already be applied to **every** authenticated
> surface — this phase verifies it is.

---

## Agent

`Accessibility Auditor` (primary — the a11y sweep) + `react-specialist` (fixes) +
`e2e-playwright-specialist` (four-project run). **Depends on Phases 02–04** (shell,
landing, SEO) and reuses the Phase-3 E2E suite.

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phases 00–04 `_done`-renamed; G-09/G-10/G-12/G-17/G-19/G-20 all `done` in the matrix.
- Full GATE-E2E once **before** the sweep starts — a red project now means Phases 2–4
  regressed; fix under the owning phase first.

## Scope fence — NOT this phase

| Deferred work | Owner |
|---|---|
| New features, new sections, new primitives | Phases 2/3 (done) — a missing primitive here reopens the owning ID, not a fresh build |
| SEO/meta changes | Phase 4 (done) |
| CSP / security work | Phase 6 |

This phase ships **fixes to verified failures only** — every edit traces to a sweep
finding logged in §3. An edit with no finding is scope bleed → §5.

## Coverage contract (100% v8 — non-negotiable)

Every fix that touches source ships/updates its co-located test in the same edit;
`npx vitest run --coverage` for the touched package after each fix batch. Diagnose
<100% per `GATE-MACHINERY.md` §g — never exclusions.

## Skill gates (MANDATORY — load before touching the surface)

| Skill | Load it for | Satisfies |
|---|---|---|
| Accessibility Auditor (agent) | the keyboard/screen-reader/focus/contrast sweep on every touched surface incl. dialogs | G-01, G-03 |
| `webapp-testing` | driving the live stack in a real browser to verify each surface (light/dark/RTL, breakpoints) | G-01, G-04, G-05 |
| `dockstash-design` | the emoji/banned-pattern visual review the greps can't see | G-01, G-02 |
| `dataviz` | **if** any chart shipped — verify light/dark parity + data-table fallback | G-01, SPEC-10 |

`REFERENCE-UI-SPEC.md` per-surface map is the **G-18 checklist** — every row needs
ledger evidence.

## Mission

1. **Accessibility Auditor sweep:** keyboard-only path, screen-reader labels, focus
   order, contrast — on every touched surface, **including dialogs** (`RestoreDialog`,
   `RegisterAgentDialog`, `AgentSetupDialog`, `AlertDialog` confirmations). Trap +
   return focus in dialogs.
2. **Light/dark parity** verified visually on every surface.
3. **Responsive sweep** across the real breakpoints, 320px→ultrawide, including RTL for
   `ar` (logical utilities only — `ps-`/`pe-`/`text-start`, dockstash-design-system §7).
4. **Confirm `prefers-reduced-motion`, 60fps, no CLS.**
5. **Visual review** for emoji-as-icons (lucide-react only) and banned patterns the
   greps can't see: serif accent creeping into UI chrome, more than one accent per
   headline, shadow escalation on overlays that aren't overlays.
6. **No-regression check:** every prior route/flow still works — register agent, assign
   project, run backup, browse snapshots, restore, billing checkout, superadmin tabs.
   This is the **G-13** core-funnel proof: register-agent → assign project → run backup
   → restore.
7. **Close G-18:** confirm every authenticated surface in the `REFERENCE-UI-SPEC.md`
   per-surface map carries the shell (SPEC-01/02/03), page header (SPEC-04), stat-card
   (SPEC-05), status-chip (SPEC-06), table (SPEC-07), and detail (SPEC-12) anatomy as
   applicable — **including every superadmin tab** (Overview, Users, Billing, System,
   Audit). Each row gets a §e screenshot (both themes) + a per-surface SPEC checklist.

## Operating Constraints

| Rule | Detail |
|---|---|
| Every touched surface | The verify sweep covers everything Phases 2–4 changed — no surface skipped, superadmin included. |
| Both themes, every surface | Light + dark parity is a hard gate (G-04); capture both in §e. |
| 320→ultrawide + RTL | G-05: screenshots at 320/768/1024/1440/1920 + `locale-ar` project green. |
| Color + text, never color alone | Status conveyed by `StatusChip` token **and** localized text (a11y). |
| No regression | `/api/agent/*` machine surface + all product flows intact (G-13). |
| Reduced-motion | No entrance animation, 60fps, CLS ~0 when set (G-07). |

## Execute → Validate → Test

**Execute**
1. Load the skills/agent; boot the stack (`docker compose up -d --build`).
2. Run the **G-18 iteration protocol** (below) over every row of the
   `REFERENCE-UI-SPEC.md` per-surface map. Fix anything that fails; re-verify that row.
3. Drive the three core funnels end-to-end against the live stack (login fixture / JWT
   from `.env` per `GATE-MACHINERY.md` §e) using the **funnel script** below.

### G-18 iteration protocol — one pass per map row (14 rows), no row skipped

For **each** row of the per-surface application map, in order, record a ledger entry
before moving to the next row:

1. Open the surface authed (auth fixture), light theme, 1440px.
2. **Keyboard-only sweep:** Tab through every interactive element — visible focus on
   each, no trap, dialogs trap + return focus, `Escape` closes.
3. **SPEC anatomy check:** tick each SPEC ID the map row names (shell/04/05/06/07/12 as
   applicable) against the actual DOM.
4. **Both themes:** flip to dark (theme fixture) — parity, contrast, no invisible text.
5. **Five widths:** 320/768/1024/1440/1920 — no horizontal scroll, tables collapse per
   SPEC-07 below `md`.
6. **`ar` RTL:** sidebar side, logical spacing, arrows flipped, Arabic strings render.
7. **States:** loading (Skeleton), empty (designed + next step), error (inline + retry)
   — force each where the UI allows.
8. **Screenshots:** §e set for the row (both themes; `ar` at 768 minimum), §4-indexed.
9. **Ledger §3 row entry**, exact template:

```
G-18 <surface>: SPECs [<ids ticked>] | keyboard PASS/FAIL | themes PASS/FAIL |
widths PASS/FAIL | rtl PASS/FAIL | states PASS/FAIL | shots: <file list> | fixes: <none / list>
```

Any FAIL → fix → re-run **that row from step 1**. G-18 closes only when all 14 rows
read all-PASS.

### Funnel script (G-13) — concrete steps against the live stack

1. **Register agent:** Fleet → Register agent → dialog opens (focus trapped) → name
   agent → key revealed **once** (`AgentKeyReveal` one-time semantics intact) → install
   command copyable (`TerminalFrame`).
2. **Assign project:** Projects → New → pick agent + roots → create succeeds → detail
   page renders (SPEC-12 anatomy).
3. **Run backup:** project detail → Run backup → **in-button loading immediately** →
   progress streams (`ResticLogPanel` via Socket.IO) → status chip updates.
4. **Browse + restore:** Snapshots → filter tabs (`?tab=` in URL) → open snapshot →
   Restore → `RestoreDialog` confirm → in-button loading → outcome visible.
5. Billing checkout opens; every superadmin tab renders with `?tab=` state.

**Compose-stack agent caveat (define "verified" honestly):** a real fleet agent may
not be attachable to the local stack (needs a Docker host + published agent image). If
steps 3–4 cannot produce a *live* run locally, "verified" means: dialog-level UI +
`/api/agent/*` contract untouched
(`git diff "$BASE_COMMIT" -- server/src/modules/agent* server/src/modules/*/agent*` —
empty or reviewed hunks) + existing integration tests green — and a §5 entry stating
exactly which funnel steps were UI-verified vs contract-verified. Claiming a live
backup ran when it didn't is a falsified gate.

**Validate — the full stack of gates (all green, all in the ledger)**
```bash
# GATE-CORE (GATE-MACHINERY.md §b):
#   ...typecheck / lint / vitest --coverage ×3...
# BAN block (GATE-MACHINERY.md §d) — complete, clean or excepted.
# Emoji / serif-in-chrome / shadow-escalation — VISUAL review, logged per surface in §3.
```

**Test — GATE-E2E all four projects (GATE-MACHINERY.md §c)**
```bash
docker compose up -d --build
docker compose ps                          # all healthy → §3
export PLAYWRIGHT_BASE_URL="$WEB"
(cd client && npx playwright test)         # smoke, a11y (light+dark+RTL), locale-ar, cwv — all green
```
- **§e screenshot sweep across every touched surface** (320/768/1024/1440/1920, light +
  dark, `ar` RTL) — index every file in §4; each G-18 row references its screenshots.
- Reduced-motion check logged (toggle `prefers-reduced-motion`, confirm no entrance
  animation).
- **STOP-and-fix:** any red project, BAN hit, a11y failure, or broken flow halts the
  phase. Fix, re-run the **entire** block, then advance.

## Gate out (Phase 5 → 6) — every box has a check command; all must PASS

- [ ] GATE-CORE (9 commands exit 0) + GATE-E2E (all four projects) + full BAN block —
      §3 entries with output tails.
- [ ] **G-03** — `(cd client && npx playwright test --project=a11y)` green + keyboard
      sweep noted per G-18 row (§3).
- [ ] **G-04/G-05** — §4 index complete:
      `awk` over §4 confirms every touched surface has both themes × 5 widths + an
      `ar` RTL file; spot-check:
      `ls .claude/plans/design-upgrade-evidence/ | grep -c 'dark'` ≈ light count.
- [ ] **G-07** — `--project=cwv` green + reduced-motion §3 note (toggled, no entrance
      animation).
- [ ] **G-13** — funnel script §3 entries all PASS (or the §5 contract-verified caveat
      recorded); `/api/agent/*` diff empty or reviewed.
- [ ] **G-18** — 14 protocol row entries in §3, zero FAIL fields —
      `grep -c 'G-18 ' .claude/plans/design-upgrade-ledger.md` ≥ 14.
- [ ] Emoji / serif-in-chrome / shadow-escalation visual review logged per surface (§3)
      — VISUAL.
- [ ] Scope fence held — every source edit this phase traces to a §3 finding.

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
