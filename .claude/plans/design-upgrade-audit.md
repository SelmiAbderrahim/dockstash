# Design Upgrade Audit — Phase 01 artifact

Read-only pass. Zero source edits. Feeds Phases 02–06. Companion to
`.claude/plans/design-upgrade-ledger.md` (matrix + gate-run log), not a replacement.

**Preflight** (§f, 2026-07-05):
- ledger present + seeded (62 rows) — PASS
- foreign-change snapshot: only Phase-00 rename + this audit — clean
- WEB_PORT=43000 → `$WEB=http://127.0.0.1:43000`
- BASE_COMMIT=`2c6bd58…` — no commits since; GATE-CORE baseline reused from Phase-00 §3
- stack healthy (`api / web / mongo / redis / docker-socket-proxy`) — PASS
- API health via `http://127.0.0.1:48080/api/health` = 200 (WEB proxies only SEO paths, see ledger D-00.1)
- Skills loaded: `dockstash-design`, `seo-audit`, `site-architecture` — G-01 evidence in ledger §3

---

## 1. Route inventory

| Route | Kind | Component file | Notes |
| --- | --- | --- | --- |
| `/` | SSR-marketing | `client/src/features/marketing/components/Home.tsx` | Hero + features + FAQ + CTA; SSR via `client/server.js`. |
| `/pricing` | SSR-marketing | `client/src/features/marketing/components/Pricing.tsx` | Plan cards + BreadcrumbList JSON-LD. |
| `/alternatives` | SSR-marketing | `client/src/features/marketing/components/AlternativesHub.tsx` | Hub index (ItemList JSON-LD). |
| `/alternatives/:slug` | SSR-marketing | `client/src/features/marketing/components/AlternativePage.tsx` | Programmatic pages (Backrest, SimpleBackups, Duplicati, DIY restic…). |
| `/vs/:slug` | SSR-marketing | `client/src/features/marketing/components/VsPage.tsx` | Head-to-head comparison surfaces. |
| `/compare/self-hosted-backup-vs-cloud-backup` | SSR-marketing | `client/src/features/marketing/components/CompareCategoryPage.tsx` | Category compare. |
| `/guides` | SSR-marketing | `client/src/features/marketing/components/GuidesHub.tsx` | Hub. |
| `/guides/:entry` | SSR-marketing | `client/src/features/marketing/components/GuidePage.tsx` | Step-by-step guide bodies. |
| `/backup/:entry` | SSR-marketing | `client/src/features/marketing/components/UseCasePage.tsx` | Use-case pages. |
| `/fleet-agents` | SSR-marketing | `client/src/features/marketing/components/FleetAgentsPage.tsx` | Fleet marketing surface. |
| `/security` | SSR-marketing | `client/src/features/marketing/components/Security.tsx` | Security posture page. |
| `/faq` | SSR-marketing | `client/src/features/marketing/components/Faq.tsx` | `<details>` FAQ (SSR-visible for AEO). |
| `/privacy` | SSR-marketing | `client/src/features/marketing/components/Privacy.tsx` | Legal. |
| `/terms` | SSR-marketing | `client/src/features/marketing/components/Terms.tsx` | Legal. |
| `*` (404) | SSR-marketing | `client/src/features/marketing/components/NotFoundPage.tsx` | Marketing 404. |
| `/:locale/…` | SSR-marketing | same set, wrapped by `MarketingLocaleSwitcher` | Locales: `en, ar, fr, de, es, ru, zh`; ar → RTL. |
| `/login` | app-auth | `client/src/features/auth/components/Login.tsx` | Password login. |
| `/register` | app-auth | `client/src/features/auth/components/Register.tsx` | Signup + immediate verify email. |
| `/logout` | app-auth | `client/src/features/auth/components/Logout.tsx` | Redirect on mount. |
| `/forgot-password` | app-auth | `client/src/features/auth/components/ForgotPassword.tsx` | Email reset link. |
| `/reset-password/:resetToken` | app-auth | `client/src/features/auth/components/ResetPassword.tsx` | Reset form. |
| `/verify-email` + `/verify-email/:token` | app-auth | `client/src/features/auth/components/VerifyEmail.tsx` | Both entry variants. |
| `/dashboard` | app | `client/src/features/dashboard/components/Dashboard.tsx` | Home for signed-in users. |
| `/projects` | app | `client/src/features/projects/components/ProjectsScreen.tsx` | List. |
| `/projects/new` | app | `client/src/features/projects/components/AddProjectScreen.tsx` | Two-tab picker (folders / docker). |
| `/projects/:projectId` | app | `client/src/features/projects/components/ProjectDetailScreen.tsx` | Detail (tabs via `?tab=`). |
| `/snapshots` | app | `client/src/features/snapshots/components/SnapshotsScreen.tsx` | Cross-project snapshot list + restore. |
| `/fleet` | app | `client/src/features/fleet/components/FleetScreen.tsx` | Fleet agents list + registration + setup dialogs. |
| `/billing` | app | `client/src/features/billing/components/BillingPage.tsx` | Plans + usage. |
| `/checkout/:plan`, `/billing/settings` | app | Navigate → `/billing` | Legacy redirects. |
| `/settings` | app | `client/src/features/settings/components/SettingsScreen.tsx` | Account settings. |
| `/setup` | app | `client/src/features/settings/components/SetupWizard.tsx` | First-run setup wizard. |
| `/profile` | app | `client/src/features/profile/components/ProfileScreen.tsx` | Profile screen. |
| `/admin` | app-admin | `client/src/features/admin/components/AdminDashboard.tsx` | Verified-only admin. |
| `/superadmin` | app-admin | `client/src/features/superadmin/components/SuperadminScreen.tsx` | RequireRole('superadmin'); Overview / Users / System / Billing / Audit tabs. |

