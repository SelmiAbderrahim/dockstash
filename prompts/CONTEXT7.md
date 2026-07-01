# CONTEXT7 — Mega Prompt

> **A self-contained mega-prompt that wires Context7 into this project end-to-end.**
> Installs the official Context7 MCP server into the Claude Code CLI, stores the API key outside of git, and creates/refreshes the Claude agent, skill, and rule that govern every library-documentation lookup task in this repository.

---

## Mission

You are a Context7 integration installer and AI-configuration author. Your job has four concurrent deliverables that MUST be executed in a single invocation:

1. **Install the Context7 MCP server** (`https://mcp.context7.com/mcp`) into the Claude Code CLI if it is not already registered, authenticated with the provided API key.
2. **Store credentials safely** in the root `.env` file (already matched by `.gitignore`), and verify no secret lands in any tracked file (`.mcp.json`, skills, agents, rules, docs).
3. **Author / refresh the Claude rule, skill, and agent** that make every future library/framework documentation lookup go through Context7 MCP tools — never through training-data hallucinations, never through manual `WebFetch` of GitHub READMEs when Context7 has the library indexed.
4. **Create the documentation cache directory** (`docs/references/context7/`) where fetched docs are saved to disk so subsequent sessions do not re-spend tokens on the same library.

This prompt is idempotent. Re-running it on a fully configured repo MUST be a no-op.

---

## How To Invoke

Run this prompt against the current repository. Pass no arguments. The prompt detects everything from the filesystem and the shell environment.

If the user asks "install context7", "set up context7", "add context7 mcp", "wire up context7 for claude", "configure context7 agent/skill/rule", or simply "I want up-to-date library docs in claude" — execute this prompt.

---

## Operating Constraints

These rules are absolute. Violating them defeats the prompt's purpose.

| Constraint | Rule |
|---|---|
| **Detect before install** | Never run an install command without first checking whether the target is already installed. Re-installs are forbidden. |
| **Never commit secrets** | No `ctx7sk-*` API key may land in any tracked file. Reference it only via the `CONTEXT7_API_KEY` env var. Verify `.mcp.json` contains no key material. |
| **Env var name canonicalization** | Context7 MCP reads the **`CONTEXT7_API_KEY`** env var (no typo). If the user's shell profile defines `CONEXT7_API_KEY` (missing T), add a correctly named alias/export in `.env` — do NOT rename the user's existing variable without asking. |
| **No destructive shell commands** | Never run `rm -rf`, `git reset --hard`, `git stash`, `git clean -f`, or anything that mutates working-tree state outside the Context7 config files. |
| **Project-name agnostic** | The rule, skill, and agent MUST work in any repo. Use placeholders (`<PROJECT_NAME>`, `<LIBRARY_ID>`) where project-specific context is needed. |
| **MCP over manual WebFetch** | The rule MUST make Context7 MCP tools the default for library/framework/API documentation. Manual `WebFetch` of GitHub READMEs is reserved for libraries Context7 cannot find (returns empty `results`). |
| **Cache-first retrieval** | Every agent that fetches Context7 docs MUST check `docs/references/context7/<library-id-slug>.md` before calling `get-library-docs`. Cache hits save tokens and round-trips. |
| **Topic-scoped queries** | `get-library-docs` MUST be called with a `topic` parameter when the user's question targets a specific subsystem (e.g. `"routing"`, `"hooks"`, `"webhooks"`). Unscoped fetches are wasteful. |
| **One change-set per invocation** | Cap at 15 file changes per run. If more are warranted, queue them for a follow-up. |
| **No new npm/pip packages** | This prompt configures tooling, not application dependencies. The Context7 MCP runs as `npx -y @upstash/context7-mcp` on demand; do not vendor it into `package.json`. |

---

## Phase 0 — Capability Detection

**Goal**: Build a full inventory of the current Context7 tooling state and decide which install/author steps are needed.

### 0.1 Detect Context7 MCP registration

Run in order and record results in an `inventory` table:

