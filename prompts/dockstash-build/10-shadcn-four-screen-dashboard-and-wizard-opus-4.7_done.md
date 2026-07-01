# Shadcn Four-Screen Dashboard & Setup Wizard — Build Prompt

> **Make Dockstash feel "extremely simple"** — four Shadcn screens, one primary
> action each (Projects → *Backup Now*, Snapshots → *Restore*, Settings →
> *Connect storage*, Project detail → *Save schedule*), a one-time setup wizard
> that escrows the encryption password, and a live restic-log panel streamed over
> the existing Socket.IO. Honest, accessible, anti-Codex UI: flat borders, 6px
> button / 8px card radius, 150ms `color`/`opacity` transitions only — no
> gradients, no card-lift, no pulse.

---

## Agent

`react-specialist` (primary — owns the new `client/src/features/` screens, the RTK
slices/thunks/selectors, the Shadcn component composition, and the Socket.IO log
panel). Coordinate with `testing-accessibility-auditor` (axe + keyboard/focus +
RTL coverage on every screen) and `tanstack-router-expert` is **not** in play —
routing is React Router 6 via `app/router.tsx`.

This is build-phase 7 in `IDEA.md` ("Shadcn 4-screen dashboard + setup wizard +
drill status + billing `?tab=`"). It depends on prompts `00` (Docker stack +
Shadcn/Tailwind target), `01` (i18n + RTL), `03` (backups API: scan / project /
Backup Now), `04` (verification + `lastDrillAt` pass/fail), `05` (scheduler +
Socket.IO restic-log streaming), and `07` (billing `?tab=`). Build only the UI;
do not re-implement those backends — call their APIs.

## Mission

`IDEA.md` Part A "UX" + §5 "Resend-level simplicity" define exactly four screens,
one primary action each, plus a one-time wizard. Build them all:

1. **Projects** — auto-scanned cards per `/var/www/*` folder; each shows last
   backup / size / status badge and one big **Backup Now** button that triggers
   the backup and streams live restic logs over Socket.IO.
2. **Project detail** — the detected plan as `Switch` toggles (Files / Postgres DB
   / Traefik config), a schedule picker (daily / weekly / cron) with *Save
   schedule*, and the drill status (`lastDrillAt` pass/fail) surfaced.
3. **Backups / Snapshots** — a timeline `Table` of restore points per project;
   each row date / size + a **Restore** button gated by a typed-confirm
   `AlertDialog`.
4. **Settings** — storage VPS connection (host, SSH key), retention policy,
   encryption password.

Plus the **one-time setup wizard**: paste the storage-VPS SSH target + choose an
encryption password, shown once, with a forced "I saved it" escrow confirm.

## Operating Constraints

| Rule | Detail |
|---|---|
| Anti-Codex UI (hard rule) | Per `.claude/rules/ui-ux-patterns.md`: flat `1px` borders, **6px** button radius, **8px** card radius, transitions only on `color`/`opacity` at **150ms** max. No gradients/gradient text, no card-lift/`translateY` on hover, no pulse/bounce/scale, no `transition: all`, no glassmorphism. Hover = background/border-color change only. |
| Tab state in URL | Every tabbed surface persists the active tab as **`?tab=`** with a default + invalid-value fallback, `replace: true` on switch (`.claude/rules/url-tab-state.md`). Never `useState` for tab state. Applies to Settings sections and the billing page (prompt `07`). |
| One primary action per screen | Each screen has exactly one prominent primary action (Backup Now / Restore / Connect storage / Save schedule). Secondary actions are visually subordinate and always-visible (no hidden-until-hover actions). |
| Loading / empty / error everywhere | Every async surface renders explicit loading (`Loader2 animate-spin` + text), empty (helpful message, never blank), and error (`role="alert"`, actionable text — not just a red border) states (`IDEA.md` §2 client tests, `ui-ux-patterns.md`). |
| Destructive restore | Restore is gated by a typed-confirm `AlertDialog` requiring the **exact project name**; default mode is "restore to new location", overwrite is an explicit opt-in toggle (`IDEA.md` §1, Part A). |
| Escrow confirm | The wizard shows the encryption password **once** and the *Done* / final step is disabled until the user checks an "I saved it — losing this means the repos are unrecoverable" box (`IDEA.md` §1 key escrow). |
| Accessibility | Keyboard-reachable controls, visible focus rings (never `outline:none` without replacement), `aria-label` on icon-only buttons, `role="alert"` on dynamic errors, `aria-live="polite"` on status/log updates, focus trap + return in dialogs, 44px min targets. |
| RTL + i18n | All copy via the prompt-`01` i18next namespaces (7 locales: en, ar, fr, de, es, ru, zh); `ar` renders `dir="rtl"`. No hardcoded UI strings. |
| API via apiClient | All HTTP through `apiClient<T>` (`shared/api/client.ts`) inside feature `api.ts`; calls to backups (`03`), drills (`04`), schedules/logs (`05`), settings/storage. Path aliases `@features`/`@shared`/`@app` only — no `../../` across boundaries. |
| State | RTK `store/{slice,thunks,selectors}.ts` per feature; thunks `rejectWithValue` typed error strings; reducers registered in `app/store.ts`, routes spread in `app/router.tsx`. |
| Excluded | No new backend endpoints, no white-label theming, no chart libraries beyond Shadcn `Progress`. |