All routes verified against `client/src/features/*/routes.tsx` and
`client/src/app/routes.ts(x)`. `/guide/*` is served by the app (verified route),
distinct from marketing `/guides/*`.

## 2. Design-language extract

The system is already defined. Extend it — do not replace it.

### Tokens — `client/src/styles/tailwind.css`
- Neutral achromatic scale in oklch. Semantic tokens present:
  `--background`, `--foreground`, `--card`(+fg), `--popover`(+fg),
  `--primary`(+fg), `--secondary`(+fg), `--muted`(+fg), `--accent`(+fg),
  `--destructive`(+fg), `--success`(+fg), `--border`, `--input`, `--ring`.
- Sidebar tokens: `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`(+fg),
  `--sidebar-accent`(+fg), `--sidebar-border`, `--sidebar-ring`.
- Chart ramp: `--chart-1..5` monochrome lightness steps (light + dark).
- Radius: `--radius: 0.625rem`.
- Fonts: `--font-sans` (Inter), `--font-mono` (JetBrains Mono), `--font-serif`
  (Instrument Serif) — self-hosted, BAN-11 clean.
- Dark theme is class-based (`.dark` on `<html>`) via `ThemeProvider` + no-flash
  script in `client/index.html` (see ledger, GATE-MACHINERY §e).

### Primitives — `client/src/shared/ui/*` (vendored shadcn)
Present: `accordion, alert, alert-dialog, avatar, badge, breadcrumb, button,
card, checkbox, dialog, dropdown-menu, empty, form, input, label, progress,
radio-group, scroll-area, select, separator, sheet, sidebar, skeleton, sonner,
switch, table, tabs, textarea, tooltip`.

### Marketing primitives — `client/src/features/marketing/components/shared.tsx`
`Serif`, `Container`, `Eyebrow`, `CheckItem`, `FeatureCard`, `InvertedBand`,
`LinkCard`, `Breadcrumbs`, `FaqSection`, `TerminalFrame`, `ResponsiveTable`,
`ComparisonTable`, `CodeBlock`, `LegalSections`, `LastUpdated`, plus class
constants `sectionClass`, `h1Class`, `h2Class`, `answerClass`, `cardClass`,
`codeClass`, and the `pattern-dot-grid` utility.