| Check | Command / File | Present = skip install |
|---|---|---|
| Claude Code MCP registered | `claude mcp list` (if `claude` on PATH) | entry for `context7` |
| Project-local `.mcp.json` | `.mcp.json` at repo root | `context7` key under `mcpServers` |
| Claude settings | `.claude/settings.json` permissions list | `mcp__context7__*` entries |

### 0.2 Detect API key material

| Check | File / Env | Present = skip prompt |
|---|---|---|
| Env var exported | `printenv CONTEXT7_API_KEY` | non-empty |
| Root `.env` | grep `^CONTEXT7_API_KEY=` in `.env` | non-empty |
| Typo'd variant | grep `^CONEXT7_` in `.env` or shell rc | note and migrate to canonical name |

### 0.3 Detect Node.js (Context7 MCP requires Node ≥ 18)

```bash
node --version
```

If missing or `<18`, halt and report — do NOT attempt to install Node. Tell the user to install via `nvm`/`fnm` or their OS package manager, then re-run this prompt.

### 0.4 Detect existing Context7 AI config

| Surface | Path | Action if present |
|---|---|---|
| Claude rule | `.claude/rules/context7-patterns.md` | refresh in place |
| Claude skill | `.claude/skills/context7/SKILL.md` | refresh in place |
| Claude agent | `.claude/agents/context7-specialist.md` OR `.claude/agents/**/context7*.md` | refresh in place |
| Docs cache dir | `docs/references/context7/` | create if missing, never clear |
| CLAUDE.md index pointer | `CLAUDE.md` at root | add/refresh a single pointer line |

### 0.5 Gitignore hygiene check

| Check | Expectation |
|---|---|
| `.env` is ignored | Already matched by `**/.env` in root `.gitignore` — confirm |
| `docs/references/context7/` committed | Cache files SHOULD be committed so the whole team benefits from prior fetches |
| No secret leak | `git ls-files | xargs grep -l "ctx7sk-" 2>/dev/null` MUST return empty |

### 0.6 Report and gate

Produce an inventory table summarizing what will be installed vs. skipped. If EVERYTHING is already present and up to date, end the run with a no-op summary — do not proceed to Phase 1.

---

## Phase 1 — Store Credentials Safely

**Skip if Phase 0 shows `CONTEXT7_API_KEY` already set in `.env`.**

### 1.1 Append to root `.env`

The user has provided:

```
CONTEXT7_MCP_URL=https://mcp.context7.com/mcp
CONTEXT7_API_URL=https://context7.com/api/v1
CONTEXT7_API_KEY=ctx7sk-c948acdd-bc54-44e0-961f-4305e59dd959
```

> Note: The user's original message used `CONEXT7_` (missing T). Use the canonical spelling `CONTEXT7_` — it is the name the Context7 MCP and CLI read. If the user prefers the typo'd variant for historical reasons, export BOTH names so the MCP keeps working.

Append (do NOT overwrite) to the root `.env`:

```bash
# ─── Context7 (library documentation MCP) ───
# Docs: https://context7.com — API key from https://context7.com/dashboard
CONTEXT7_MCP_URL=https://mcp.context7.com/mcp
CONTEXT7_API_URL=https://context7.com/api/v1
CONTEXT7_API_KEY=ctx7sk-c948acdd-bc54-44e0-961f-4305e59dd959
```

### 1.2 Verify `.env` stays untracked

```bash
git check-ignore -v .env
```

Expected output should reference the `.gitignore` rule that excludes it. If `.env` is NOT ignored, stop and ask the user to add `.env` to `.gitignore` before proceeding.

### 1.3 Verify no prior leak

```bash
git log -p --all -S "ctx7sk-" | head -5
git grep "ctx7sk-" -- ':!prompts/CONTEXT7.md' ':!.env*'
```

Both should return nothing. If either shows a hit, report it — do NOT attempt history rewrite. Tell the user to rotate the key at https://context7.com/dashboard and scrub via their chosen secret-removal tool.

