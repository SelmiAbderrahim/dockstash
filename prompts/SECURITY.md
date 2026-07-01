# Security Audit & Remediation Prompt

> **Purpose**: Drive a full security audit of this codebase using the installed cybersecurity skill library, then **fix** every confirmed finding — adapted to this stack (React + TypeScript + tRPC + Drizzle + Next.js + Docker + PostgreSQL + better-auth). This prompt does the FINDING and the FIXING; it is not an import prompt.
>
> **How to use**:
> - **Direct (recommended)**: paste/run this file with Claude Code, Codex CLI, or OpenCode from the project root. The agent executes the phases below, invoking installed skills via the **Skill tool** by exact name.
> - **Executor**: place this file in a folder and run `python3 -m prompt_executor run -m opus prompts/security-audit/` (the executor runs `.md` files in a folder; a single top-level file can also be driven directly). For a long audit, split Phase 3 per vulnerability class into numbered sub-prompt files so each runs as its own retryable step.
>
> The skills referenced here are **already installed** under `.claude/skills/` (897 skills, including the 12 `tob-*` Trail of Bits skills and the broad offensive/defensive/forensics library). The Trail of Bits import is recorded in `docs/internal/security/tob-import-log.md`; this prompt **consumes** those skills rather than importing them.

---

## ⚠️ Authorized Scope & Responsible Use (READ FIRST — NON-NEGOTIABLE)

The installed library contains offensive skills (`exploiting-*`, `performing-*-penetration-test`, `conducting-*`, `building-c2-*`, sqlmap/metasploit/hashcat workflows, etc.). In THIS prompt they are used **only as a knowledge reference** for what insecure patterns look like in source code — to guide static, read-only analysis of THIS repository.

| ✅ ALLOWED in this prompt | ❌ FORBIDDEN in this prompt |
|---------------------------|-----------------------------|
| Read source, configs, schemas, Dockerfiles, CI in this repo | Launching live attacks against production or any deployed host |
| Run **read-only** static scanners locally (`semgrep`, `gitleaks`, `trufflehog`, `pnpm audit`, `trivy` against local images) | Running `metasploit`, `sqlmap`, `hashcat`, `nmap`, network scanners against real targets |
| Use offensive-skill *checklists* to recognize vulnerable code shapes | Standing up C2, phishing, or social-engineering infrastructure |
| Use a local sandbox/ephemeral container to validate a fix | Exfiltrating data, pivoting, or persistence of any kind |
| Write remediation code + tests | Committing real secrets, even as "examples" |

If a skill's natural workflow requires attacking a live system, **do not run that part** — extract only the detection signatures and apply them statically. Network/scanning steps run only against **local, throwaway** containers you created for this audit. When in doubt, STOP and ask.

All shell commands run **inside Docker** (`docker exec` / `make shell-*`) per `.claude/rules/docker-development-only.md`. Never run destructive git per `.claude/rules/git-destructive-commands.md`.

---

## Phase 0 — Preconditions & Scope

### 0.1 Clean tree + working branch
```
git status --porcelain
```
If non-empty, STOP and ask the user. Then create a dedicated branch (do NOT work on `master`/`oss-mirror`):
```
git switch -c security/audit-$(date +%Y%m%d)
```

### 0.2 Confirm the skill library is present
```
ls .claude/skills/ | grep -cE '^(tob-|testing-|exploiting-|detecting-|implementing-|performing-|analyzing-|hunting-|scanning-|hardening-|securing-)'
```
Expect a count in the hundreds. If near zero, the skills are not installed — STOP and tell the user to install them (this prompt does not import).

### 0.3 Define audit scope
Default scope (all of it), in priority order:
1. `serverlessbase/apps/serverlessbase/server/api/routers/**` — tRPC procedures (authz, IDOR, input validation)
2. `serverlessbase/packages/server/src/services/**` — services (SSRF, command injection, secret handling, sandbox exec)
3. `serverlessbase/packages/server/src/utils/**` — crypto, auth, proxy, SSH
4. `serverlessbase/apps/serverlessbase/pages/api/**` — raw API routes (webhooks, SSE, stream endpoints)
5. `client/src/**` — XSS sinks, token handling, open-redirect, CSP
6. `docker/**`, `Dockerfile.*`, `.github/workflows/**` — container & CI hardening, secret scanning
7. `package.json` / `pnpm-lock.yaml` — dependency & supply-chain

