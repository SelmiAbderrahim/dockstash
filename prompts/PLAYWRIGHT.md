# Playwright MCP Testing — Agents, Skills, References, Rules

## Mission

Bootstrap a complete Playwright MCP testing capability for the current repository. You will:

1. **Detect the stack** of this repository (frontend framework, backend, package manager, test runner currently in use, monorepo layout, dev server command, base URL).
2. **Detect which AI-tool config directories exist** at the repo root: `.claude/`, `.agents/`, `.opencode/`, `.codex/`. For each one that exists, install agents, skills, references, and rules that fit that tool's conventions. **Do NOT create a directory that does not already exist** — only populate the ones already present, except `.claude/` which is the canonical baseline and MUST be populated even if missing.
3. **Wire Playwright MCP into the project** so the agents can drive a real browser against the running app.
4. **Generate the three Playwright Test Agents** (planner, generator, healer) per Playwright's own `init-agents` contract, adapted to the detected stack.
5. **Add CI** so generated tests run on pushes and PRs.

This is an infrastructure / ops-track task in the spirit of `.claude/rules/spec-driven-development.md` § Exceptions item 5. It does NOT require a full speckit cycle. It DOES require Docker-only execution, RTL-safe selectors where applicable, design-differentiation respect, public-docs governance, and billing-neutrality.

---

## Stage 0 — Pre-flight

Read these files BEFORE writing anything:

| Path | Why |
|------|-----|
| `CLAUDE.md` (root + project) | Codebase rules, Docker-only, naming, RTL, design diff |
| `package.json` (root and every workspace `package.json`) | Detect frameworks, package manager, scripts |
| `pnpm-workspace.yaml` / `turbo.json` / `nx.json` (if present) | Monorepo layout |
| `Makefile` | Existing `make start*` / `make shell-*` commands |
| `docker/compose/docker-compose.yml` | Dev ports, service names, profiles |
| `.env` (and `.env.example`) | `VITE_APP_URL`, `SITE_URL`, `NODE_ENV`, custom dev ports |
| `.claude/rules/docker-development-only.md` | Docker-only contract you MUST follow |
| `.claude/rules/rtl-support-arabic.md` | If the UI is RTL-aware, selectors must respect logical roles, not physical CSS |
| `.claude/rules/uncodixify-ui.md` | Disallowed visual patterns — tests should not assert on banned ones |
| `.claude/rules/url-tab-state.md` | Tab-state lives in `?tab=` query params — tests MUST navigate via search params, not click + hope |
| `.claude/rules/public-docs-governance.md` | If anything lands under `docs/user/` it MUST be allowlisted |
| `.claude/rules/feature-flag-docs-landing-parity.md` | Feature-flagged surfaces — tests for gated features MUST set the flag explicitly or skip |
| `.github/workflows/*.yml` (every file) | Existing CI patterns — match style, do NOT replace |
| `.gitignore` | Ensure new artifact dirs are ignored |

If any of these are missing, note it and continue — do not invent rules from training data.

---

## Stage 1 — Detection (write this section as a real audit, not assumptions)

Produce an internal detection report in the response covering:

