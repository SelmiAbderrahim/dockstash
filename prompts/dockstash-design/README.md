# Dockstash — Design-Upgrade Prompt Batch

These 7 prompts split `prompts/MASTER-DESIGN.md` (the archived monolith, left untouched)
into an executable, gated batch that elevates the Dockstash codebase to **award-winning
design** while holding four axes at once — **craft** (Awwwards/CSS Design Awards/FWA),
**conversion** (a first-time visitor understands and acts), **discoverability** (search
crawlers AND AI answer engines cite it), and **security** (no design win opens or leaves
open a hole). Each phase is a standalone spec (`# Title → ## Agent → ## Skill gates →
## Mission → ## Operating Constraints → ## Execute → Validate → Test → ## Gate out`),
matching the format of `prompts/dockstash-build/`.

They build **on the existing tree** — monochrome shadcn tokens
(`client/src/styles/tailwind.css`), vendored primitives (`client/src/shared/ui/`),
marketing SSR primitives (`client/src/features/marketing/components/shared.tsx`), the
SEO modules (`server/src/modules/seo/`, `client/src/shared/seo/`), i18n×7, and the
docker-compose stack — and **respect and extend** all of it. Never a second design
language.

## Files (run phases in numeric order)

| # | Phase | File |
|---|-------|------|
| 00 | Setup, baseline & ledger (owns G-01…G-20 defs) | `00-setup-baseline-and-ledger-opus-4.7.md` |
| 01 | Audit & upgrade plan | `01-audit-and-upgrade-plan-opus-4.7.md` |
| 02 | Shell, tokens & interaction hygiene (SPEC-A, G-17, G-19) | `02-shell-tokens-and-interaction-hygiene-opus-4.7.md` |
| 03 | The landing page + E2E suite (G-20) | `03-landing-page-and-e2e-suite-opus-4.7.md` |
| 04 | SEO & AI-search discoverability | `04-seo-and-ai-discoverability-opus-4.7.md` |
| 05 | Verify & harden | `05-verify-and-harden-opus-4.7.md` |
| 06 | Security gate + completion protocol (SEC-01…13) | `06-security-gate-opus-4.7.md` |

### Shared reference appendices (no `-opus-4.7` suffix — the executor skips them)

| File | Contents |
|------|----------|
| `GATE-MACHINERY.md` | ledger schema (§a), GATE-CORE (§b), GATE-E2E (§c), the BAN block (§d), the visual-evidence protocol (§e), **PREFLIGHT (§f)**, **the failure playbook (§g)**, the requirement-ID ownership map |
| `REFERENCE-UI-SPEC.md` | SPEC-01…12 + SPEC-A1…A5 + brand-adaptation rule + the canonical primitive-filename table + the per-surface application map (the G-18 checklist) |
| `REFERENCE-LANDING-INSPIRATION.md` | LP-01…LP-09 — landing visual direction transcribed from the Mobbin-class reference screenshot (copy budgets, hero anatomy, section rhythm, motion map, conversion spine); binding for Phase 03's `Home.tsx` only |
| `GUARDRAILS.md` | pinned Dockstash constraints, the standing-rules table, the two G-17 promoted rule files' **full literal content** (copy verbatim in Phase 2) |

Every phase's `Validate`/`Test` section calls the gate blocks in `GATE-MACHINERY.md`
**by name** rather than re-inlining them — one source of truth, no drift.

## How to execute this batch (the per-phase loop — no step optional)

For each phase file, in numeric order:

1. **Preflight** — run `GATE-MACHINERY.md` §f verbatim (Phase 00 skips it — it creates
   the ledger §f checks). A phase may **not** start unless the previous file carries
   the `_done` rename **and** its gate-out IDs are `done` in the ledger.
2. **Skill gates** — load the phase's skills (G-01); the Skill-tool calls are ledger
   evidence.
3. **Mission** — execute, respecting the phase's **Scope fence** (work owned by another
   phase is deferred there, never absorbed) and its **Coverage contract** (tests ship
   with the code, coverage re-run per step).
4. **Validate → Test** — run the phase's gate blocks; on any failure apply the §g
   failure playbook (sanctioned fixes only; three failed attempts on one gate →
   `blocked(<reason>)` + §5 + surface to the user — never thrash).
5. **Gate out** — every checkbox has a paired command (or an explicit VISUAL tag with
   §4 evidence); all must PASS.
6. **Rename** the finished file with the `_done` suffix
   (`prompts/RENAME-PROMPT-FILE.md`) — this is what the next phase's preflight checks.

"Done" is a ledger state, never a transcript claim. An unproven claim is an unfinished
task (Execution Contract rule 6).

## Dependency order

`00` (baseline + ledger — **blocks all**) → `01` (audit, read-only) → `02`
(tokens/primitives/shell first, so everything cascades) → `03` (landing composes the
Phase-2 shell; also **creates** the permanent Playwright suite, G-20) → `04` (SEO extends
the Phase-3 SSR flagship) → `05` (verify every surface, close G-03/04/05/07/13/18) → `06`
(security gate SEC-01…13 + adversarial completion protocol, last). Each phase names its
dependency in `## Agent`.