---

## Phase 2 — Install Context7 MCP

**Skip if Phase 0 shows `context7` already registered in Claude Code.**

### 2.1 Preferred: Claude Code built-in command

The Context7 MCP supports HTTP transport with a Bearer auth header. Register it scoped to the **project** (team-shared via `.mcp.json`) OR the **user** (private to this machine). Default to **user scope** for API-key-based setups since the token is tied to one account.

```bash
claude mcp add --scope user --transport http context7 https://mcp.context7.com/mcp \
  --header "Authorization: Bearer ${CONTEXT7_API_KEY}"
```

Verify:

```bash
claude mcp list | grep -i context7
```

### 2.2 Fallback: Project-local `.mcp.json` (team-shared, no secret inline)

If the `claude mcp add` command is unavailable OR the team wants the server registered for every contributor, create or update `.mcp.json` at the repo root. **The API key MUST reference the env var, never be inlined.**

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": {
        "Authorization": "Bearer ${CONTEXT7_API_KEY}"
      }
    }
  }
}
```

If `.mcp.json` already exists with other servers, merge — do not overwrite.

### 2.3 Alternative: stdio transport via npx (offline-capable clients)

For MCP clients that do not support HTTP transport well, the stdio variant works too:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {
        "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
      }
    }
  }
}
```

Use HTTP by default; fall back to stdio only if the HTTP variant fails in the user's client.

### 2.4 Permissions wiring

Update `.claude/settings.json` (if it exists) to allow the Context7 MCP tool namespace without per-call prompts — these are read-only documentation fetches and never mutate state.

| Tool pattern | Policy |
|---|---|
| `mcp__context7__resolve-library-id` | auto-allow |
| `mcp__context7__get-library-docs` | auto-allow |

Context7 has no write tools; the entire namespace is safe to auto-allow.

### 2.5 Smoke test

After registration, exercise the MCP once to confirm auth works:

```text
Use Claude Code to call mcp__context7__resolve-library-id with libraryName="react"
and confirm a non-empty results list returns without a 401.
```

If the call fails with 401 / Unauthorized, re-check that `CONTEXT7_API_KEY` is exported in the shell that launched `claude`. On rate-limit (429), confirm the free-tier limit; upgrade via Context7 dashboard if needed.

---

## Phase 3 — Author the Claude Rule

**Refresh or create `.claude/rules/context7-patterns.md`.**

This is the long-form contract every agent reads. Keep it under ~300 lines.

### 3.1 Required sections

- **MANDATORY REQUIREMENT** — one sentence: any task that generates code, sets up configuration, or references a library/framework MUST consult Context7 before relying on training-data knowledge.
- **When to use Context7** — triggers: code generation for a specific library, API setup/config steps, version-specific syntax questions, migration guides, new package the model hasn't seen post-knowledge-cutoff.
- **When NOT to use Context7** — pure language questions (plain TS/Python syntax), repo-internal code navigation (use Grep/Glob), user's own business logic.
- **Workflow** — 4 steps:
  1. Check `docs/references/context7/<slug>.md` cache first.
  2. On cache miss, call `resolve-library-id` with the library's common name.
  3. Call `get-library-docs` with the resolved ID, a `topic` scoped to the question, and `tokens: 5000` (default).
  4. Save the fetched block to `docs/references/context7/<slug>__<topic>.md` with a frontmatter header (library id, topic, fetched-at, Context7 version).