| Question | Detection signal |
|----------|------------------|
| What is the **primary frontend framework**? | `package.json` → `dependencies` (react / next / nuxt / vue / svelte / astro / remix / solid / qwik / angular / plain html) |
| What is the **router**? | `@tanstack/react-router`, `react-router`, `next/router`, `next/navigation`, `vue-router`, `@sveltejs/kit`, `astro`, `wouter`, etc. |
| What is the **package manager**? | `packageManager` field, lockfile (`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lockb`) |
| What is the **dev server command** and **port**? | `package.json` scripts + `vite.config.*` / `next.config.*` / `astro.config.*` / docker-compose port mapping |
| What is the **base URL** for tests? | `VITE_APP_URL` in `.env`, or `http://localhost:<dev-port>` |
| Is the dev server **Docker-only**? | `Makefile` `start` target + project-level CLAUDE.md "DOCKER-ONLY EXECUTION" sections |
| What is the **backend** layer? | `trpc`, `drizzle`, fastify, express, hono, next route handlers, etc. — relevant because tests may need to mock API or seed DB |
| Is the project **monorepo**? | `pnpm-workspace.yaml`, `apps/`, `packages/`, `workspaces` in `package.json` |
| What **languages** does the UI support? | `client/public/locales/<lang>/`, i18n config — tests should run against `en` by default, with RTL tests against `ar` |
| Are there **existing tests**? Which runner? | `vitest`, `jest`, `playwright`, `cypress`, `*.test.ts`, `*.spec.ts` — DO NOT replace these; coexist |
| Is there an **existing `playwright.config.*`** or `tests/` Playwright dir? | If yes, EXTEND it; do not overwrite |
| Which **AI-tool dirs** exist at the repo root? | Check `.claude/`, `.agents/`, `.opencode/`, `.codex/` |

Output the detection report in your first response as a Markdown table so the user can correct it before you write files.

---

## Stage 2 — Playwright MCP server configuration

Add the Playwright MCP server to **every detected AI-tool config**. Use the standard config from Playwright's docs:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### Per-tool wiring

| Tool dir | Config file | Action |
|----------|-------------|--------|
| `.claude/` | `.mcp.json` at repo root (shared) OR `.claude/settings.json` `mcpServers` block | Add the `playwright` entry if absent. If `.mcp.json` already exists with other servers, append. NEVER overwrite existing servers. |
| `.opencode/` | `.opencode/opencode.jsonc` `mcp` block | Add per OpenCode's MCP schema. Use the same `npx @playwright/mcp@latest` invocation. |
| `.codex/` | `.codex/config.toml` `[mcp_servers.playwright]` block | Codex uses TOML; add a `[mcp_servers.playwright]` section with `command = "npx"` and `args = ["@playwright/mcp@latest"]`. |
| `.agents/` | Whatever convention that dir already follows in this repo; if unclear, follow the same pattern as `.claude/agents/` | Mirror only — do not invent a config schema. |

**Headless flag.** Default to **headed** for local human-driven runs (matches Playwright MCP default). For CI add `--headless` via a separate config or environment guard. Do NOT hardcode `--headless` in the shared MCP config — that would break local debugging.

**Browser selection.** Default to chromium. If `.env` or existing test config names a specific browser, mirror it.

---

## Stage 3 — Generate Playwright Test Agents (planner / generator / healer)

Playwright ships an official `init-agents` command that emits these three agents customised for VS Code, Claude Code, or OpenCode. Run it for each detected loop, but in **dry mode first** so you can review what it produces before committing:

```
docker exec -it <project-dev-container> npx playwright init-agents --loop=claude --dry-run
docker exec -it <project-dev-container> npx playwright init-agents --loop=vscode --dry-run
docker exec -it <project-dev-container> npx playwright init-agents --loop=opencode --dry-run
```

For Codex (no first-party `--loop=codex` flag at time of writing), **hand-port** the same three agents into `.codex/agents/` (or whatever convention `.codex/` uses in this repo) using the bodies emitted by `--loop=claude` as the source, adapted to Codex's frontmatter / system-prompt format.

The three agents that MUST end up installed (per `.claude/agents/`, plus the equivalent in every other detected tool dir):

1. **`playwright-planner`** — explores the running app, produces a Markdown plan under `specs/`.
2. **`playwright-generator`** — turns each `specs/*.md` into a `tests/*.spec.ts` file, verifying selectors live against the running app.
3. **`playwright-healer`** — runs the test suite, identifies failing tests, re-explores the page, and patches the test until it passes (or marks it skipped with a reason).

Each agent body MUST:

- Reference the Playwright MCP tools explicitly (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_run_code_unsafe`, etc.).
- Start by reading the seed test at `tests/seed.spec.ts` (Stage 4 creates it) so fixtures and global setup are honoured.
- Use **accessibility snapshots** (`browser_snapshot`) as the primary selection mechanism, not screenshots.
- Use **roles + accessible names** (`page.getByRole('button', { name: 'Save' })`) as the preferred locator. Fall back to `getByText`, `getByLabel`, `getByPlaceholder`, `getByTestId`. NEVER fall back to raw CSS selectors or XPath — call that out as a failure mode requiring a human to fix the UI.
- Honour the project's **RTL contract**: when the UI runs under `dir="rtl"` (Arabic), tests still use role-based locators because roles are direction-agnostic. Forbid asserting on physical CSS positions (`left`, `right`, `ml-*`, `mr-*`) — assert on logical roles and visible text instead.
- Honour the project's **URL tab state contract**: navigate to specific tabs via `page.goto('/path?tab=settings')`, never by clicking-and-praying.
- Honour the project's **feature-flag contract**: if a test exercises a flagged feature, either set the flag explicitly in a `beforeAll` (via tRPC mutation, API seed, or env override) or mark the test `test.skip` with a clear reason. Never assume defaults.
- Honour **Docker-only execution**: every shell command in agent instructions runs through `docker exec -it <project-dev-container>` or `make shell-<service>`. No host-side `npm`, `npx`, or `node`.

---

## Stage 4 — Project-level Playwright wiring

### 4.1 Install Playwright

Inside the project's frontend container:

```
docker exec -it <frontend-container> <pm> add -D @playwright/test
docker exec -it <frontend-container> npx playwright install --with-deps
```

Substitute `<pm>` with the detected package manager (`pnpm` / `npm` / `yarn` / `bun`).

### 4.2 `playwright.config.ts`

Create `playwright.config.ts` at the repo root (or in the package that owns the UI if monorepo). Match the existing test setup style. Required entries:

| Key | Value |
|-----|-------|
| `testDir` | `./tests` (or `./e2e/` if `tests/` is already used by unit tests — DETECT, don't assume) |
| `fullyParallel` | `true` |
| `forbidOnly` | `!!process.env.CI` |
| `retries` | `process.env.CI ? 2 : 0` |
| `workers` | `process.env.CI ? 1 : undefined` |
| `reporter` | `[['html', { open: 'never' }], process.env.CI ? ['github'] : ['list']]` |
| `use.baseURL` | `process.env.PLAYWRIGHT_BASE_URL ?? <detected dev URL>` |
| `use.trace` | `'on-first-retry'` |
| `use.locale` | Default `'en-US'`; per-project override for `'ar-SA'` when testing RTL |
| `projects` | One project per browser the team cares about (start with chromium; add firefox + webkit if cross-browser coverage matters here) |
| `webServer` | Only if the dev server is NOT already running externally. If the project uses `make start`, set `webServer.command` to something that fails loudly when called outside Docker, so contributors don't accidentally spawn a host process. Prefer leaving `webServer` unset and documenting "run `make start` first." |

### 4.3 Seed test

Create `tests/seed.spec.ts`. This is what every generated test inherits its fixtures from.

```ts
// tests/seed.spec.ts
import { test, expect } from '@playwright/test';

test('seed: app boots', async ({ page }) => {
  await page.goto('/');
  // Accessibility snapshot anchor — the planner/generator/healer
  // agents will use this as the first known-good state.
  await expect(page).toHaveTitle(/.+/);
});
```

If the app requires auth, add a second seed test that performs login via the project's actual login flow (NOT by mocking) and uses `storageState` to persist the session for downstream tests. Reference the existing auth setup in `serverlessbase/packages/server/src/auth/` or equivalent.

### 4.4 Folders

```
specs/                   # Markdown plans (planner output)
tests/                   # Playwright specs (generator output)
tests/seed.spec.ts
playwright-report/       # gitignored
test-results/            # gitignored
```

Update `.gitignore` so `playwright-report/`, `test-results/`, `playwright/.cache/`, and any `*.zip` artifact paths are excluded.

---

## Stage 5 — Skills (per AI tool, only where the dir exists)

For `.claude/skills/` (and the equivalent in other detected tool dirs), create:

### 5.1 `playwright-mcp-testing` skill

`SKILL.md` body should cover:

- **When to invoke**: any request that says "test", "e2e", "browser", "automation", "regression", "Playwright", "scenario", "user flow", or names a route/feature with verbs like "verify", "check", "validate".
- **Tool inventory**: list of Playwright MCP tools available (`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_type`, `browser_fill_form`, `browser_select_option`, `browser_press_key`, `browser_hover`, `browser_drag`, `browser_take_screenshot`, `browser_evaluate_script`, `browser_list_console_messages`, `browser_list_network_requests`, `browser_handle_dialog`, `browser_wait_for`, `browser_run_code_unsafe`).
- **Workflow**: planner → generator → healer chain; how to invoke each.
- **Project-specific selectors**: how to pick locators in THIS codebase (role + name first, `getByTestId('...')` second, never raw CSS). Cite the actual `data-testid` convention if you find any in the repo.
- **Anti-patterns**: hardcoded waits (`page.waitForTimeout`), CSS selectors, screenshot-based diffing for non-visual assertions, deleting flaky tests instead of healing them.
- **Tracing**: `npx playwright show-trace test-results/.../trace.zip` (always via `docker exec`).
- **Reports**: `npx playwright show-report` (via `docker exec` with port forwarding documented).

### 5.2 `playwright-test-author` skill

A focused skill on writing a single new test from a spec. Covers:

- The minimum test file shape (`import { test, expect } from '@playwright/test'`)
- Assertion catalog (the 10 web-first assertions from Playwright's docs)
- Test isolation contract (one `page` per test, no shared state)
- Hooks (`test.describe`, `test.beforeEach`, `test.beforeAll`, `test.afterEach`, `test.afterAll`)
- When to use `test.step()` vs not
- When to fixture (custom fixtures in `tests/fixtures.ts`)

### 5.3 `playwright-trace-debugging` skill

Covers reading a failing test run: viewing the trace zip, action log, network panel, console panel, source-mapped stack. Pairs with the existing `chrome-devtools-debug-specialist` agent — note in the SKILL.md that **Playwright traces are the first stop for E2E failures; Chrome DevTools MCP is for live debugging of the dev server**.

---

## Stage 6 — Rules (per AI tool, mirror to all detected dirs)

Create `.claude/rules/playwright-mcp-testing.md` (and copies in `.opencode/`, `.codex/`, `.agents/` rule equivalents if those tools support rules). Content:

### Strict rules

1. **Docker-only execution.** Every `npx playwright …` command runs via `docker exec` or `make shell-*`. Forbid host-side execution.
2. **Accessibility-first selectors.** `getByRole`, `getByLabel`, `getByPlaceholder`, `getByText`, `getByTestId`. No CSS, no XPath. If neither role nor testid works, file an a11y bug — don't reach for `.css-x4f9z`.
3. **Web-first assertions only.** Use the auto-retrying `expect(locator).toBeVisible()` family. Forbid `page.waitForTimeout` and manual `setTimeout` polling.
4. **One concern per test.** Each `test(...)` block exercises one user-facing outcome. Multi-step flows live in `test.describe` groups with shared `beforeEach`.
5. **No mocked DOM.** Tests run against a real browser against a real running app. API mocking via `page.route()` is allowed and encouraged for failure-mode coverage; DOM mocking is not.
6. **Trace on retry.** `trace: 'on-first-retry'` is mandatory — never `'on'` (slow + huge artifacts), never `'off'`.
7. **RTL parity.** Any test that exercises layout-sensitive UI MUST have a sibling project entry with `locale: 'ar-SA'` and `dir: 'rtl'`. Assert on roles and text, not on physical CSS.
8. **Feature flags explicit.** If the flow under test is gated by a feature flag, set it in `beforeAll` (via API/tRPC, NOT by checking a UI toggle). Otherwise, `test.skip(condition, reason)`.
9. **No `--browser-extension` in this repo.** This project's tests run in isolated contexts; the extension mode is for ad-hoc human-driven exploration.
10. **`browser_run_code_unsafe` is gated.** Only use it inside a healer iteration when no MCP tool combination can express the verification. Cite the Playwright docs' RCE warning when invoking it.

### Forbidden patterns

| Pattern | Why | Use instead |
|---------|-----|-------------|
| `page.waitForTimeout(N)` | Race conditions, slow tests | Web-first assertions, `page.waitForResponse`, `page.waitForURL` |
| `page.locator('.css-class')` | Brittle, bypasses a11y | `getByRole` / `getByTestId` |
| `await new Promise(r => setTimeout(r, N))` | Same as above | Same as above |
| Snapshot tests for text content | Drift on every copy edit | Explicit `expect(...).toHaveText(...)` |
| Tests that depend on test order | Breaks parallel execution | `test.beforeEach` for setup |
| Commit `playwright-report/` or `test-results/` | Bloats repo | `.gitignore` them |
| Run `npm install` on host | Violates Docker-only contract | `docker exec` |
| Generate tests without verifying selectors live | Produces dead tests | Always run the generator agent against the running app |
| Healer deletes failing tests | Hides regressions | Healer either fixes or marks `test.skip(true, 'reason')` with explanation |

### Validation checklist

Before marking Playwright work complete:

- [ ] `playwright.config.ts` exists with required entries
- [ ] `tests/seed.spec.ts` boots and passes
- [ ] All three agents (planner / generator / healer) installed per detected tool dir
- [ ] Playwright MCP server registered in every detected tool's config file
- [ ] CI workflow file added (Stage 7) and matches existing CI style
- [ ] `.gitignore` excludes `playwright-report/`, `test-results/`, `playwright/.cache/`
- [ ] At least one generated `specs/<feature>.md` and one matching `tests/<feature>.spec.ts` exist as proof of life
- [ ] Tests run successfully inside Docker via `docker exec -it <frontend-container> npx playwright test`
- [ ] User-facing docs (if any) follow `.claude/rules/public-docs-governance.md` (only `user/`, `user-guide/`, `api/`, `integrations/` allowed under `/docs/`)

---

## Stage 7 — CI

Add `.github/workflows/playwright.yml`. Match the existing workflow style in this repo (read `.github/workflows/*` first; reuse the same Node setup steps, cache strategy, and concurrency group naming). Minimum shape:

```yaml
name: Playwright Tests
on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    timeout-minutes: 60
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: lts/*
          cache: <detected-package-manager>
      - name: Install dependencies
        run: <pm> install --frozen-lockfile
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npx playwright test
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.PLAYWRIGHT_BASE_URL || 'http://localhost:<dev-port>' }}
      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

If the project already has a Docker-based CI job that boots the dev stack via `make start`, ADAPT this workflow to run `npx playwright test` against the running compose stack instead of spawning a host dev server. Do NOT introduce a parallel "host dev server in CI" pattern — that diverges from local dev.

If the project has a private staging URL the team uses for E2E (look for `PLAYWRIGHT_BASE_URL`, `STAGING_URL`, `E2E_BASE_URL` in `.env.example` or existing workflows), use that as the default in `PLAYWRIGHT_BASE_URL` rather than localhost.

---

## Stage 8 — References (small, focused, lazy-loaded)

For tools that support reference files (`.claude/skills/<skill>/references/`, `.opencode/references/`, etc.), generate:

| File | Content (one screen each, no more) |
|------|-------------------------------------|
| `playwright-tools-cheatsheet.md` | Every Playwright MCP tool name + one-line description + one-line example. From the docs section "Interacting with pages". |
| `assertions-catalog.md` | The 10 web-first assertions table from Playwright's docs ("Writing tests" → "Assertions"), with one-line examples. |
| `locators-priority.md` | Role > Label > Placeholder > Text > AltText > Title > TestId. Examples for each. Sourced from Playwright docs locator guide. |
| `trace-viewer-quickref.md` | How to open a trace zip, what each panel shows, how to find the failing action's source line. |
| `ci-recipes.md` | The GitHub Actions workflow (Stage 7), plus the "Properly handling Secrets" warning from Playwright's CI doc verbatim. |
| `agents-loop.md` | Planner → spec.md → generator → spec.ts → healer flow diagram, sourced from Playwright's "Test Agents" doc. |

References MUST be lazy-loaded — DO NOT inline them into agent system prompts.

---

## Stage 9 — Final output

Your final response MUST include:

1. The **detection report** (Stage 1 table).
2. A **file manifest** listing every file you created or modified, grouped by purpose (MCP config / agents / skills / rules / references / project wiring / CI / gitignore).
3. The **exact `docker exec` command** the user runs to verify everything works end-to-end. Example shape:
   ```
   docker exec -it <frontend-container> npx playwright test tests/seed.spec.ts --reporter=list
   ```
4. A **next-step prompt** the user can paste to the planner agent to generate the first real spec, e.g.:
   ```
   @playwright-planner Generate a plan for guest checkout. Use tests/seed.spec.ts as the seed.
   ```

---

## Hard rules — DO NOT VIOLATE

- **Do NOT create `.claude/`, `.opencode/`, `.codex/`, or `.agents/` if they do not already exist** at the repo root. `.claude/` is the exception — populate it even if absent because it is this codebase's canonical AI-tool dir.
- **Do NOT overwrite existing files.** If `playwright.config.ts`, an agent file, a skill, or a rule already exists, READ it, then EXTEND with a clearly-marked addition. Surface the conflict to the user before merging.
- **Do NOT commit secrets.** No API tokens, no `PLAYWRIGHT_BASE_URL` containing real staging credentials. Use GitHub Actions secrets.
- **Do NOT run destructive git commands.** No `git stash`, no `git reset --hard`, no `git clean -fd`. If you hit a dirty tree, surface it and stop.
- **Do NOT bypass Docker.** Every install / install-browsers / test / show-report / show-trace runs via `docker exec` or `make shell-*`.
- **Do NOT generate tests speculatively.** The generator runs LIVE against the running app and verifies every selector. If the app is not running, stop and tell the user to `make start` first.
- **Do NOT skip the seed test.** Without it, the planner/generator/healer chain has no anchor.
- **Do NOT introduce a parallel test framework.** If Vitest, Jest, Cypress, or another test runner already exists, Playwright coexists with it — different file extensions (`*.spec.ts` for Playwright in `tests/`, leave existing runners' patterns alone), different scripts (`test:e2e` vs `test:unit`).

---

## Reference material (use these verbatim where appropriate)

The agent instructions, skill bodies, and reference files should quote or paraphrase from the three Playwright doc excerpts the user provided:

- **Playwright MCP — Introduction**: installation, accessibility snapshots, tool list, configuration flags (`--headless`, `--browser`, `--isolated`, `--extension`, `--port`).
- **Writing tests**: first-test shape, actions table, assertions table, isolation contract, hooks.
- **Playwright Test Agents**: planner/generator/healer roles, the `init-agents` command, the `specs/` + `tests/` + `seed.spec.ts` artifact layout, the agentic loop.
- **Setting up CI**: GitHub Actions workflow, artifact upload, trace viewing, secret handling.

When you cite Playwright capabilities in agent instructions, prefer the official terminology from these docs (e.g., "accessibility snapshot", "web-first assertion", "test fixture", "browser context") so prompts stay legible to anyone who's read Playwright's own docs.

---

## Success criteria

- A fresh contributor can run `make start`, then `docker exec -it <frontend-container> npx playwright test`, and get a green `tests/seed.spec.ts`.
- A team member can ask their AI tool "generate Playwright tests for the login flow" and the planner → generator → healer chain produces working tests under `tests/`.
- CI runs Playwright on every PR and uploads the HTML report as an artifact.
- No host-side npm/node commands appear anywhere in the docs, agents, skills, rules, or CI.
- Existing tests (unit / integration / whatever was there before) still pass unchanged.