Ask the user only if they want to narrow scope; otherwise proceed with the full default.

### 0.4 Open the audit ledger
Create `docs/internal/security/audit-$(date +%Y%m%d).md` with an empty Findings table (schema in Phase 6). Every finding is appended here as it is discovered, triaged, fixed, and verified. This file is the single source of truth for the run and makes the audit resumable.

---

## Phase 1 — Skill Catalog (map the installed library to this stack)

This is the "support all the newly added skills" surface. For each vulnerability class, the table lists the **exact installed skill names** to invoke via the Skill tool. FIND skills are read-only/static; FIX skills produce remediation. Meta-review skills sharpen both.

> Invoke a skill with the **Skill tool** using its exact directory name (e.g. skill `testing-for-broken-access-control`). Read the skill's `SKILL.md`, apply its detection checklist to the in-scope code, and record evidence (file:line) — do **not** blindly run its offensive tooling (see Authorized Scope).

### 1.1 Access control / multi-tenant isolation (HIGHEST priority for this codebase)
| Use | Skills |
|-----|--------|
| FIND | `testing-for-broken-access-control`, `exploiting-idor-vulnerabilities`, `testing-api-for-broken-object-level-authorization`, `detecting-broken-object-property-level-authorization`, `exploiting-broken-function-level-authorization` |
| Context | Every Drizzle query touching org-scoped data MUST filter by BOTH `eq(table.organizationId, ctx.organizationId)` AND ownership. Cross-reference `prompts/security-hardening/` (prior IDOR fixes) and the `.claude/rules/*` org-scoping conventions. |

### 1.2 Injection (SQL / NoSQL / command / template / deserialization)
| Use | Skills |
|-----|--------|
| FIND | `exploiting-sql-injection-vulnerabilities`, `performing-second-order-sql-injection`, `exploiting-nosql-injection-vulnerabilities`, `exploiting-template-injection-vulnerabilities`, `exploiting-insecure-deserialization`, `exploiting-prototype-pollution-in-javascript` |
| Context | Drizzle is parameterized — flag raw `sql\`\`` with interpolation, dynamic `docker exec` / `child_process` args (sandbox factories, SSH proxy), and any `eval`/`Function`/template rendering on user input. |

### 1.3 SSRF & command injection in services
| Use | Skills |
|-----|--------|
| FIND | `exploiting-server-side-request-forgery`, `performing-blind-ssrf-exploitation`, `performing-ssrf-vulnerability-exploitation` |
| Context | High-risk surfaces: WebSmith Firecrawl scraper, DNS/cert verification, webhook fetchers, image-generation/provider URLs, sandbox port allocator, nginx host-route registrar. Verify allow-lists and that user-supplied URLs cannot reach internal IPs/metadata endpoints. |

### 1.4 Authentication / session / JWT / OAuth
| Use | Skills |
|-----|--------|
| FIND | `testing-for-json-web-token-vulnerabilities`, `testing-jwt-token-security`, `exploiting-jwt-algorithm-confusion-attack`, `performing-jwt-none-algorithm-attack`, `testing-oauth2-implementation-flaws`, `exploiting-oauth-misconfiguration`, `bypassing-authentication-with-forced-browsing`, `detecting-oauth-token-theft` |
| FIX | `implementing-jwt-signing-and-verification`, `configuring-oauth2-authorization-flow`, `performing-oauth-scope-minimization-review` |
| Context | Auth is better-auth (HttpOnly cookies, `ctx.user`/`ctx.session`). Verify procedure-level guards (`protectedProcedure`/`adminProcedure`), MCP/chatbot closure-captured identity (no `userId`/`orgId` in LLM-visible Zod schemas — see `chatbot-patterns.md`), and OTP/verification-code flows. |

### 1.5 API-layer flaws (mass assignment, rate limiting, schema, GraphQL, WebSocket)
| Use | Skills |
|-----|--------|
| FIND | `testing-api-security-with-owasp-top-10`, `conducting-api-security-testing`, `exploiting-mass-assignment-in-rest-apis`, `testing-api-for-mass-assignment-vulnerability`, `exploiting-excessive-data-exposure-in-api`, `detecting-shadow-api-endpoints`, `performing-graphql-security-assessment`, `testing-websocket-api-security`, `exploiting-websocket-vulnerabilities` |
| FIX | `implementing-api-schema-validation-security`, `implementing-api-rate-limiting-and-throttling`, `implementing-api-key-security-controls` |
| Context | Mass assignment = Zod `.passthrough()` or spreading raw input into a Drizzle insert/update. Verify every tRPC input schema is strict and excludes server-controlled fields (`organizationId`, `userId`, `role`, pricing/quota fields). |