- **Library ID hints** — if the user says "use library /supabase/supabase for docs", pass that slash-prefixed ID directly to `get-library-docs` and skip `resolve-library-id`.
- **Token budgeting** — default `tokens: 5000`. Raise to `10000` only for migration guides or full-API references. Values < 1000 auto-bump to 1000 (server-side).
- **Topic scoping examples** — table of common topics per library family (React: "hooks", "routing", "suspense"; Next.js: "app-router", "middleware", "server-actions"; Prisma: "schema", "migrations", "relations"; etc.).
- **Cache hygiene** — cached docs older than 90 days SHOULD be re-fetched. A stale-check comment at the top of every cache file records `fetched: <YYYY-MM-DD>`.
- **FORBIDDEN patterns** table — no inline API keys in `.mcp.json`, no `curl` to `context7.com/api/v1` from agent code (use the MCP), no bypass to WebFetch GitHub READMEs when Context7 has the library.
- **REQUIRED patterns** table — always check cache, always scope by topic, always save to cache after fetch, always cite the Context7 library ID in code comments when you use its output.
- **File location reference** table — rule, skill, agent, cache directory, `.env` key name.
- **Validation checklist** — 10 bullets a reviewer can tick before approving any Context7-related change.

### 3.2 Add pointer to root `CLAUDE.md`

Append ONE line under the "Important Reminders" block (or equivalent):

```markdown
- **Context7 library docs**: See `.claude/rules/context7-patterns.md` — when writing library/framework code, fetch up-to-date docs via Context7 MCP before trusting training data.
```

---

## Phase 4 — Author the Claude Skill

**Refresh or create `.claude/skills/context7/SKILL.md`.**

This is the operational playbook an agent invokes when it decides "I need library docs right now." Keep it short and directive.

### 4.1 Frontmatter

```yaml
---
name: context7
description: Fetch up-to-date library, framework, and API documentation via the Context7 MCP. Use this skill whenever generating code that targets a third-party library (React, Next.js, Prisma, Stripe SDK, AWS SDK, etc.) or when the user asks for setup/config steps. The skill checks the local cache first (docs/references/context7/) and only calls the MCP on a miss.
---
```

### 4.2 Body sections

- **When to invoke** — 6 triggers with mini-examples.
- **Step-by-step procedure** —
  1. Derive the library name from the user's prompt.
  2. Slugify: lowercase, replace spaces/slashes with `_`.
  3. Read `docs/references/context7/<slug>__<topic>.md` if it exists and `fetched` is <90 days old.
  4. On cache miss/stale: call `mcp__context7__resolve-library-id` with `libraryName`.
  5. If multiple results, pick the one with the highest `trustScore` and `totalSnippets`.
  6. Call `mcp__context7__get-library-docs` with the ID, `topic`, and `tokens`.
  7. Write the returned markdown block to the cache file with a frontmatter header.
  8. Cite the Context7 library ID in the code you then generate (as a short `// ref: /vercel/next.js` comment near the first library API call).
- **When the MCP returns empty** — fallback to the Context7 REST search API via `WebFetch`:
  ```bash
  curl -X GET "https://context7.com/api/v1/search?query=<query>" \
    -H "Authorization: Bearer $CONTEXT7_API_KEY"
  ```
  If still empty, fall back to `WebFetch` of the library's official docs URL. Record the library in `docs/references/context7/_missing.md` so a maintainer can submit it to Context7 via https://context7.com/add-library?tab=github.
- **Cache file format** — frontmatter + markdown body:
  ```markdown
  ---
  library_id: /vercel/next.js
  topic: app-router
  fetched: 2026-04-20
  tokens_requested: 5000
  ---
  <docs body from Context7>
  ```
- **Examples** — 2-3 worked examples (React hooks, Next.js middleware, Prisma schema).

---

## Phase 5 — Author the Claude Agent

**Refresh or create `.claude/agents/context7-specialist.md`.**

This is a subagent a parent Claude delegates to when library documentation is needed, especially during large generation tasks where the parent wants to avoid bloating its own context with multi-library docs.

### 5.1 Frontmatter

```yaml
---
name: context7-specialist
description: Expert in fetching, caching, and summarizing up-to-date library documentation via the Context7 MCP. Use when generating code against a third-party library, when setting up configuration for a framework, or when the user's question is version-specific and training data may be stale. Always checks docs/references/context7/ cache first.
model: haiku
tools: ["Read", "Write", "Grep", "Glob", "mcp__context7__resolve-library-id", "mcp__context7__get-library-docs", "WebFetch"]
---
```

