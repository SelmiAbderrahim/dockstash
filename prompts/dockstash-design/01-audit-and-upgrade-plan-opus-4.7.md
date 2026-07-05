# Phase 01 — Audit & Upgrade Plan — Design-Upgrade Prompt

> **Map everything, change nothing.** Enumerate every route and surface, extract the
> existing monochrome design language (respect and extend — never replace), run a
> `seo-audit` baseline, and flag every point of funnel friction. Present the audit
> findings + upgrade plan **before** any edit. This phase produces the change map that
> Phases 2–5 execute against.

---

## Agent

`react-specialist` (primary) + `Accessibility Auditor` (advisor). Read-only phase.
**Depends on Phase 00** (ledger + baseline must exist). Do this first, silently, then
present.

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phase-00 gate-out must be closed: its file carries the `_done` rename and the ledger
  header/seed checks pass (§f steps 1–2, 6).
- This phase is read-only, so §f step 7 (GATE-CORE re-run) may reuse the Phase-00
  baseline §3 entry if no commit landed since `BASE_COMMIT` —
  `git log --oneline "$BASE_COMMIT"..HEAD` empty proves it; otherwise re-run.

## Scope fence — NOT this phase

| Deferred work | Owner |
|---|---|
| Any source edit (even a typo, even a BAN hit) | Phase 2+ |
| Token/primitive/shell/rule-file creation | Phase 2 |
| Landing copy or structure | Phase 3 |
| SEO fixes (this phase only *records* the baseline) | Phase 4 |
| CSP / security changes | Phase 6 |

Output artifacts of this phase: the audit doc + ledger entries. `git status` at the
end must show **zero** source changes.

## Skill gates (MANDATORY — load before touching the surface)

| Skill | Load it for | Satisfies |
|---|---|---|
| `dockstash-design` | extracting/respecting the existing token + primitive system (do not invent taste) | G-01, G-02 |
| `seo-audit` | the meta/OG/heading/JSON-LD/hreflang/canonical + CWV baseline pass (feeds Phase 4) | G-01, G-10 |
| `site-architecture` | mapping routes + internal-linking structure across the marketing + app surfaces | G-01 |

## Mission

1. **Map the codebase.** Client features: `auth`, `billing`, `dashboard`, `fleet`,
   `guide`, `marketing`, `profile`, `projects`, `settings`, `snapshots`, `admin`,
   `superadmin`. Marketing SSR routes (per
   `client/src/features/marketing/routes.tsx`, each also under `/:locale`): `/`,
   `/pricing`, `/alternatives` + `/alternatives/:slug`, `/vs/:slug`,
   `/compare/self-hosted-backup-vs-cloud-backup`, `/guides` + `/guides/:entry`,
   `/backup/:entry` (use cases), `/fleet-agents`, `/security`, `/faq`, `/privacy`,
   `/terms`, 404. App routes: `/dashboard`, `/projects` (+`/new`, `/:projectId`),
   `/snapshots`, `/fleet`, `/billing`, `/settings`, `/setup`, `/profile`, `/admin`,
   `/superadmin`, auth screens. **List anything the map misses before touching it.**
2. **Extract the existing design language.** The system is already defined: monochrome
   shadcn tokens in `client/src/styles/tailwind.css`, primitives in
   `client/src/shared/ui/`, marketing layout primitives in
   `client/src/features/marketing/components/shared.tsx` (`Serif`, `Eyebrow`,
   `CheckItem`, `FeatureCard`, `InvertedBand`, `FaqSection`, `TerminalFrame`,
   `CodeBlock`, `ComparisonTable`, `Breadcrumbs`, `LinkCard`,
   `h1Class`/`h2Class`/`sectionClass`, `pattern-dot-grid`). **Respect and extend this
   system — do not replace it. You are scaling it up, not starting over.**
3. **Run a `seo-audit` pass.** Record current meta/OG, headings, JSON-LD, hreflang,
   canonical, sitemap/robots/llms.txt (all served by `server/src/modules/seo/`), and the
   Core Web Vitals baseline. This feeds Phase 4. Log into ledger §3/§5.
4. **Reference screenshots are BINDING for app surfaces.** They are transcribed into
   `REFERENCE-UI-SPEC.md` (SPEC-01…12). For every authenticated surface — including
   admin/superadmin — that spec is the layout/anatomy authority, in Dockstash's
   monochrome tokens. For the SSR marketing surface,
   `.claude/rules/dockstash-design-system.md` §4 governs; screenshots are directional
   there only.
5. **Flag friction.** Note every excess step, redundant click, unclear affordance, dead
   end — especially the three core funnels: register agent → paste install command →
   agent online; assign project → first backup succeeds; browse snapshots → restore.
   This list drives Phase 2, Key 1. The agent-install flow (`AgentInstallCommand`,
   `AgentKeyReveal`, `AgentSetupDialog`) is the highest-friction moment — call it out.