### Gaps vs `prompts/dockstash-design/REFERENCE-UI-SPEC.md`
- **No `--warning` semantic token** (SPEC-A1). Only `--destructive` + `--success`
  exist — status chip vocabulary in the reference has three states.
- **`shared/ui/button.tsx` has no `loading` prop** and no in-button spinner —
  callers hand-roll `Loader2 animate-spin` markup (SPEC-A3).
- **No `Spinner` primitive** in `shared/ui/` (SPEC-A3).
- **No `StatChip`, `StatCard`, `StatusChip`, `IconTile`, `DeltaPill` primitives**
  in `shared/ui/`. Two candidate donors live under
  `client/src/features/superadmin/components/`: `StatTile.tsx` and
  `Pagination.tsx` — SPEC-05 / SPEC-07 promote them.
- **No shared app shell** (SPEC-A4). Every authenticated screen inlines its own
  `<header>` — see `FleetScreen.tsx:149`, `ProjectDetailScreen.tsx:381`,
  `ProjectsScreen.tsx:142`, `AddProjectScreen.tsx:225` + `:530`,
  `ProfileScreen.tsx:80`, `SettingsScreen.tsx:559`,
  `SnapshotsScreen.tsx:85`, `billing/components/UsageTab.tsx:159`. Marketing
  header + footer are inlined inside `MarketingLayout.tsx:53` / `:108` too
  (ledger D-00.6). The `shared/ui/sidebar.tsx` primitive exists but is never
  consumed by any feature.
- **No interaction-hygiene rule file** (SPEC-A5). `cursor-pointer`,
  `focus-visible:*`, and `active:*` conventions are not codified as a rule.
- **Status chip vocabulary undocumented** (SPEC-A2).

## 3. Primitive gap list

| Missing primitive | SPEC ID | Target file | Consumers (existing hand-rolls) |
| --- | --- | --- | --- |
| `Spinner` | SPEC-A3 | `client/src/shared/ui/spinner.tsx` (new) | Loader2 spinners across `AddProjectScreen.tsx`, auth screens, `FleetScreen`, `SnapshotsScreen`. |
| `Button` `loading` prop | SPEC-A3 | `client/src/shared/ui/button.tsx` (extend) | Register-agent submit, RestoreDialog confirm, AddProject create — all currently gate on `saving`/`rotating` state manually. |
| `StatChip` | SPEC-05 | `client/src/shared/ui/stat-chip.tsx` (new) | Inline chip labels in `FleetScreen`, `ProjectDetailScreen`, `BillingPage`. |
| `StatCard` | SPEC-05 | `client/src/shared/ui/stat-card.tsx` (new; donor: `features/superadmin/components/StatTile.tsx`) | `SuperadminScreen`, `Dashboard`, `BillingPage`. |
| `StatusChip` | SPEC-A2 + SPEC-05 | `client/src/shared/ui/status-chip.tsx` (new) | Snapshot state chips (success / running / failed / warning) inside `SnapshotsScreen` + `ProjectDetailScreen`; fleet online/offline in `FleetScreen`. |
| `IconTile` | SPEC-05 | `client/src/shared/ui/icon-tile.tsx` (new) | Reference for `FeatureCard`-like tiles in dashboard cards. |
| `DeltaPill` | SPEC-05 | `client/src/shared/ui/delta-pill.tsx` (new) | Usage deltas in `BillingPage/UsageTab`, superadmin overview. |
| `--warning` token | SPEC-A1 | `client/src/styles/tailwind.css` (extend both `:root` + `.dark`) | `StatusChip` warning variant; heartbeat-stale badges in fleet. |
| Shared `AppShell` | SPEC-A4 + G-09 | `client/src/shared/layout/AppShell.tsx` (new) | Every authenticated screen — replaces the 8 inlined `<header>`s enumerated in §2. Wraps `shared/ui/sidebar.tsx` (currently unused). |
| Shared `MarketingShell` | SPEC-A4 + G-09 | extract from `MarketingLayout.tsx` | Removes inline marketing `<header>` (BAN-02 backdrop-blur allowance retires with the extraction). |
| `Pagination` (shared) | SPEC-07 | `client/src/shared/ui/pagination.tsx` (new; donor: `features/superadmin/components/Pagination.tsx`) | Superadmin, projects list, snapshots list. |
| Interaction hygiene rule | SPEC-A5 + G-17 | `.claude/rules/interaction-hygiene.md` (new) | Codifies pointer-cursor, `focus-visible:ring`, `active:*` for `@shared/ui/button`. |
| Shared-layout-system rule | SPEC-A4 + G-17 | `.claude/rules/shared-layout-system.md` (new) | Governs the one-shell rule + primitives promotion policy. |

