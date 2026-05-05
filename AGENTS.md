# ServerlessBase — OpenCode Agent Guide

> **Coexistence note** — Claude Code reads `CLAUDE.md`; OpenCode reads this
> file first, then `CLAUDE.md`. Both share the same `.claude/rules/` directory.
> This file is a concise pointer; `CLAUDE.md` is the comprehensive reference.
> Do not duplicate content that already lives in `CLAUDE.md` or the rules.

---

## 1. Project Identity

ServerlessBase is a **SaaS deployment management dashboard** (Dokploy-forked).
Users sign up at the active brand's domain (default: `serverlessbase.com`) — it is NOT self-hosted, NOT open source.

**Multi-brand**: the same codebase deploys as multiple branded apps via `BRAND_SLUG`
(`default` → `serverlessbase.com`, `fullstackit` → `fullstackit.app`). Brand-conditional values
come from the brand registry (`client/src/brands/`, `serverlessbase/packages/server/src/brands/`)
via `useBrand()` (client) or `getActiveBrand()` (server). Never hardcode `"ServerlessBase"` or
`"serverlessbase.com"` in shared code.
→ Full details: `.claude/rules/multi-brand-source-of-truth.md`

| Layer | Tech |
|-------|------|
| Frontend | React 18, TypeScript, TanStack Router, TanStack Query, Tailwind CSS, Shadcn UI |
| Backend | tRPC API, Drizzle ORM, PostgreSQL, Redis |
| Infrastructure | Docker, Vite, Traefik/Nginx reverse proxy |
| i18n | 5 languages: en, ar, fr, de, es |

---

## 2. Eleven Critical Rules

These rules have **zero tolerance** — violating any blocks your work.

### 2.1 Docker-Only Execution
All commands run inside Docker containers. Never `npm install` on the host.
→ Full details: `.claude/rules/docker-development-only.md`

### 2.2 RTL Support (Arabic)
Use CSS logical properties (`ms-*`, `me-*`, `text-start`). Never physical (`ml-*`, `mr-*`, `text-left`).
Never use `rtl:flex-row-reverse` — native `dir="rtl"` handles flex direction.
→ Full details: `.claude/rules/rtl-support-arabic.md`

### 2.3 Environment Variables
Root `.env` only. Never create `.env` in subdirectories.
→ Full details: `.claude/rules/environment-variables.md`

### 2.4 Naming Convention
Always `serverless-*`, never `dokploy-*`.

### 2.5 No Hardcoded URLs
Derive all URLs from environment variables via `site-config.ts` helpers.
→ Full details: `.claude/rules/site-url-env-pattern.md`

### 2.6 Design Differentiation
Client dashboard (port 48080) must look different from the legacy admin (port 38291).
Table views over card grids; inline buttons over dropdown menus.
→ Full details: `.claude/rules/uncodixify-ui.md`

### 2.7 URL Tab State
All tabbed interfaces persist active tab in URL query parameters.
→ Full details: `.claude/rules/url-tab-state.md`

### 2.8 Destructive Git Commands
Never run `git stash`, `git reset --hard`, `git clean -f*`, `git checkout -- <path>`, `git restore`, `git push --force`, `git rebase`, `git commit --amend`, `git branch -D`, or any history-rewriting command without explicit per-turn user confirmation. Enforced via `permission.bash` in this file and `.claude/settings.json`.
→ Full details: `.claude/rules/git-destructive-commands.md`

### 2.9 Public Docs Governance
Only `user/`, `user-guide/`, `api/`, `integrations/` may appear at `serverlessbase.com/docs`. Internal, operator, developer, and blog directories MUST NEVER be surfaced publicly. Build denylist (`EXCLUDED_CATEGORIES` in `client/scripts/build-docs-seo.js`) and runtime allowlist (`PUBLIC_DOC_PREFIXES` in `client/src/lib/docs/loader.ts`) MUST stay consistent.
→ Full details: `.claude/rules/public-docs-governance.md`

### 2.10 Feature-Flag Parity (Docs + Landing + Dashboard)
Every user-facing feature MUST be gated by its feature flag on all three surfaces simultaneously. When a flag is disabled in the DB, the feature must be invisible in the dashboard (`<FeatureGate>`), in the public docs sidebar and direct URLs (`DOC_PATH_TO_FEATURE_MAP` + `useFilteredDocsNavigation` + `useDocFeatureGate`), and in every landing-page surface that mentions it (hero, features grid, pricing, FAQ, comparison, JSON-LD, meta/OG/Twitter, footer). Anonymous visitors fetch `public.globalDefaults`, not code defaults.
→ Full details: `.claude/rules/feature-flag-docs-landing-parity.md`