**Present the audit findings and your upgrade plan before making changes.**

### Required output artifact — `.claude/plans/design-upgrade-audit.md`

The audit is a **file**, not a transcript message (later phases and sessions read it;
transcripts die). Exact required sections (headings verbatim — the gate-out greps them):

```markdown
# Design Upgrade Audit — Phase 01 artifact
## 1. Route inventory
| Route | Kind (SSR-marketing / app) | Component file | Notes |
(every route from Mission §1 + anything discovered; component paths verified to exist)
## 2. Design-language extract
(tokens present in tailwind.css; primitives in shared/ui/; marketing primitives in
shared.tsx — name each; gaps vs REFERENCE-UI-SPEC.md listed explicitly)
## 3. Primitive gap list
| Missing primitive | SPEC ID | Target file | Consumers |
(minimum: Spinner, Button loading, StatChip, StatCard, StatusChip, IconTile, DeltaPill)
## 4. SEO baseline
| Route | title | meta desc | JSON-LD types | hreflang count | canonical |
(from live curls against $WEB; plus robots/sitemap/llms.txt status + CWV observations)
## 5. Friction list
| # | Funnel | Step | File(s) | Friction | Proposed fix (phase) |
(the three core funnels minimum; agent-install flow called out)
## 6. Upgrade plan
(ordered, per-phase mapping of every finding to the phase that fixes it)
```

Every friction row names concrete file(s); every route row names the component file.
An unverifiable row (no file, no evidence) is an incomplete audit.

## Operating Constraints

| Rule | Detail |
|---|---|
| Read-only | Zero source edits this phase. Output is the findings doc + plan (into the ledger / a plan note), not code. |
| Respect the system | Extend `tailwind.css` tokens + `shared/ui/` + marketing `shared.tsx` primitives. No parallel design language, no rewrites. |
| Cover every route | The route list above is the checklist; anything missing is added before Phase 2 starts. |
| Friction is evidence | Every friction item names the file(s) and the funnel step, so Phase 2 can act on it. |
| SEO baseline is data | Record the current state exactly; Phase 4 measures improvement against it. |

## Execute → Validate → Test

**Execute**
1. Load the three skills.
2. Walk `client/src/features/*/routes.tsx` + `client/src/app/router.tsx` + the marketing
   `routes.tsx`; produce the full route inventory.
3. Inventory tokens (`tailwind.css`), primitives (`shared/ui/`), marketing primitives
   (`shared.tsx`); note gaps vs `REFERENCE-UI-SPEC.md` (missing `Spinner`, `Button`
   `loading`, `StatChip`, `StatCard`, `StatusChip`, `IconTile`, `DeltaPill`).
4. Run the `seo-audit` pass against `$WEB` (stack from Phase 0).
5. Enumerate friction across the three funnels.

**Validate**
- The route inventory matches `routes.tsx` reality (no surface omitted) — the audit doc
  lists every route in Mission §1 plus anything discovered.
- The `seo-audit` baseline is recorded in the ledger (§3 for commands, §5 for the
  narrative baseline) — it is the reference for the Phase-4 curl gates (G-10).
- No BAN regression introduced (read-only phase) — re-run the BAN block if any file was
  touched by accident; must match the Phase-0 baseline.

**Test**
- No new tests. Confirm GATE-CORE still matches the Phase-0 baseline (nothing changed) —
  if it drifted, a concurrent session touched the tree: reconcile via `git status`, log
  to §5 (concurrent-session rule).

## Gate out (Phase 1 → 2) — every box has a check command; all must PASS

- [ ] Audit artifact exists with all six sections —
      `for s in 'Route inventory' 'Design-language extract' 'Primitive gap list' 'SEO baseline' 'Friction list' 'Upgrade plan'; do grep -q "$s" .claude/plans/design-upgrade-audit.md || echo "FAIL missing: $s"; done; echo done`.
- [ ] Route inventory covers every Mission-§1 route —
      spot-check: `for r in pricing fleet-agents faq dashboard snapshots superadmin; do grep -q "$r" .claude/plans/design-upgrade-audit.md || echo "FAIL route: $r"; done; echo done`.
- [ ] Primitive gap list names all seven —
      `for p in Spinner StatChip StatCard StatusChip IconTile DeltaPill loading; do grep -q "$p" .claude/plans/design-upgrade-audit.md || echo "FAIL gap: $p"; done; echo done`.
- [ ] Audit findings + upgrade plan **presented** to the user (message referencing the
      artifact) — VISUAL.
- [ ] Read-only held — `git status --porcelain` shows no source changes (only
      `.claude/plans/` artifacts + foreign lines recorded at preflight).
- [ ] SEO baseline logged in ledger (§3 curls, §5 narrative) —
      `grep -qi 'seo baseline' .claude/plans/design-upgrade-ledger.md && echo PASS`.

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