## 4. SEO baseline

Fetched from `$WEB=http://127.0.0.1:43000` (SSR bundle carries prod origin —
memory: local-e2e-testing-dockstash). All values collected 2026-07-05.

| Route | `<title>` | meta description (excerpt) | canonical | hreflang | JSON-LD types | h1 |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | `Docker backup that actually restores — one click for any project · Dockstash` | `Dockstash auto-detects and backs up your Docker volumes, databases, and config to encrypte…` | `https://dockstash.com/` | 8 (en/ar/fr/de/es/ru/zh + x-default) | `Organization, WebSite, SoftwareApplication, Offer, FAQPage, Question, Answer` | `Back Up Your …` |
| `/pricing` | `Pricing — free self-host, Pro, and Business · Dockstash` | `Dockstash pricing: free self-hosted tier for one project, Pro for teams, Business for agen…` | `https://dockstash.com/pricing` | 8 | `SoftwareApplication, Offer, FAQPage, Question, Answer, BreadcrumbList, ListItem` | `Simple pricing for verified Docker backups` |
| `/fleet-agents` | `Back up every VPS from one dashboard — Dockstash fleet agents · Dockstash` | `Install a lightweight agent on each server and manage all your Docker backups from one pla…` | `https://dockstash.com/fleet-agents` | 8 | `FAQPage, Question, Answer, BreadcrumbList, ListItem` | `Back up every server from …` |
| `/security` | `Security — how Dockstash protects your data · Dockstash` | `How Dockstash secures backups: AES-256-GCM secrets at rest, SSH host-key pinning, encrypte…` | `https://dockstash.com/security` | 8 | `FAQPage, Question, Answer, BreadcrumbList, ListItem` | `Security you can verify` |
| `/faq` | `Dockstash FAQ — Docker backup questions · Dockstash` | `Answers to common questions about Dockstash…` | `https://dockstash.com/faq` | 8 | `FAQPage, Question, Answer, BreadcrumbList, ListItem` | `Frequently asked questions` |
| `/alternatives` | `Dockstash alternatives compared (2026) · Dockstash` | `Compare the top Docker backup alternatives…` | `https://dockstash.com/alternatives` | 8 | `ItemList, ListItem, FAQPage, Question, Answer, BreadcrumbList` | `Dockstash alternatives` |
| `/guides` | `Docker backup guides for every database & app · Dockstash` | `Step-by-step guides…` | `https://dockstash.com/guides` | 8 | `ItemList, ListItem, FAQPage, Question, Answer, BreadcrumbList` | `Docker backup guides` |
| `/privacy` | `Privacy Policy — Dockstash · Dockstash` | `What Dockstash collects…` | `https://dockstash.com/privacy` | 8 | `WebPage, BreadcrumbList, ListItem` | `Privacy Policy` |
| `/terms` | `Terms of Service — Dockstash · Dockstash` | `The terms that govern Dockstash…` | `https://dockstash.com/terms` | 8 | `WebPage, BreadcrumbList, ListItem` | `Terms of Service` |