## Phases

### Phase 0 — Map the model
- 0.1 Read an existing client feature end-to-end as the template:
  `client/src/features/billing/` (or `dashboard/`) — `components/`,
  `store/{slice,thunks,selectors}.ts`, `api.ts`, `types.ts`, `routes.tsx`,
  `index.ts` — and how `client/src/app/store.ts` registers reducers and
  `client/src/app/router.tsx` spreads `...<feature>Routes`.
- 0.2 Read `client/src/shared/api/client.ts` (`apiClient<T>`, `ApiError`, the
  `auth: true` JWT-from-cookie behavior) and `shared/utils/cookies.ts`.
- 0.3 Read the prompt `05` Socket.IO **client** wiring (the socket provider/hook
  reused for live logs) and the backups/drills/scheduler API shapes from prompts
  `03`/`04`/`05` (`scan`, `runBackup`, `snapshots`, `restore`, `plan`, `schedule`,
  `drillStatus`).
- 0.4 Read `.claude/rules/ui-ux-patterns.md` and `url-tab-state.md` in full; read
  the prompt `01` i18n setup (namespaces, `useTranslation`, RTL `dir` toggle).
- 0.5 Confirm which Shadcn primitives exist already (from prompt `00`) and which
  must be added: `Card`, `Badge`, `Switch`, `Dialog`/`AlertDialog`, `Table`,
  `Sonner` (toasts), `Tabs`, `Progress`, `Form` (+ `react-hook-form` + `zod`).

### Phase 1 — Feature scaffolding & shared pieces
- 1.1 Create features (one per screen domain) under `client/src/features/`:
  `projects/` (Projects + Project detail), `snapshots/` (Backups/Snapshots),
  `settings/` (Settings + wizard). Each with `components/`,
  `store/{slice,thunks,selectors}.ts`, `api.ts`, `types.ts`, `routes.tsx`,
  `index.ts` (named re-exports only).
- 1.2 `useTabParam(defaultTab)` hook in `shared/hooks/` per `url-tab-state.md`
  (reads/writes `?tab=`, `replace:true`, invalid → default). Reuse across Settings
  and billing.
- 1.3 A shared `<ResticLogPanel>` in `shared/components/` that subscribes to the
  prompt-`05` socket channel for a backup/restore run, renders streamed lines with
  `aria-live="polite"`, and shows `Progress` while running.

### Phase 2 — Screen 1: Projects
- 2.1 `ProjectsScreen` — fetch projects (thunk → `api.ts` → `apiClient`),
  render one `Card` per `/var/www/*` project with last-backup time, size, and a
  status `Badge` (idle/running/success/failed — static semantic color, no pulse).
- 2.2 Big **Backup Now** `Button` per card → dispatch `runBackup` thunk → open the
  `<ResticLogPanel>` for the live stream; disable the button while running.
- 2.3 Loading skeleton, empty state ("No projects detected under /var/www — …"),
  error `role="alert"`.

### Phase 3 — Screen 2: Project detail
- 3.1 `ProjectDetailScreen` — the detected plan as `Switch` rows: Files /
  Postgres DB / Traefik config (driven by the prompt-`03` `plan`); persist toggles
  via the `plan` API. One *Save schedule* primary action.
- 3.2 Schedule picker (`daily` / `weekly` / `cron`) as a `Form` +
  `react-hook-form` + `zod` (cron string validated; friendly errors inline). On
  save → schedules API (prompt `05`).
- 3.3 Surface **drill status**: `lastDrillAt` + pass/fail badge from prompt `04`
  (green = a real, verified backup; red/none = warn).
- 3.4 Tabs (e.g. Plan / Schedule / Drill) persisted via `?tab=`.

### Phase 4 — Screen 3: Backups / Snapshots
- 4.1 `SnapshotsScreen` — a `Table` timeline of restore points per project
  (date, size). Loading/empty/error states.
- 4.2 Each row a **Restore** `Button` → typed-confirm `AlertDialog`: the user must
  type the **exact project name** to enable *Restore*; a mode selector defaults to
  "restore to new location", with an explicit "overwrite existing" opt-in. On
  confirm → restore thunk → `<ResticLogPanel>` live stream + `Sonner` toast on
  completion.