### 1.6 Web client & HTTP-layer (XSS, CORS, redirect, headers, smuggling, race)
| Use | Skills |
|-----|--------|
| FIND | `testing-for-xss-vulnerabilities`, `testing-cors-misconfiguration`, `testing-for-open-redirect-vulnerabilities`, `testing-for-host-header-injection`, `exploiting-http-request-smuggling`, `exploiting-race-condition-vulnerabilities`, `testing-for-sensitive-data-exposure`, `testing-for-xxe-injection-vulnerabilities`, `testing-for-email-header-injection`, `testing-for-business-logic-vulnerabilities` |
| FIX | `performing-security-headers-audit` |
| Context | Flag `dangerouslySetInnerHTML`, unvalidated redirect targets, `Host`-header trust in email/links (use `getActiveBrand()` / `SITE_URL` per `site-url-env-pattern.md`), and CORS reflection. Race conditions: sandbox quota (advisory-lock), Smart Inject, payment/credit ledger. |

### 1.7 Secrets & credential handling
| Use | Skills |
|-----|--------|
| FIND | `implementing-secret-scanning-with-gitleaks`, `detecting-aws-credential-exposure-with-trufflehog`, `implementing-secrets-scanning-in-ci-cd` |
| FIX | reference existing `encryptServiceKey()` / `decryptServiceKey()` and `.claude/rules/environment-variables.md` (root `.env` only) — prefer the in-repo crypto helpers over `implementing-secrets-management-with-vault`/PAM skills, which are aspirational here |
| Context | Verify provider keys, Stalwart/Postal tokens, DNS-provider creds, SSH private keys are encrypted at rest and never returned unmasked or logged (`sandbox-node-patterns.md`, `dns-provider-patterns.md`, `stalwart-mail-patterns.md`). |

### 1.8 Dependency / supply chain
| Use | Skills |
|-----|--------|
| FIND | `performing-sca-dependency-scanning-with-snyk`, `tob-supply-chain-auditor`, `analyzing-sbom-for-supply-chain-vulnerabilities`, `detecting-typosquatting-packages-in-npm-pypi`, `detecting-supply-chain-attacks-in-ci-cd` |
| Run (read-only) | `docker exec -it serverless-main-app pnpm audit` and `docker exec -it serverless-client npm audit` |

### 1.9 SAST
| Use | Skills |
|-----|--------|
| FIND | `tob-semgrep`, `implementing-semgrep-for-custom-sast-rules` |
| FIX (CI) | `integrating-sast-into-github-actions-pipeline`, `securing-github-actions-workflows` |

### 1.10 Container, Docker & CI hardening
| Use | Skills |
|-----|--------|
| FIND | `performing-docker-bench-security-assessment`, `scanning-docker-images-with-trivy`, `performing-container-security-scanning-with-trivy`, `hardening-docker-daemon-configuration` |
| FIX | `hardening-docker-containers-for-production`, `securing-github-actions-workflows`, `implementing-secrets-scanning-in-ci-cd` |
| Context | Trivy scans run against **locally built** images only. |

### 1.11 LLM / agent safety (chatbot, App Studio, Fire-and-Forget, MCP)
| Use | Skills |
|-----|--------|
| FIND | `detecting-ai-model-prompt-injection-attacks`, `tob-agentic-actions-auditor` |
| FIX | `implementing-llm-guardrails-for-security` |
| Context | Verify tool allow-lists, write/destructive confirmation gates, closure-captured identity, sandbox-write path regex, and PAYG source integrity per `chatbot-patterns.md`, `brand-asset-patterns.md`, `prebuilt-stack-templates.md`. |