**Infra**
- `robots.txt` — 200; AI crawler allow-list explicit (GPTBot, ChatGPT-User,
  OAI-SearchBot, PerplexityBot, plus generic).
- `sitemap.xml` — 200 sitemap index (`sitemap-core.xml`,
  `sitemap-alternatives.xml`, …).
- `llms.txt` — 200 (title + summary present).
- Canonicals correctly point at production origin even from local stack (SSR
  bundle-origin bake, expected).
- Head duplication smell: every `<title>` ends `· Dockstash` even though
  `og:site_name` is already `Dockstash`. Phase-4 candidate for trimming.
- All eight surfaces expose 8 hreflang links (7 locales + `x-default`). Consistent.

**Core Web Vitals**
Manual observation only (no lighthouse — BANNED from this run per GATE-MACHINERY §e).
Playwright CWV project is a Phase-3 deliverable (G-20). Snapshot deferred to Phase 4/5.

## 5. Friction list

Every row names the concrete file(s). Files ≤ 47 LOC unless flagged.

| # | Funnel | Step | File(s) | Friction | Proposed fix (phase) |
| --- | --- | --- | --- | --- | --- |
| F-01 | Register agent → paste install → agent online | Install command block lacks a state indicator that the agent has been seen | `client/src/features/fleet/components/AgentInstallCommand.tsx`, `RegisterAgentDialog.tsx` | User sees the command but no "waiting for agent…" affordance; polling / heartbeat is invisible until they close the dialog and refresh the fleet screen. | Phase 2: add "waiting" state (spinner + hint), promote to shared shell; Phase 3: E2E covers the round-trip. |
| F-02 | Register agent | Project-roots input requires typing a full path with no picker or examples inline | `client/src/features/fleet/components/RegisterAgentDialog.tsx` (line ~44 `setRootsInput(DEFAULT_PROJECT_ROOT)`) | Only the placeholder text + a hint sentence guide the user. No inline example set, no "add multiple" chip UX. Hint moves to error on empty. | Phase 2: extract to a `PathsInput` field with chip UX; document status in interaction-hygiene rule. |
| F-03 | Register agent | Reveal-once token is shown, then the dialog can close silently | `client/src/features/fleet/components/AgentKeyReveal.tsx` | Confirm-before-close is missing — user can dismiss the dialog while the token is on screen, losing it forever (the rotate flow is the only recovery). | Phase 2: require an explicit "I copied the key" checkbox before allowing close, with a rotate-key CTA on the row. |
| F-04 | Register agent | Install command uses baked prod server URL in the compose one-liner even on local dev; no visual "using X" hint | `client/src/features/fleet/install-command.ts` (referenced by `AgentInstallCommand.tsx:22`) | Verifier of a local test stack has no evidence in the UI that the URL was resolved. Tied to local-e2e testing note. | Phase 5 verify pass: add subtle "server url:" caption; document in ledger. |
| F-05 | Assign project → first backup | Assignment card is a small side element with no big "first backup" CTA once agent is set | `client/src/features/projects/components/AgentAssignmentCard.tsx`, `ProjectDetailScreen.tsx:381+` | User must scan tabs to find "run backup" — no primary CTA on the freshly-assigned state. | Phase 2: introduce empty-state / "first-run" primitive; Phase 3: E2E for first-backup path. |
| F-06 | Assign project | Add-project two-tab picker (`folders` / `docker`) is long (642 LOC) and mixes discovery, plan preview, and creation in one screen | `client/src/features/projects/components/AddProjectScreen.tsx` (2 inline `<header>`s at 225 + 530 = state duplication) | State duplication + inline layout coupling. Cognitive load high. | Phase 2: split into wizard steps with shared shell; move headers into shell slot. |
| F-07 | Assign project | Add-project error surface uses generic `Alert` — no per-field validation feedback for path/name mismatches | `AddProjectScreen.tsx` | Users can submit an invalid plan and only get a top-level red alert. | Phase 2: field-level validation + shared error primitives (SPEC-06). |
| F-08 | Browse snapshots → restore | Snapshots list is per-project only from the project screen; cross-project view exists but has no filters (state, project, date) | `client/src/features/snapshots/components/SnapshotsScreen.tsx` | Fleet operators can't narrow the list; scale problem the moment fleet is > 3 agents. | Phase 2: filter row primitive + `?state=` / `?projectId=` query params (obey URL-tab-state rule). |
| F-09 | Restore | Typed-confirm restore dialog is correct but small (159 LOC) and target-path vs overwrite radio is easy to misread on 320px | `client/src/features/snapshots/components/RestoreDialog.tsx` | RadioGroup layout collapses awkwardly on narrow; overwrite warning underweight. | Phase 2: destructive-action layout patterns; Phase 5 320px verify. |
| F-10 | Every dashboard surface | Each screen inlines its own `<header>` (see §2) — no shared page-title / breadcrumb / action slot | `FleetScreen.tsx:149`, `ProjectDetailScreen.tsx:381`, `ProjectsScreen.tsx:142`, `AddProjectScreen.tsx:225,530`, `ProfileScreen.tsx:80`, `SettingsScreen.tsx:559`, `SnapshotsScreen.tsx:85`, `billing/components/UsageTab.tsx:159` | Header ergonomics drift from screen to screen; no persistent nav sidebar (the `shared/ui/sidebar.tsx` primitive is unused). | Phase 2 (G-09 + SPEC-A4): introduce `AppShell` + adopt `shared/ui/sidebar.tsx`. |
| F-11 | Loading feedback | Every submit button hand-rolls a `Loader2 animate-spin` — no in-button spinner primitive | `RegisterAgentDialog.tsx`, `AddProjectScreen.tsx`, auth screens | Inconsistent placement / label swap; drift risk. | Phase 2 (SPEC-A3): `Button loading` prop + `Spinner` primitive. |
| F-12 | Status affordance | Status chips (backup running / success / failed / stale-heartbeat) are inline strings without a shared `StatusChip` — `--warning` token not defined | `FleetScreen.tsx`, `SnapshotsScreen.tsx`, `ProjectDetailScreen.tsx` | 3-state vocab (SPEC-A2) not represented; grep-hits for palette colors would land in features. | Phase 2 (SPEC-A1 + SPEC-A2 + SPEC-05): add token + primitive. |
| F-13 | Marketing hero | Local stack loads bundle with baked prod origin — every API call from marketing crumbs into prod during local E2E | `client/server.js` (proxies only SEO paths, see D-00.1) | Blocks local E2E without the Playwright origin proxy. | Phase 3 fixture (documented, memory + G-20). |
| F-14 | Marketing FAQ | `Faq.tsx` uses `<details>` correctly for AEO, but the marketing header/footer are inlined inside `MarketingLayout.tsx` (`:53`, `:108`) → no shared shell | `MarketingLayout.tsx` | G-09 target; also carries the last `backdrop-blur` (BAN-02 §2 exception). | Phase 2 (G-09): extract `MarketingShell`, retire `backdrop-blur`. |
| F-15 | Onboarding | First-run `SetupWizard` at `/setup` diverges from `AddProjectScreen` in tone + shell — two entry points into the same funnel | `client/src/features/settings/components/SetupWizard.tsx` | Confusion between "wizard" and "add project"; both live outside the shared shell. | Phase 2 (SPEC-06 + AppShell): unify. |
| F-16 | Auth screens | Login / Register / Reset / Verify each render outside any shared shell — no consistent brand column, no locale switcher | `client/src/features/auth/components/*.tsx` | Cold-start users get 6 differently-shelled screens across the auth journey. | Phase 2 (SPEC-01 + shared shell). |
| F-17 | Superadmin ergonomics | Ad-hoc `StatTile` + `Pagination` live under `features/superadmin/components/` instead of `shared/ui/` | `client/src/features/superadmin/components/StatTile.tsx`, `Pagination.tsx` | Cross-feature reuse blocked by feature-module isolation rule; StatTile is the strongest donor for SPEC-05. | Phase 2 (SPEC-05 + SPEC-07): promote to `shared/ui/`, refactor consumers. |