## Agents & skills matrix

Agents from `.claude/agents/`; skills via the Skill tool. **Skills are gates, not
suggestions** (Execution Contract rule 1): load the phase's skill(s) before touching the
surface it governs — a phase that skipped its skill is not done (G-01).

| Phase | Primary agent | Supporting | Skill gates |
|-------|---------------|------------|-------------|
| 00 Setup/baseline | `react-specialist` | Accessibility Auditor | `dockstash-design`, `seo-audit`, `spec-driven-development` |
| 01 Audit | `react-specialist` | Accessibility Auditor | `dockstash-design`, `seo-audit`, `site-architecture` |
| 02 Shell/tokens/hygiene | `react-specialist` | Accessibility Auditor | `dockstash-design`, `shadcn`, `page-cro`, `shadcn-design-system-compliance` |
| 03 Landing + E2E | `react-specialist` | `e2e-playwright-specialist`, Accessibility Auditor | `landing-page-optimization`, `page-cro`, `copywriting`, `marketing-psychology`, `dataviz` |
| 04 SEO / AI-search | `react-specialist` | backend agent | `seo-audit`, `ai-seo`, `schema-markup`, `site-architecture` |
| 05 Verify / harden | Accessibility Auditor | `react-specialist`, `e2e-playwright-specialist` | `webapp-testing`, `dockstash-design`, `dataviz` |
| 06 Security gate | `security-auditor` | `dependency-manager`, `react-specialist` | `security-review` (+ `security-auditor` agent) |

## Shared context every phase assumes

- **Stack:** docker-compose (`api`, `web`, `mongo`, `redis`, `docker-socket-proxy`).
  Boot: `docker compose up -d --build`; `docker compose ps` all healthy. Derive `$WEB`
  from root `.env` `WEB_PORT` — **never hardcode ports** (BAN-08). The local bundle may
  bake the prod `VITE_*` origin — use a Playwright origin proxy, not an `.env` edit
  (memory).
- **Design authority:** `.claude/rules/dockstash-design-system.md` (the `dockstash-design`
  skill), as amended by SPEC-A1…A5. Monochrome semantic tokens only — no hex (BAN-05), no
  palette classes incl. gray-family (BAN-12), no brand hue. See `GUARDRAILS.md`.
- **Primitives:** vendored `client/src/shared/ui/*` (compose, never hand-fight). This run
  **adds** `spinner.tsx`, `Button` `loading`, `StatChip`, `StatCard`, `StatusChip`,
  `IconTile`, `DeltaPill` (Phase 2). React 18 → `forwardRef` on `asChild`/native-element
  primitives (memory).
- **i18n×7** (`en, ar, fr, de, es, ru, zh`): every user-facing string via `t(...)` /
  server `translate(...)`; parity suites fail the build on a missing key; `dir="rtl"` +
  logical utilities for `ar` (BAN-06).
- **Tests:** vitest, **100% v8** on owned code in all three packages
  (`client`/`server`/`agent`); only `client/src/shared/ui/**` is threshold-excluded
  (primitives still ship tests). Vitest 2.1.9 quirk: prefer `include: ['src/**']` over
  exclusions; isolate `reportsDirectory` per concurrent session (memory).
- **The ledger is the only source of truth for "done"**
  (`.claude/plans/design-upgrade-ledger.md`, `GATE-MACHINERY.md` §a). On every session
  start, re-run GATE-CORE + the BAN block; regressions flip IDs back to `in-progress`;
  resume at the first non-done ID. Never trust transcript memory over the ledger.
- **No destructive git** without per-turn confirmation
  (`.claude/rules/git-destructive-commands.md`). Commit only when asked.

## Conventions

- **Model tier:** every executable phase ends `-opus-4.7.md` (Hardest tier) — mapped in
  the executor's `MODEL_ALIASES` (`prompt-executor/prompt_executor/config.py` →
  `claude-opus-4-7[1m]`), so `prompt_executor.py --mode=auto` routes each file with no
  `-m` override. Reference appendices + this README carry **no** suffix — the executor
  skips them.
- Run phases in order (`00` → `06`). On completion, rename a finished file with a `_done`
  suffix (see `prompts/RENAME-PROMPT-FILE.md`).
- `prompts/MASTER-DESIGN.md` remains the archived source of truth — this batch is its
  gated, per-phase expansion, no requirement dropped and no gate softened.
- **No-drift verification** (the check `GATE-MACHINERY.md`'s ownership map cites) — the
  master and the batch must carry the identical 62-ID set; run after any edit to either:

  ```bash
  grep -ohE '(G|BAN|SEC)-[0-9]{2}|SPEC-A?[0-9]{1,2}' prompts/MASTER-DESIGN.md | sort -u > /tmp/m.txt
  grep -ohE '(G|BAN|SEC)-[0-9]{2}|SPEC-A?[0-9]{1,2}' prompts/dockstash-design/*.md | sort -u > /tmp/b.txt
  diff /tmp/m.txt /tmp/b.txt && [ "$(wc -l < /tmp/m.txt)" -eq 62 ] \
    && echo 'PASS: 62 IDs, zero drift' || echo 'FAIL: ID drift'
  ```