### 1.12 Meta-review skills (apply to EVERY candidate finding)
| Skill | Role |
|-------|------|
| `tob-audit-context-building` | Build a precise mental model before judging a finding |
| `tob-fp-check` | Confirm a candidate is real before it leaves Phase 3 — kills false positives |
| `tob-variant-analysis` | After confirming one bug, sweep the codebase for the same shape elsewhere |
| `tob-differential-review` | Use when auditing a diff/PR rather than whole-repo |
| `tob-insecure-defaults` | Catch unsafe defaults (permissive flags, fail-open) |
| `tob-sharp-edges` | Catch foot-guns in APIs the code relies on |
| `tob-constant-time` | Timing-safe comparisons for tokens/secrets/OTP |
| `tob-second-opinion` | Independent re-judgement of high-severity findings before fixing |

> If a vulnerability class in scope has no matching skill above, search `ls .claude/skills/ | grep -iE '<keyword>'` and add it to this catalog inline before proceeding. The catalog is meant to grow to cover whatever is installed.

---

## Phase 2 — Recon

Before findings, build the map (use `tob-audit-context-building`):
1. Enumerate tRPC routers and which procedure type each uses (`publicProcedure` is the highest-risk — list every one).
2. Enumerate raw API routes under `pages/api/**` (webhooks, SSE, stream) — these bypass tRPC guards.
3. List every `sql\`\``, `child_process`, `docker exec`, `fetch(`/`axios`/`got` with a user-influenced URL, `dangerouslySetInnerHTML`, `eval`/`new Function`.
4. List crypto/auth/secret touchpoints (`encryptServiceKey`, JWT, OTP, SSH key handling).
Record the recon map in the audit ledger; it drives Phase 3 targeting.

---

## Phase 3 — FIND (per class, evidence-based)

For each class in Phase 1 that is in scope, **in priority order (1.1 → 1.11)**:

1. Invoke the FIND skill(s) for that class via the Skill tool; read the detection checklist.
2. Apply it statically to the recon targets. For static scanners (`semgrep`, `gitleaks`, `trufflehog`, `pnpm audit`, `trivy`), run them read-only in Docker and triage output.
3. For each candidate, run `tob-fp-check`. Discard false positives (note them in the ledger so they aren't re-flagged).
4. For each **confirmed** candidate, run `tob-variant-analysis` to find sibling instances, then append a finding row to the ledger with: id, class, severity (CVSS-style: Critical/High/Medium/Low), file:line, evidence, exploit precondition, and the proposed fix approach.
5. For Critical/High, get a `tob-second-opinion` before moving on.

Do not fix yet. Complete FIND for a class, then proceed. (Splitting one numbered prompt file per class lets the executor checkpoint each class as `_done`.)

Severity guide: **Critical** = unauthenticated RCE / cross-tenant data access / auth bypass. **High** = authenticated privilege escalation / IDOR / SSRF to internal / secret exposure. **Medium** = stored XSS, CSRF on state change, missing rate limit on sensitive op. **Low** = missing header, verbose error, defense-in-depth gap.

---

## Phase 4 — Triage & Plan

Order confirmed findings by severity. For each, decide the minimal correct fix and the regression test that proves it. Group findings that share a root cause (e.g. a missing org-scope helper) into one fix. Present the plan to the user (counts by severity + the fix list) before large or behavior-changing edits, per the plan-first rule.

---

## Phase 5 — FIX (stack-faithful remediation)

Fix highest severity first. For each finding:

1. Invoke the matching FIX/hardening skill from Phase 1 for the remediation pattern.
2. Apply the fix using **this codebase's stack**, per the rewrite contract below. The fix must read as if a maintainer wrote it.
3. Add/extend a regression test (see Phase 6).
4. Mark the finding `fixed` in the ledger with the commit-ready diff summary.

### Stack rewrite contract (mandatory for every fix)
| Generic pattern | This codebase |
|-----------------|---------------|
| `if (req.user.id === resourceUserId)` | Drizzle query with `eq(table.userId, ctx.user.id)` **and** `eq(table.organizationId, ctx.organizationId)` |
| Raw SQL string concatenation | Drizzle query builder or parameterized `sql\`\`` |
| `req.session.user` | better-auth `ctx.user` / `ctx.session` |
| `crypto.encrypt(secret)` | `encryptServiceKey()` / `decryptServiceKey()` (`serverlessbase/packages/server/src/utils/encryption.ts`) |
| `process.env.SECRET` | root `.env` only (`environment-variables.md`) |
| Loose Zod input | strict schema; never accept `organizationId`/`userId`/`role`/pricing fields from the client |
| Hardcoded `serverlessbase.com` / `"ServerlessBase"` | `getActiveBrand()` (server) / `useBrand()` (client) — `multi-brand-source-of-truth.md` |
| `docker run ...` in instructions | `docker exec -it serverless-{service} ...` / `make shell-{service}` |
| Generic React/form example | Shadcn UI + react-hook-form + Zod resolver + logical CSS (`ms-*`/`me-*`) + dark-mode tokens |
| Backend error string | i18n via `ctx.t(...)` / error helpers (`backend-i18n-patterns.md`) |

Never weaken existing behavior to make a scanner pass. Never introduce a new dependency without recording it in the ledger and running `pnpm audit` on it.

---

## Phase 6 — VERIFY

Per fix, and once at the end:
1. **Re-run the FIND skill** for that class against the fixed code — confirm the finding is gone and no variant survived (`tob-variant-analysis` again).
2. **Regression tests** — add tests under the relevant `__tests__/` dir (Vitest for server, see existing `prompts/security-hardening/0[7-9]-*` IDOR/auth/SSRF test suites for the established pattern). Run them in Docker:
   ```
   docker exec -it serverless-main-app pnpm test <path>
   docker exec -it serverless-client npm test
   ```
3. **Static gates** — `docker exec -it serverless-main-app pnpm typecheck` and `... pnpm lint` (and the client equivalents) must pass.
4. **Re-scan** — re-run `pnpm audit` / `trivy` / `semgrep` to confirm net improvement.
Record pass/fail evidence in the ledger. A finding is only `verified` when the detection no longer fires AND a regression test guards it.

---

## Phase 7 — Report

### 7.1 Finalize the audit ledger
`docs/internal/security/audit-YYYYMMDD.md` Findings table:

| ID | Class | Severity | Location (file:line) | Skill(s) used | Status | Fix commit/diff | Regression test |
|----|-------|----------|----------------------|---------------|--------|-----------------|-----------------|
| SEC-001 | IDOR | High | `routers/postgres.ts:88` | `exploiting-idor-vulnerabilities`, `tob-fp-check` | verified | org-scope guard added | `__tests__/postgres-idor.test.ts` |

Plus sections: **Summary** (counts by severity, before/after scanner deltas), **False positives discarded** (with reason, so the next run skips them), **Accepted risk / deferred** (with justification and owner), **Skills exercised** (which of Phase 1 fired), **Follow-ups** (anything out of scope for this run).

### 7.2 Optional CI gate
If the user wants the audit enforced going forward, propose (don't auto-merge) a CI step using `integrating-sast-into-github-actions-pipeline` + `implementing-secrets-scanning-in-ci-cd` + `scanning-containers-with-trivy-in-cicd`, gated to fail the build on new Critical/High. Cross-reference the existing `prompts/security-hardening/11-ci-security-gate.md`.

### 7.3 Hand-off
Summarize for the user: severity counts found vs fixed vs deferred, the branch name, and the exact verification commands run. Do **not** push or open a PR unless the user asks (`git-destructive-commands.md`).

---

## Execution Order
```
Phase 0 (scope) → 1 (skill catalog) → 2 (recon)
        → 3 FIND (per class, fp-checked) → 4 triage
        → 5 FIX (stack-faithful) → 6 VERIFY (re-detect + tests + static gates)
        → 7 report
```
Run FIND fully for a class before fixing it; fix highest severity first; re-detect after every fix.

## Constraints Recap
- **Read-only by default**; offensive skills are reference checklists, never live attacks (see Authorized Scope). Scanners run only against local/throwaway containers.
- **Docker-only** commands (`docker exec` / `make shell-*`).
- **No destructive git**; work on a `security/audit-*` branch; never push/PR without explicit ask.
- **Stack-faithful fixes** (tRPC, Drizzle, better-auth, Shadcn, i18n, multi-brand) — no generic boilerplate.
- **Every confirmed finding gets a regression test** and a re-detection pass before it is marked verified.
- **Evidence-based**: every finding cites file:line and the skill that found it; every fix cites the skill that informed it.
- **Idempotent ledger**: re-running appends only new findings; previously discarded false positives and verified fixes are not re-litigated.
- **Skill coverage**: if an in-scope vuln class lacks a catalog entry, grep `.claude/skills/` and add it before proceeding — this prompt is meant to use whatever security skills are installed.