The three core-funnel highest-friction moments: **F-01, F-02, F-03** (register
agent → paste → agent online) — call-out per Mission §5.

## 6. Upgrade plan

Ordered by phase; every finding above maps to exactly one owning phase. Nothing
here executes in Phase 01 — this is the map Phase 02+ works against.

### Phase 02 — Shell, tokens, primitives, interaction hygiene
- **SPEC-A1** add `--warning` semantic token (light + dark) — `client/src/styles/tailwind.css`.
- **SPEC-A2** document status-chip vocabulary in `.claude/rules/dockstash-design-system.md`.
- **SPEC-A3** `Spinner` primitive + `Button loading` prop.
- **SPEC-A4** shared `AppShell` (+ `MarketingShell`) — adopt `shared/ui/sidebar.tsx`; remove all inlined `<header>` from §2 / F-10. Retire backdrop-blur (F-14).
- **SPEC-A5** promote interaction-hygiene rule (cursor / focus-visible / active).
- **SPEC-05** promote `StatTile` → `StatCard`; add `StatChip`, `StatusChip`, `IconTile`, `DeltaPill`.
- **SPEC-06** empty / loading / error primitives normalized (Alert, Empty, Skeleton usage sweep).
- **SPEC-07** promote `Pagination` → `shared/ui/pagination.tsx`.
- **SPEC-01** auth surfaces adopt shared shell + shared primitives (F-16).
- **SPEC-02/03/04/08/10/11/12** apply reference-UI spec to dashboard / projects / snapshots / superadmin / billing / settings / fleet surfaces.
- **F-02, F-03, F-05, F-06, F-07, F-09, F-15, F-17** land here (behavior changes).
- Close **BAN-01** (comment reword), **BAN-02** (shell extraction retires backdrop-blur), **G-11** (agent `logging.ts` line-8 branch — ledger D-00.4).
- Ledger normalization owner: pick a strategy for D-00.2 / D-00.3 (compose-run vitest or scoped env).