### 2.11 Multi-Brand Source of Truth
Every brand-conditional value (product name, domain, support email, theme color, legal entity, allowed features, landing copy, docs/blog enablement) MUST come from the active brand profile via `useBrand()` (client) or `getActiveBrand()` (server). Brand registries live at `client/src/brands/` and `serverlessbase/packages/server/src/brands/`. Never hardcode `"ServerlessBase"` / `"serverlessbase.com"` in shared code, never branch on `BRAND_SLUG === "..."` (use brand profile fields or feature flags instead).
→ Full details: `.claude/rules/multi-brand-source-of-truth.md`

---

## 3. Sources of Truth

| Concern | Authoritative File |
|---------|--------------------|
| Pricing (tiers, limits, PAYG) | `serverlessbase/packages/server/src/billing/pricing-config.ts` |
| Pricing rules | `.claude/rules/pricing-source-of-truth.md` |
| Nginx production config | `/etc/nginx/sites-available/serverlessbase` |
| Nginx editing/reload rules | `.claude/rules/nginx-config-source-of-truth.md` |
| tRPC API patterns | `.claude/rules/trpc-api-patterns.md` |
| Service component tabs | `.claude/rules/service-component-patterns.md` |
| Site URL derivation | `.claude/rules/site-url-env-pattern.md` |

---

## 4. Service Ports (Development)

| Service | Port | Profile |
|---------|------|---------|
| Client Dashboard | 48080 | dev |
| Main App | 38291 | apps-dev |
| API Server | 47623 | apps-dev |
| PostgreSQL | 5432 | dev |
| Redis | 6379 | dev |
| Stalwart HTTP API | 18080 | mail |
| Monitoring | 43867 | apps-dev |

---

## 5. Rules Directory

44 rule files live in `.claude/rules/`. Key categories:

| Category | Example Rules |
|----------|---------------|
| Core | docker-development-only, environment-variables, rtl-support-arabic |
| UI/Design | uncodixify-ui, switch-component-styling, url-tab-state |
| Patterns | service-component-patterns, trpc-api-patterns, bulk-selection-patterns |
| Integration | stalwart-mail-patterns, postal-transactional-patterns, websmith-patterns |
| Operations | nginx-config-source-of-truth, pricing-source-of-truth, email-deliverability, multi-brand-source-of-truth |
| AI Features | ralph-wiggum-integration, fire-forget-patterns, ruflo-integration, zai-provider-patterns |
| Development | spec-driven-development, backend-i18n-patterns, dns-provider-patterns |
| Blog | blog-i18n-routing, blog-search-locale-filtering, blog-highlighting-tokens |

When you need implementation details for a specific feature, read the relevant rule file.

---

## 6. OpenCode-Specific Notes

### 6.1 Instructions Pre-Loading

The `instructions[]` array in `.opencode/opencode.jsonc` loads 8 critical rule
files into every OpenCode session automatically. These are the rules that apply
to virtually all tasks. Feature-specific rules (e.g., stalwart, websmith) are
loaded on demand when you read files in those directories.

### 6.2 Provider Configuration

OpenCode uses Z.AI GLM models via the `zai` provider defined in `opencode.jsonc`:

| Model | Purpose |
|-------|---------|
| `glm-5.1` | Default model (reasoning, tool use) |
| `glm-4.7-flash` | Small/fast model |

API key: `ZAI_API_KEY` environment variable. See `.claude/rules/zai-provider-patterns.md`.

### 6.3 MCP Servers

MCP server configuration will be populated by prompt 09 (mcp-migration).
Current state: `"mcp": {}` — empty, pending migration.

### 6.4 Agents

OpenCode agents are defined as markdown files. ServerlessBase-specific agents
live in `.claude/agents/` and are shared between both systems.

### 6.5 Slash Commands

OpenCode slash commands are mapped from Claude Code skills in `.claude/skills/`.
See `docs/internal/claude-to-opencode-migration.md` §9 for the full mapping.

---

## 7. When You Need More Context