### 5.2 Body

- **Mission** — one paragraph describing the agent's single job: return a curated, cached, topic-scoped documentation block for a named library.
- **Inputs it expects** — `libraryName` (required), `topic` (optional), `tokens` (optional), `forceRefresh` (optional boolean).
- **Output contract** — a single markdown block with:
  1. The Context7 library ID used.
  2. The topic.
  3. The cache status (`HIT`, `MISS`, `STALE_REFRESH`).
  4. The documentation body.
  5. Suggested next steps for the parent agent (e.g., "Now generate the code using the APIs above, add a `// ref:` comment.").
- **Behavior rules** — mirrors the skill but in tighter, agent-appropriate form.
- **Non-goals** — the agent does NOT write application code. It hands docs back to the parent.

---

## Phase 6 — Create the Cache Directory

### 6.1 Directory layout

```
docs/references/context7/
├── README.md              # explains the cache, how to read/write it
├── _missing.md            # running list of libraries Context7 couldn't resolve
├── _index.md              # auto-appended index of cached docs
├── react__hooks.md        # example entry
├── next.js__app-router.md
└── prisma__schema.md
```

### 6.2 Seed `docs/references/context7/README.md`

```markdown
# Context7 Documentation Cache

This directory holds documentation blocks fetched from Context7 (https://context7.com)
and reused across sessions to save tokens and API round-trips.

## File naming

`<library-slug>__<topic>.md` — slug is the library's common name lowercased with
`/` and spaces replaced by `_`. Topic follows the `topic` parameter of `get-library-docs`.

## Frontmatter

Every file begins with:

    ---
    library_id: /vercel/next.js
    topic: app-router
    fetched: 2026-04-20
    tokens_requested: 5000
    ---

## Freshness

Cached docs older than 90 days SHOULD be re-fetched on next use. Agents check
`fetched` and compare against today.

## Committing

Cache files ARE committed to the repo so the whole team benefits. The API key
that fetched them is NOT — it lives only in `.env`.
```

### 6.3 Seed `_missing.md`

```markdown
# Libraries Context7 Could Not Resolve

Libraries here were queried but Context7 returned no results. Submit them via
https://context7.com/add-library?tab=github if you own them, or request the
maintainer to add a `context7.json` file at the library's repo root.

| Library name | Queried on | Agent fallback used |
|---|---|---|
```

---

## Phase 7 — Update `.gitignore` (Safety Check Only)

**This step is defensive. The existing `.gitignore` already covers `.env`.**

Verify these rules are present in root `.gitignore`; if any are missing, append them:

```gitignore
# Context7 — API keys live in .env, never committed
# (.env is already ignored globally; this block is documentation)
**/.env
!/docs/references/context7/
```

Do NOT add `docs/references/context7/` to gitignore — the cache content is committed.

---

## Phase 8 — Final Report

At the end of the run, print a compact summary table:

| Step | Status | Path / Command |
|---|---|---|
| MCP registered | ✅ / ➡︎ skipped / ❌ error | `claude mcp list` output |
| `CONTEXT7_API_KEY` in `.env` | ✅ / ➡︎ skipped | appended / already present |
| `.mcp.json` team config | ✅ / ➡︎ N/A | merged or user scope preferred |
| Rule authored | ✅ / ➡︎ refreshed | `.claude/rules/context7-patterns.md` |
| Skill authored | ✅ / ➡︎ refreshed | `.claude/skills/context7/SKILL.md` |
| Agent authored | ✅ / ➡︎ refreshed | `.claude/agents/context7-specialist.md` |
| Cache dir | ✅ / ➡︎ already exists | `docs/references/context7/` |
| CLAUDE.md pointer | ✅ / ➡︎ refreshed | one-line reminder added |
| Smoke test | ✅ / ❌ failed with <reason> | MCP call returned N libraries |
| Secret leak audit | ✅ clean / ❌ FOUND in <file> | grep result |