### Phase 03 — Landing + Playwright suite (G-20)
- **SPEC-09** marketing hero + feature grid + steps + FAQ + inverted CTA per spec (`Home.tsx`).
- **G-20** create the Playwright suite (`smoke`, `a11y` axe wcag2a/2aa/21a/21aa, `locale-ar`, `cwv`) wired to compose.
- **F-01** waiting-for-agent E2E path.
- **F-13** implement the origin-proxy fixture (memory: local-e2e-testing-dockstash).

### Phase 04 — SEO + AI discoverability (G-10)
- Trim `<title>` duplication (`… · Dockstash` vs `og:site_name`).
- Verify JSON-LD parity across locales; add per-page JSON-LD where hubs currently only carry `ItemList`.
- Capture CWV numbers via the Playwright `cwv` project (not lighthouse).

### Phase 05 — Verify + harden
- 320 → 1920 sweep (evidence screenshots per GATE-MACHINERY §e).
- **F-04, F-09** verification tasks.
- Lint-warning cleanup (D-00.5) if in scope for owner decision.

### Phase 06 — Security gate (SEC-01…13)
- Turn CSP on (D-00.7).
- Full SEC review; no visual changes.

---

Every friction row names a file. Every gap has a SPEC ID + target file. The
Phase-4 SEO gate measures deltas against §4. Phase 02 starts once this artifact
is presented and the ledger records the presentation.