| Question | Read |
|----------|------|
| Full project structure and patterns | `CLAUDE.md` |
| Implementing a specific feature | `.claude/rules/{feature}-patterns.md` |
| Infrastructure decisions | `.claude/rules/docker-development-only.md` |
| i18n requirements | `.claude/rules/rtl-support-arabic.md` + `backend-i18n-patterns.md` |
| Design standards | `.claude/rules/uncodixify-ui.md` + `service-component-patterns.md` |
| Database/API patterns | `.claude/rules/trpc-api-patterns.md` |
| Pricing changes | `.claude/rules/pricing-source-of-truth.md` |
| Nginx config editing | `.claude/rules/nginx-config-source-of-truth.md` |
| Migration details | `docs/internal/claude-to-opencode-migration.md` |
| Marketing assets | `marketing/` directory |

---

## 8. Quick Reference

```bash
# Daily workflow (Docker-only)
make start           # Start dev containers
make stop            # Stop all
make restart         # Restart
make logs            # Follow logs
make shell-client    # Shell into client container
make shell-postgres  # Shell into postgres container

# Build & test
make build           # Production build
make test            # Run tests

# Stalwart mail
make start-mail      # Start mail server
make stop-mail       # Stop mail server
```

---

## 9. File Locations

| What | Where |
|------|-------|
| Project config (comprehensive) | `CLAUDE.md` |
| Agent guide (this file) | `AGENTS.md` |
| OpenCode config | `.opencode/opencode.jsonc` |
| Rules | `.claude/rules/` (43 files) |
| Skills | `.claude/skills/` |
| Agents | `.claude/agents/` |
| Docker | `docker/`, `docker-compose.yml`, `Makefile` |
| Frontend | `client/src/` |
| Backend | `serverlessbase/` |
| Blog | `blog/` |
| Marketing | `marketing/` |
| Internal docs | `docs/internal/` |

---

## 10. Agent Catalog

Catalog of all agents available in this repo. Two runtimes are supported:
**Claude Code** (`.claude/agents/`) and **OpenCode** (`.opencode/agent/`).
Most agents exist in both; a few are runtime-specific. Find the right agent in under 30 seconds.

### 10.1 How to invoke

**Claude Code** — Agents live under `.claude/agents/` in category subfolders. Invoke via the Task tool with `subagent_type` matching the agent name:

```
/subagent code-reviewer "Review the PR diff for security and style"
```

**OpenCode** — Agents live as flat files in `.opencode/agent/`. Invoke via the OpenCode agent picker or CLI:

```
opencode agent run code-reviewer "Review the PR diff for security and style"
```

### 10.2 Picking the right agent

| I want to... | Use |
|---|---|
| Write new code or implement a feature | `coder` |
| Review a PR for correctness and style | `code-reviewer` |
| Find security vulnerabilities | `security-auditor` or `security-test-specialist` |
| Optimize performance | `performance-engineer` or `performance-test-engineer` |
| Debug a production error | `sentry-investigator` |
| Write unit tests | `unit-test-specialist` |
| Write E2E tests | `e2e-playwright-specialist` |
| Test accessibility | `accessibility-test-expert` or `testing-accessibility-auditor` |
| Validate production readiness | `production-validator` or `testing-reality-checker` |
| Plan a complex feature | `planner` or SPARC flow (`specification` → `pseudocode` → `architecture` → `refinement`) |
| Set up CI/CD pipelines | `ops-cicd-github` |
| Manage dependencies | `dependency-manager` |
| Generate API documentation | `docs-api-openapi` |
| Create a new skill | `skill-creator` |
| Design system architecture | `architecture` (Claude) or `arch-system-design` (OpenCode) |
| Refactor safely | `refactor-safely` **skill** (not an agent) |
| Research a codebase or library | `researcher` |

### 10.3 Catalog

#### core

General-purpose agents for everyday development tasks.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| coder | Implementation specialist for writing clean, efficient code | ✓ | ✓ |
| planner | Strategic planning and task orchestration agent | ✓ | ✓ |
| researcher | Deep research and information gathering specialist | ✓ | ✓ |
| reviewer | Code review and quality assurance specialist | ✓ | |
| tester | Comprehensive testing and quality assurance specialist | ✓ | ✓ |

#### quality

Focused review and quality enforcement.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| code-reviewer | Expert code reviewer — TypeScript strict mode, security vulnerabilities, best practices | ✓ | ✓ |
| performance-engineer | Expert performance engineer — optimization, bottleneck identification, strict benchmarks | ✓ | ✓ |
| security-auditor | Expert security auditor — comprehensive assessments, vulnerability scanning, zero-tolerance | ✓ | ✓ |

#### devops