### Phase 5 — Screen 4: Settings + setup wizard
- 5.1 `SettingsScreen` — sections (storage VPS host + SSH key, retention policy
  keep-N, encryption password) as `Form`s, organized in `?tab=`-driven `Tabs`.
  SSH key / password inputs are write-only (never echo a stored secret back).
- 5.2 **One-time setup wizard** (`SetupWizard`) — step 1: paste storage-VPS SSH
  target (host/user/key); step 2: choose an encryption password, shown **once**,
  with a forced **escrow checkbox** ("I saved it — losing this means the repos are
  unrecoverable") that gates the final *Done* button; step 3: connect + confirm.
  Wizard shows only on first run (no storage configured); never re-displays the
  password.

### Phase 6 — Wiring
- 6.1 Register every new reducer in `client/src/app/store.ts`.
- 6.2 Spread every feature's `routes.tsx` into `client/src/app/router.tsx`; ensure
  a sensible default route (Projects). Gate routes behind the existing auth guard.
- 6.3 Wire `Sonner` toaster + the Socket.IO provider at the app shell
  (`app/providers.tsx`) if not already present from prompt `05`.

### Tests
Client (`client/`, vitest + React Testing Library, jsdom; **100% coverage on the
configured `include` globs** — place new code under those globs or extend them).
Mock the **service layer** (`api.ts`) and the **socket**, never raw fetch.
- **Every screen**: explicit loading, empty, and error (`role="alert"`) states
  render (per `IDEA.md` §2, `ui-ux-patterns.md`).
- **Backup Now**: clicking triggers the `runBackup` thunk and the
  `<ResticLogPanel>` renders streamed lines from the mocked socket; button is
  disabled while running.
- **Restore typed-confirm**: the `AlertDialog` *Restore* button is disabled until
  the typed text **exactly** equals the project name; overwrite defaults off and is
  an explicit opt-in.
- **Schedule form**: `zod` validation rejects an invalid cron string with an inline
  error; a valid one submits.
- **Wizard escrow**: *Done* is disabled until the "I saved it" box is checked; the
  password is shown once and not re-rendered after.
- **Tab state**: switching a tab updates `?tab=` (`replace`), refresh preserves it,
  an invalid `?tab=` value falls back to the default.
- **RTL**: rendering under `ar` sets `dir="rtl"`.
- **a11y**: `axe` finds no violations on each screen; icon-only buttons have
  `aria-label`; focus is trapped in the restore dialog and returned on close.

### i18n
All UI copy via the prompt-`01` i18next namespaces; **7 locales** (en, ar, fr, de,
es, ru, zh) with auto-detect + a language switcher; **ar is RTL** (`dir="rtl"`).
Add screen namespaces (`projects`, `projectDetail`, `snapshots`, `settings`,
`wizard`) with identical interpolation vars across all 7 files; key-parity test
asserts no missing/extra keys. No hardcoded UI strings (buttons, labels, errors,
empty-state copy, toasts).

### Documentation
- `/docs` "Using the dashboard" — the four screens, the one primary action each,
  the setup wizard + escrow warning, reading drill status, the live log panel.
  User-facing → authored in all 7 languages.
- Note in `ARCHITECTURE.md` (client section) the new feature modules, the
  `useTabParam` hook, and the shared `<ResticLogPanel>`.

## Agents & Skills

- **Agents:** `react-specialist` (primary — screens, RTK, Shadcn composition,
  socket log panel); `testing-accessibility-auditor` (axe/keyboard/focus/RTL
  coverage on every screen).
- **Skills:** `ui-ux-pro-max` (screen/layout/interaction patterns within the
  anti-Codex constraints); `shadcn-design-system-compliance` (correct Shadcn
  primitive usage — `Card`/`Switch`/`AlertDialog`/`Table`/`Sonner`/`Tabs`/
  `Progress`/`Form` + radii/transition compliance); `spec-driven-development`
  (spec → plan → tasks); `verify` / `run` (bring the stack up, exercise Backup Now
  + a typed-confirm restore + the wizard end-to-end); `code-review` (final
  anti-Codex + a11y pass).

## Idempotency Contract

Re-running MUST NOT: create a second copy of any feature module or duplicate a
reducer registration in `app/store.ts`, double-spread a feature's routes in
`app/router.tsx`, re-add the `useTabParam` hook or `<ResticLogPanel>`, re-mount the
`Sonner` toaster or socket provider, or re-scaffold an existing screen. Detect
already-present modules, reducers, routes, and shared components and reconcile in
place — each screen, reducer, route spread, and shared piece is declared exactly
once on every run.