Then tell the user:

```text
Next steps:
1. Open a new Claude Code session so the MCP registration takes effect.
2. Try a prompt like: "Set up a Next.js middleware that checks for a valid JWT. use context7"
3. Verify docs/references/context7/next.js__middleware.md was created after the run.
4. The Context7 API key lives only in `.env` — rotate it from https://context7.com/dashboard if it ever leaks.
```

---

## Appendix A — Recommended Trigger Rule (paste into context7-patterns.md)

This is the heart of the rule file's behavior spec:

> **Always use Context7 when the task involves code generation, setup, configuration steps, or library/API documentation.** That means: resolve the library id and fetch docs via the Context7 MCP tools without being asked — UNLESS the exact library+topic already exists in `docs/references/context7/` and is under 90 days old, in which case use the cache directly.

---

## Appendix B — Context7 REST API (fallback only)

When the MCP is unavailable (offline dev, CI container without Node 18), the REST search endpoint is a last-resort fallback. The same API key works:

```bash
curl -X GET "https://context7.com/api/v1/search?query=react+hook+form" \
  -H "Authorization: Bearer $CONTEXT7_API_KEY"
```

Response shape:

```json
{
  "results": [
    {
      "id": "/react-hook-form/documentation",
      "title": "React Hook Form",
      "description": "📋 Official documentation",
      "totalTokens": 50275,
      "totalSnippets": 274,
      "stars": 741,
      "trustScore": 9.1,
      "versions": []
    }
  ]
}
```

Then construct the docs fetch URL manually (or via MCP once it's reachable):

```
GET https://context7.com/api/v1/<id>?topic=<topic>&tokens=<n>
Authorization: Bearer $CONTEXT7_API_KEY
```

Prefer the MCP in all normal operation; use REST only as a bridge.

---

## Appendix C — Publishing This Repo to Context7 (Optional)

If this project becomes a library others consume via Context7, drop a `context7.json` at the repo root:

```json
{
  "$schema": "https://context7.com/schema/context7.json",
  "projectTitle": "<PROJECT_NAME>",
  "description": "<one-line description>",
  "excludeFolders": ["node_modules", "dist", "build", ".next", "coverage", "client/dist", "serverlessbase/.turbo"],
  "excludeFiles": ["CHANGELOG.md", "LICENSE.md", "CODE_OF_CONDUCT.md"],
  "rules": [
    "Docker-only development: all commands run inside containers via `make shell-*`",
    "Use the tRPC wrapper functions from `lib/api/dokploy.ts` for all backend calls",
    "Use logical CSS properties (ms-*, me-*) for RTL support"
  ]
}
```

Then submit the repo at https://context7.com/add-library?tab=github.

Skip this appendix if the project is not intended for public library consumption.

---

## Idempotency Summary

| Re-run scenario | Expected behavior |
|---|---|
| All phases already complete | Print summary, change nothing |
| Only rule/skill/agent drifted | Refresh those files in place, leave MCP config alone |
| API key rotated in `.env` | Detect new value, re-register MCP if the header token changed |
| New library queried | Skill writes a new cache file; rule/skill/agent untouched |
| `.env` lost | Refuse to proceed; instruct the user to restore the key from Context7 dashboard |

---

## Done Criteria

The prompt is complete when:

1. `claude mcp list` shows `context7` with an authenticated HTTP endpoint.
2. `.env` contains `CONTEXT7_API_KEY=ctx7sk-...` and that file is gitignored.
3. No tracked file contains the literal string `ctx7sk-`.
4. `.claude/rules/context7-patterns.md`, `.claude/skills/context7/SKILL.md`, and `.claude/agents/context7-specialist.md` all exist and pass their own validation checklists.
5. `docs/references/context7/README.md` exists and the directory is writable.
6. A smoke-test call to `mcp__context7__resolve-library-id` with `libraryName: "react"` returns a non-empty results array.
7. The root `CLAUDE.md` has a single pointer line referencing the Context7 rule.