Build, CI/CD, and infrastructure automation.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| build-engineer | Expert build engineer — Vite optimization, Docker builds, fast reliable pipelines | ✓ | ✓ |
| dependency-manager | Expert dependency manager — npm security, version management, zero-vulnerability policy | ✓ | ✓ |
| git-workflow-manager | Expert Git workflow manager — branching, PR automation, conventional commits, GitHub Actions | ✓ | ✓ |
| ops-cicd-github | Specialized agent for GitHub Actions CI/CD pipeline creation and optimization | ✓ | ✓ |

#### development

Framework and stack-specific specialists.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| dev-backend-api | Specialized agent for backend API development including REST and GraphQL | ✓ | ✓ |
| tanstack-router-expert | Expert in TanStack Router — file-based routing, URL state, type-safe navigation | ✓ | ✓ |

#### languages

Language expertise agents.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| javascript-pro | Expert JavaScript developer — ES2023+ features, async patterns, Node.js, clean code | ✓ | ✓ |
| react-specialist | Expert React specialist — React 18+, integration patterns, Shadcn UI, performance | ✓ | ✓ |
| typescript-pro | Expert TypeScript developer — strict type system, full-stack TypeScript, React | ✓ | ✓ |

#### security

Security review and audit.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| security-review-specialist | AI-powered security review — deep semantic analysis, vulnerability detection, reporting | ✓ | ✓ |

#### meta

Tooling for creating and managing agents and skills.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| skill-creator | Expert in creating, validating, packaging Claude skills per Anthropic Agent Skills Spec | ✓ | ✓ |

#### documentation

Documentation generation and maintenance.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| docs-api-openapi | Expert agent for creating and maintaining OpenAPI/Swagger documentation | ✓ | ✓ |

#### sparc

SPARC methodology phase specialists.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| architecture | SPARC Architecture phase specialist for system design | ✓ | |
| pseudocode | SPARC Pseudocode phase specialist for algorithm design | ✓ | ✓ |
| refinement | SPARC Refinement phase specialist for iterative improvement | ✓ | ✓ |
| specification | SPARC Specification phase specialist for requirements analysis | ✓ | ✓ |

#### testing

Testing specialists across all quality dimensions.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| accessibility-test-expert | Accessibility testing — axe-core, WCAG 2.1 AA, keyboard navigation, inclusive design | ✓ | ✓ |
| e2e-playwright-specialist | E2E testing — Playwright, user flow automation, visual regression, cross-browser | ✓ | ✓ |
| performance-test-engineer | Performance testing — Lighthouse CI, Core Web Vitals, optimization verification | ✓ | ✓ |
| production-validator | Production validation — ensuring apps are implemented and deployment-ready | ✓ | ✓ |
| security-test-specialist | Security testing — OWASP ZAP, npm audit, vulnerability scanning, zero-tolerance | ✓ | ✓ |
| testing-accessibility-auditor | Accessibility auditor — WCAG audits, assistive technology testing, inclusive design | ✓ | ✓ |
| testing-api-tester | API testing — comprehensive validation, performance testing, quality assurance | ✓ | ✓ |
| testing-evidence-collector | QA specialist — screenshot-obsessed, requires visual proof for everything | ✓ | ✓ |
| testing-performance-benchmarker | Performance benchmarker — measuring, analyzing, and improving system performance | ✓ | ✓ |
| testing-reality-checker | Evidence-based certification — defaults to "NEEDS WORK", requires overwhelming proof | ✓ | ✓ |
| testing-test-results-analyzer | Test analyst — result evaluation, quality metrics, actionable insight generation | ✓ | ✓ |
| testing-tool-evaluator | Technology assessor — evaluating, testing, recommending tools and platforms | ✓ | ✓ |
| testing-workflow-optimizer | Process improver — analyzing, optimizing, and automating workflows | ✓ | ✓ |
| unit-test-specialist | Unit testing — Vitest, React Testing Library, mocking strategies, 90%+ coverage | ✓ | ✓ |

#### debugging

Production error investigation and diagnostics.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| sentry-investigator | Production error investigation — Sentry MCP, Chrome DevTools, debugging workflows | ✓ | ✓ |

#### opencode-only

Agents available exclusively in OpenCode.

| Agent | Description | Claude | OpenCode |
|-------|-------------|--------|----------|
| arch-system-design | System architecture designer — high-level decisions, scalable design, ADRs | | ✓ |
| implementer-sparc-coder | Transform specifications into working code with TDD practices | | ✓ |

*Regenerate section 10 with prompt 09 from `prompts/`.*
