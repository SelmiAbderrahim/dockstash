# AUTO-IMPROVE-AGENTS

> **A self-contained meta-prompt that audits and improves the AI configuration of any project.**
> Drop this file into any repository's `prompts/` directory and invoke it to detect drift between the codebase and its AI tooling (rules, skills, agents, ARCHITECTURE.md, CLAUDE.md/AGENTS.md), then propose and apply targeted improvements.

---

## Mission

You are an AI configuration auditor. Your job is to make this project's AI assistance **more effective, more scalable, and more consistent** by aligning the AI tooling layer (`.claude/`, `.opencode/`, root-level `ARCHITECTURE.md`, `CLAUDE.md`, `AGENTS.md`) with the actual state of the codebase.

A well-configured project's AI layer satisfies all of these:

1. **Every recurring code pattern (3+ occurrences) has a governing rule** — so future AI sessions write code that fits.
2. **Every rule reference is alive** — file paths, function names, env vars, and table names quoted in rules still exist in the code.
3. **Every skill has a falsifiable trigger** — the "when to use" clause maps to real domains/imports/file types in the repo.
4. **Every agent has a clear, non-overlapping responsibility** — no two agents claim the same task without a tiebreaker.
5. **`ARCHITECTURE.md` mirrors the current top-level structure** — directories, services, schemas, env vars, integrations.
6. **`CLAUDE.md` / `AGENTS.md` is a navigable index** — pointing to rules and capturing project-wide conventions.
7. **Nothing is orphaned** — every skill/agent/rule is either referenced by an index, used by a workflow, or carries its own self-evident purpose.

This prompt enforces those properties through a strict 7-phase audit-and-improve workflow.

---

## How To Invoke

Run this prompt against the current repository. Pass no arguments. The prompt detects everything from the filesystem.

If the user asks "audit my AI config", "improve my agents", "update ARCHITECTURE.md", or "find drift in my .claude/ folder" — execute this prompt.

---

## Operating Constraints

These rules are absolute. Violating them defeats the prompt's purpose.

| Constraint | Rule |
|---|---|
| **Read-only by default** | Phases 0–4 perform NO writes. Only Phase 5 writes files, and only after the user types `proceed`. |
| **One change-set per invocation** | Cap at **10 file changes** per run. If more changes are warranted, queue them for a follow-up invocation. This prevents AI sprawl — the very problem this prompt fights. |
| **No deletions without explicit confirmation** | Each `DELETE` proposal requires a 2-line justification AND a separate `confirm-delete` token from the user. |
| **Project-name agnostic** | Never hardcode the project's name into rules, skills, or agents. Use the project name only inside `ARCHITECTURE.md` and `CLAUDE.md`/`AGENTS.md` headers. Everywhere else use placeholders like `<PROJECT_NAME>`, `<FRAMEWORK>`, `<DB>`. |
| **No git dependency** | Do not use `git diff`, `git log`, or any git-only command for drift detection. Rely on filesystem grep/glob so this works in shallow checkouts, after long periods, and in repos without local git history. |
| **No destructive shell commands** | Never run `rm`, `git reset`, `npm install`, package upgrades, or anything that mutates state outside the AI config files. |
| **Idempotency** | Re-running this prompt on a clean repo (where the previous run's changes have been merged) MUST produce a no-op `findings` table. |
| **Skip what doesn't exist** | If a project has no `.opencode/`, skip OpenCode-format outputs. If no `ARCHITECTURE.md`, propose its creation as a single change item. Never assume a system is present. |
| **Preserve voice** | Match the existing tone of the project's docs (formal vs casual, table-heavy vs prose, emoji vs no emoji). Detect this in Phase 0 and conform. |
| **No new dependencies** | Never propose adding npm/pip/cargo packages. The AI config is documentation, not code. |

---

## Phase 0 — Capability Detection

**Goal**: Build a complete inventory of which AI config systems are present, plus baseline counts. Skip phases for absent systems.

### 0.1 Detect AI Config Surfaces

Run these checks and record results in an `inventory` table. Use the filesystem-listing tool of your environment (`ls`, `find`, glob); do not invoke shell heuristics that require interpretation.

| Surface | Detect by | If present, count |
|---|---|---|
| Claude rules | `.claude/rules/*.md` | number of `.md` files |
| Claude skills | `.claude/skills/*/SKILL.md` OR `.claude/skills/*.md` | number of distinct skills |
| Claude agents | `.claude/agents/*.md` (recursively) | number of `.md` files |
| Claude commands | `.claude/commands/*.md` | number of files |
| OpenCode agents | `.opencode/agent/*.md` | number of files |
| OpenCode commands | `.opencode/command/*.md` | number of files |
| OpenCode config | `opencode.jsonc` or `opencode.json` | exists / not |
| Root ARCHITECTURE | `ARCHITECTURE.md` at repo root | exists / not, line count |
| Root CLAUDE | `CLAUDE.md` at repo root | exists / not, line count |
| Root AGENTS | `AGENTS.md` at repo root | exists / not, line count |
| Cursor rules | `.cursor/rules/*.mdc` | number of files (informational only) |
| Copilot instructions | `.github/copilot-instructions.md` | exists / not (informational only) |
| Continue rules | `.continue/rules/*.md` | informational |
| Aider conventions | `.aider.conf.yml` or `CONVENTIONS.md` | informational |

### 0.2 Detect Project Identity

In order, check:

1. `package.json` → `.name` field
2. `pyproject.toml` → `[project] name`
3. `Cargo.toml` → `[package] name`
4. `go.mod` → `module` line
5. `composer.json` → `.name`
6. `Gemfile` → top-line gem name
7. Repository directory's basename

Record as `<PROJECT_NAME>` for use only in headers of `ARCHITECTURE.md` and `CLAUDE.md` proposals.

### 0.3 Detect Tech Stack

For each language present, record top markers:

| Marker | Implies |
|---|---|
| `package.json`, `tsconfig.json`, `*.ts`/`*.tsx` | TypeScript / Node |
| `next.config.*`, `app/` dir with route segments | Next.js |
| `vite.config.*` | Vite |
| `requirements.txt`, `pyproject.toml`, `*.py` | Python |
| `Cargo.toml`, `*.rs` | Rust |
| `go.mod`, `*.go` | Go |
| `Gemfile`, `*.rb` | Ruby |
| `composer.json`, `*.php` | PHP |
| `*.sol`, `hardhat.config.*`, `foundry.toml` | Solidity |
| `pubspec.yaml`, `*.dart` | Dart / Flutter |
| `Dockerfile`, `docker-compose*.yml` | Docker |
| `terraform/`, `*.tf` | Terraform |
| `kubernetes/`, `*.yaml` with `apiVersion:` | Kubernetes |
| `prisma/schema.prisma` | Prisma ORM |
| `drizzle.config.*` | Drizzle ORM |
| `*.sql` files in `migrations/` | Raw SQL migrations |
| `.env`, `.env.example` | dotenv-style env vars |

Stack matters for Phase 1's pattern-detection grep recipes.

### 0.4 Output Phase 0 Artifact

Print the inventory + identity + stack as three concise tables. Do nothing else. Then move to Phase 1.

---

## Phase 1 — Codebase Reality Scan

**Goal**: Build a `findings` table by scanning the codebase against the inventory from Phase 0.

The findings table is the universal currency between phases. Every later decision references findings by row number.

### Findings Table Schema

| Column | Description |
|---|---|
| `#` | Sequential ID (start at 1) |
| `Signal` | Short label (e.g. "stale-ref", "undocumented-pattern") |
| `Evidence` | `path/to/file.ext:line` — at least one concrete citation |
| `Severity` | `critical` (blocks AI accuracy), `high` (causes wrong outputs), `medium` (causes inconsistency), `low` (cleanliness) |
| `Suggested action` | One-phrase hint pointing to a Phase 3 change type |

### 1.1 Top-Level Structure Drift

For every top-level directory in the repo (depth 1 from root), check:

- Is it mentioned in `ARCHITECTURE.md`?
- Is it mentioned in any rule file?
- Is it in a standard ignore set (`node_modules`, `.git`, `dist`, `build`, `target`, `.next`, `.cache`, `coverage`, `.turbo`)?

If a non-ignored top-level dir appears nowhere in `ARCHITECTURE.md` or rules → finding: `undocumented-toplevel-dir`, severity `high`.

If `ARCHITECTURE.md` mentions a directory that no longer exists → finding: `stale-arch-ref`, severity `high`.

### 1.2 Recurring-Pattern Hunt

This is the core "find what should be a rule" scan.

For each language detected in Phase 0, grep for these patterns and count occurrences across distinct files. Any token/pattern with **count ≥ 3** in distinct files but **0 mentions** in any rule file → finding: `undocumented-pattern`, severity `medium` to `high`.

**TypeScript / JavaScript patterns to scan:**

| Pattern | Grep recipe (conceptual) | Example signal |
|---|---|---|
| Repeated import target | `from ['"](.+?)['"]` group, count distinct files importing same module | "All 12 files import from `@/lib/auth/session`" |
| Repeated decorator/middleware | `@\w+\(` and `\.use\(\w+\)` | "47 files use `withAuth()`" |
| Repeated env var reads | `process\.env\.\w+` | "`STRIPE_SECRET_KEY` read in 8 files" |
| Repeated error class | `throw new \w+Error\(` | "`ValidationError` thrown in 14 places" |
| Repeated React hook | `use\w+\(` from same import | "`useFeatureFlag()` in 22 components" |
| Repeated HTTP client | `axios\.`, `fetch\(`, custom client | "Mixing `fetch()` and `axios` — pick one" |
| Repeated tailwind class clusters | `className="[^"]*ml-\d+ [^"]*"` | Physical RTL-unsafe spacing |

**Python patterns to scan:**

| Pattern | Grep recipe | Example signal |
|---|---|---|
| Repeated import | `from (.+?) import` | "All routers import `from auth import current_user`" |
| Repeated decorator | `@\w+` at line start | "`@require_auth` on 30 endpoints" |
| Env var reads | `os\.getenv\(['"](\w+)['"]\)` or `os\.environ\[` | "`DATABASE_URL` in 5 files" |
| Repeated exception class | `raise \w+Error\(` | "`PermissionError` raised in 11 files" |

**Rust / Go / Ruby / PHP**: apply the same conceptual scan — find what's repeated AND undocumented.

**Cross-cutting patterns regardless of language:**

| Pattern | Signal |
|---|---|
| Same magic number (port, timeout, buffer size) appearing 3+ times | Belongs in a config rule or constant |
| Same hardcoded URL appearing 3+ times | Belongs in env vars + a rule |
| Same regex literal repeated 3+ times | Belongs in a utility + rule |
| Same SQL query shape repeated | Belongs in a query helper |

### 1.3 Stale-Reference Scan

For each rule file in `.claude/rules/*.md`, extract every:

- File path that looks like `path/to/file.ext` or `dir/sub/file`
- Function/class name in backticks (e.g. `\`functionName()\``)
- Env var name in caps with underscores (e.g. `\`MY_ENV_VAR\``)
- Database table/column name in backticks
- Component/route name

For each extracted reference, run a grep across the codebase to confirm it still exists.

If a rule cites `src/auth/session.ts` and the file is gone → finding: `stale-ref-in-rule`, severity `high`, evidence `path/to/rule.md:line` quoting the dead reference.

Do the same for skills (`.claude/skills/*/SKILL.md`) and agents (`.claude/agents/*.md`).

### 1.4 Schema / Router / Service Drift

If the project has a backend with one or more of:

- Database schema files (Drizzle, Prisma, SQLAlchemy, ActiveRecord, Diesel, GORM, etc.)
- API routers / controllers
- Service layer files

Count the entries:

- Drizzle: `*.ts` files in any `schema/` directory
- Prisma: `model X {` blocks in `schema.prisma`
- SQLAlchemy: classes inheriting from `Base`
- Routers: directories under `routes/`, `controllers/`, `handlers/`, `api/`
- Services: files matching `*Service.ts`, `*_service.py`, `services/*`

Compare counts against any "approximate count" claims in `ARCHITECTURE.md` (e.g. "46 schema files"). If reality differs by more than 20% → finding: `arch-stat-stale`, severity `medium`.

### 1.5 Env Var Drift

Build two sets:

- **Set A**: every distinct env var name read by the code (`process.env.X`, `os.getenv("X")`, `ENV["X"]`, `std::env::var("X")`).
- **Set B**: every env var documented in `.env.example`, `.env.template`, `README.md`, `ARCHITECTURE.md`, or any "Environment Variables" section in rules.

`A − B` → finding: `env-var-undocumented`, severity `high` per missing var.
`B − A` → finding: `env-var-orphan`, severity `medium` per orphan.

### 1.6 Container / Infra Drift

If `docker-compose*.yml` exists, parse the `services:` keys. For each service name, confirm it appears in:

- `ARCHITECTURE.md` (under an "Infrastructure" or "Services" section)
- A rule file (any), OR
- The project's `Makefile` / scripts

Services in compose but documented nowhere → finding: `undocumented-service`, severity `medium`.

If a `Dockerfile` exists at root or in subdirectories, ensure each is referenced somewhere.

If `terraform/` or `kubernetes/` directories exist with non-trivial content but no rule governs their conventions → finding: `infra-no-governance`, severity `medium`.

### 1.7 Skill / Agent Trigger Validity

For each skill in `.claude/skills/`:

- Read the `description:` (the "when to use" trigger) from frontmatter.
- Extract domain keywords (e.g. "stripe", "redis", "graphql", "websockets").
- Confirm the codebase contains imports, files, or env vars matching those keywords.

If a skill's trigger references a domain absent from the code → finding: `orphan-skill`, severity `medium`.

For each agent in `.claude/agents/` and `.opencode/agent/`:

- Read the `description:`.
- Confirm at least one matching domain exists in code.
- Confirm no two agents claim overlapping responsibility (compare description embeddings conceptually — if two descriptions are >70% similar, it's overlap).

### 1.8 Naming Consistency

For files under `.claude/rules/`, `.claude/skills/`, `.claude/agents/`, `.opencode/agent/`:

- Detect filename style: kebab-case (`my-rule.md`), snake_case (`my_rule.md`), or camelCase (`myRule.md`).
- The dominant style wins. Any file deviating → finding: `naming-inconsistency`, severity `low`.

For headings inside these files, detect Title Case vs Sentence case mixing → finding: `heading-style-drift`, severity `low`.

### 1.9 Orphan Detection

A skill or agent is an **orphan** if:

- No `CLAUDE.md` / `AGENTS.md` / index file references it by name, AND
- Its trigger is generic enough that it won't be auto-invoked, AND
- It is not part of a documented workflow

Orphans → finding: `orphan-config`, severity `low`. Each orphan is a candidate for either DELETE (if truly unused) or UPDATE (if it should be referenced).

### 1.10 Anti-Pattern Detection in Codebase

Scan for code-level anti-patterns. Each occurring 3+ times → finding suggesting a NEW_RULE.

| Anti-pattern | Detection |
|---|---|
| Hardcoded API keys / tokens | `(?i)(api[_-]?key|secret|token)\s*[=:]\s*["'][a-zA-Z0-9_\-]{20,}` |
| `console.log` / `print` in non-test code | grep with `tests/__tests__/spec/` excluded |
| Magic timeouts | `setTimeout\(.+,\s*\d{4,}\)` (4+ digits) repeated |
| Inconsistent error handling | mix of `try/catch` swallowing errors and re-throwing in same module |
| Inconsistent HTTP client | both `fetch` and `axios` used in same project |
| `// TODO` density | count per directory; dirs with ≥ 5 TODOs deserve a follow-up rule or a skill |
| Untyped `any` in TypeScript | `: any` count |
| Missing return types on exported functions | symptom of weak conventions |

### 1.11 Output Phase 1 Artifact

Print the complete `findings` table. Then move to Phase 2.

If the table is empty → print "No drift detected. Project AI config is in sync." and EXIT.

---

## Phase 2 — Drift Analysis

**Goal**: Group, deduplicate, and prioritize findings.

### 2.1 Group Findings

Cluster findings by target file or by theme. For example:

- 5 stale references in the same rule → group as one `UPDATE_RULE` candidate.
- 8 undocumented patterns all relating to authentication → group as one `NEW_RULE` candidate ("auth-patterns").
- 3 schema files not in ARCHITECTURE → one `UPDATE_DOC` candidate.

### 2.2 Deduplicate

If the same finding appears under multiple signals, keep one row.

### 2.3 Apply Severity Floor

Drop all `low` findings UNLESS the total findings count is under 10. Rationale: this prompt cares about correctness first; cosmetic issues are worth fixing only when the budget allows.

### 2.4 Map Findings → Change Types

Annotate each surviving group with a Phase 3 change type (NEW_RULE, UPDATE_RULE, NEW_SKILL, UPDATE_SKILL, NEW_AGENT, UPDATE_DOC, DELETE).

### 2.5 Output Phase 2 Artifact

Print the grouped, deduplicated, mapped findings as a table:

| Group # | Theme | Findings (refs) | Severity | Proposed change type |

---

## Phase 3 — Proposal Generation

**Goal**: Convert each group from Phase 2 into a concrete, reviewable change proposal. Stop and wait for user approval before any writes.

### 3.1 The Six Change Types

| Type | When to use | Output |
|---|---|---|
| `NEW_RULE` | A pattern occurs ≥ 3 times in code but is not in any rule. | A new file under `.claude/rules/<kebab-name>.md` using the Rule Template (Appendix A.1). |
| `UPDATE_RULE` | An existing rule has stale refs, missing variants, or broken examples. | A diff to an existing rule file. |
| `NEW_SKILL` | A multi-step workflow recurs (e.g. "investigate webhook failure", "generate migration", "rotate API key") AND has a clear trigger that won't false-positive. | A new directory under `.claude/skills/<kebab-name>/` with `SKILL.md` using the Skill Template (Appendix A.2). |
| `UPDATE_SKILL` | A skill's trigger description no longer matches code reality, or its instructions reference dead paths. | A diff to the skill's `SKILL.md`. |
| `NEW_AGENT` | A specialized domain in the code lacks a dedicated agent — e.g. a complex subsystem with its own conventions, where having tool/permission scoping would help. Emit Claude format if `.claude/agents/` exists; OpenCode format if `.opencode/agent/` exists; both if both. | A new file using the Agent Template (Appendix A.3 or A.4). |
| `UPDATE_DOC` | `ARCHITECTURE.md`, `CLAUDE.md`, or `AGENTS.md` is out of sync with the codebase. | A diff. |
| `DELETE` | A skill/agent/rule is provably dead: trigger references a removed system, content describes deprecated APIs, no code matches its scope. | The path to delete + a 2-line justification. |

### 3.2 Proposal Table Format

Print one row per proposed change:

| # | Type | Target path | Summary (one line) | Evidence (findings refs) | Risk |

Risk levels: `low` (additive, no code citations to break), `medium` (modifies existing rule/doc), `high` (DELETE, or rewrites a >100-line file).

### 3.3 Apply The Cap

If proposals exceed **10**, keep only the top 10 by severity then risk (lowest risk first within same severity). Mention in the output: "X additional improvements deferred to next run."

### 3.4 STOP — Mandatory Human Gate

After printing the proposal table, output exactly:

> **Awaiting confirmation.** Reply `proceed` to apply all proposed changes, `proceed: 1,3,5` to apply a subset, `revise: <feedback>` to regenerate, or `abort` to stop.

Do nothing else until the user responds. **This is the rollback mechanism**: nothing has been written, so refusing is free.

---

## Phase 4 — Quality Gates

**Goal**: Pre-write validation. Run BEFORE any file is touched, AFTER user confirms.

For each approved proposal, verify:

| Gate | Pass criterion |
|---|---|
| **Citation gate** | Every `NEW_RULE` cites ≥ 3 concrete `path:line` examples in its body. |
| **Trigger gate** | Every `NEW_SKILL` has a `description:` that names the specific code domain (no vague "use when working on X"). |
| **No-overlap gate** | Every `NEW_AGENT` description is < 70% similar to any existing agent's description. If overlap, downgrade to `UPDATE_AGENT` of the closest existing one. |
| **Liveness gate** | Every file path / function / env var cited in the new/updated content actually exists in the code right now. |
| **Cap gate** | Total approved changes ≤ 10. |
| **Diff-preview gate** | For every `UPDATE_*` change, a unified diff (or a clear before/after block) was shown in Phase 3. If not, regenerate the proposal with the diff included before writing. |
| **Delete-confirm gate** | For every `DELETE`, the user must have included `confirm-delete:<#>` in their proceed reply. Otherwise skip the deletion. |
| **Voice gate** | New/updated content matches detected project voice (table-heavy vs prose, formal vs casual). |
| **Portability gate** | New rules/skills/agents do not embed the project name as a hardcoded literal except in `ARCHITECTURE.md` / `CLAUDE.md` headers. |

If any gate fails for any proposal, **drop that proposal** from the change-set and report the failure. Continue with the rest.

---

## Phase 5 — Apply Changes

**Goal**: Execute approved, gated changes. One file at a time. Atomic.

### 5.1 Write Order

1. Apply all `NEW_*` changes first (purely additive).
2. Then `UPDATE_*` changes.
3. Then `DELETE` changes.
4. Then `UPDATE_DOC` changes (so docs reflect the final state).

### 5.2 Per-Change Protocol

For each change:

- Print: `Writing <type>: <path>`
- Use the file-writing tool of the environment.
- After the write, print a 1-line confirmation: `OK: <path> (<lines added>/<lines removed>)`.
- On error, print: `FAIL: <path> — <error>`. Do NOT abort the whole run; continue with remaining changes.

### 5.3 Idempotent Writes

If a file already exists and the proposed content is byte-identical → skip with `SKIP (idempotent): <path>`.

### 5.4 Post-Write Summary

After all writes, print:

```
=== Apply Summary ===
Created: <count>   <list of paths>
Updated: <count>   <list of paths>
Deleted: <count>   <list of paths>
Skipped: <count>   <list of paths>
Failed:  <count>   <list of paths + reason>
```

### 5.5 Print Rollback Recipe

Print (do NOT execute) a copy-pasteable recovery snippet:

```
# To undo this run (requires git):
git restore -- <list of all touched paths>
# To undo deletions:
git checkout HEAD -- <list of deleted paths>
```

---

## Phase 6 — Verification

**Goal**: Confirm the run improved the project without introducing new drift.

### 6.1 Spot-Check Re-Scan

Re-run a fast subset of Phase 1 checks:

- Stale-reference scan against the rule files just written/updated (no dead refs introduced).
- Naming consistency for new files (matches dominant style).
- Capability detection (any new files appear in the inventory).

### 6.2 Final Report

Print:

```
=== Improvement Report ===
Findings before: N
Proposals generated: M
Proposals applied: K
Proposals deferred to next run: M - K
New rules: <count>
Updated rules: <count>
New skills: <count>
Updated skills: <count>
New agents: <count>
Updated agents: <count>
Doc updates: <count>
Deletions: <count>

Re-scan: <PASS/FAIL>
Net effect: AI config is now <X>% closer to codebase reality.
```

Then exit.

---

# Appendix A — Embedded Templates

Use these templates verbatim when generating new files. Substitute placeholders in `<ANGLE_BRACKETS>`.

---

## A.1 Rule Template

Use this when emitting `NEW_RULE`. File path: `.claude/rules/<kebab-name>.md`.

````markdown
# <Title> - <Strict Rule | Best Practice Guide>

## <MANDATORY REQUIREMENT | RECOMMENDED APPROACH>

<One paragraph stating the rule clearly and unambiguously. Use "MUST", "SHOULD", "MAY" per RFC 2119 conventions if "Strict Rule"; use "should" / "prefer" if "Best Practice Guide".>

## Why This Rule Exists

- <Reason 1: concrete consequence of not following it, ideally tied to a real incident or code smell>
- <Reason 2: scaling/consistency benefit>
- <Reason 3: alignment with broader project conventions>

## Architecture / Scope

<Optional: a small diagram or scope statement clarifying where this rule applies. Use ASCII boxes or a fenced code block if helpful.>

```
Caller
   |
   v
<Affected boundary>
   |
   v
Result
```

## Forbidden vs Required

| Pattern | Why It's Banned | Use Instead |
|---|---|---|
| `<bad pattern 1>` | <reason> | `<good pattern 1>` |
| `<bad pattern 2>` | <reason> | `<good pattern 2>` |
| `<bad pattern 3>` | <reason> | `<good pattern 3>` |

### FORBIDDEN

```<lang>
// WRONG — <one-line reason>
<bad code example>
```

### REQUIRED

```<lang>
// CORRECT — <one-line reason>
<good code example>
```

## Concrete Examples In This Repo

- `<path/to/file1.ext>:<line>` — <how it follows the rule, or how it currently violates it>
- `<path/to/file2.ext>:<line>` — <example>
- `<path/to/file3.ext>:<line>` — <example>

## Validation Checklist

Before completing work in this area:

- [ ] <Specific check 1, ideally a grep recipe or a CLI command>
- [ ] <Specific check 2>
- [ ] <Specific check 3>

## File Location Reference

| Layer | Location |
|---|---|
| <Subsystem A> | `<path>` |
| <Subsystem B> | `<path>` |

## Related Rules

- `<other-rule.md>` — <one-line relationship>
````

**Authoring guidance for rules:**

- Title is a noun phrase (the topic), not a sentence.
- Choose `Strict Rule` for hard requirements (security, naming, infrastructure invariants); `Best Practice Guide` for advisory guidance.
- The "Why" section makes future maintainers willing to keep the rule. Skipping it leads to deletion later.
- `FORBIDDEN`/`REQUIRED` blocks are non-negotiable. Without contrasting examples, AI agents cannot internalize the rule.
- Every rule needs ≥ 3 cited code examples. Rules without examples become aspirational and ignored.

---

## A.2 Skill Template

Use this when emitting `NEW_SKILL`. Directory: `.claude/skills/<kebab-name>/`. Main file: `SKILL.md`.

````markdown
---
name: <kebab-name>
description: When the user wants to <specific concrete action>. Also use when the user mentions <trigger phrases>. Triggers on <code domain markers like file types, imports, env vars>.
---

# <Skill Title>

<2–3 sentences describing what this skill produces and when it earns its keep. Make the trigger falsifiable: "use this skill when X is in the request" — never "use this skill when working on the project".>

## When To Use This Skill

- The user asks "<example phrasing 1>"
- The user asks "<example phrasing 2>"
- The conversation involves files matching `<glob>` or imports from `<package>`
- A specific recurring multi-step workflow is needed (≥ 3 distinct steps that benefit from sequencing)

## When NOT To Use This Skill

- <Anti-trigger 1: a closely related but distinct case>
- <Anti-trigger 2>

## Process

### Step 1 — <Action>

<Description. Reference any required input. State the output of this step.>

```<lang>
<Code template or command>
```

### Step 2 — <Action>

<Description.>

### Step 3 — <Action>

<Description.>

### Step 4 — Verify

<How to confirm the skill produced the right output. Always include a verification step.>

## Bundled Resources

<Only include this section if you create them. Otherwise omit.>

- `references/<topic>.md` — <what's in it>
- `scripts/<helper>.sh` — <what it does>
- `assets/<file>` — <what it is>

## Examples

### Example 1 — <Scenario>

Input: `<user request>`
Output:
```
<expected output, abbreviated>
```

### Example 2 — <Scenario>

<...>
````

**Authoring guidance for skills:**

- The `description:` is the *trigger*. AI loaders read it to decide whether to surface this skill. Make it specific. Bad: "Helps with backend work." Good: "When the user wants to add a new tRPC procedure with input validation and React Query hook."
- A skill should encapsulate a **multi-step procedure**. Single-step tasks belong in rules, not skills.
- Always include a verification step. Skills without verification produce confident but wrong outputs.
- Keep `SKILL.md` under ~300 lines. Push deep references into `references/` files. Use progressive disclosure.

---

## A.3 Claude Agent Template

Use this when emitting `NEW_AGENT` and `.claude/agents/` exists. File: `.claude/agents/<kebab-name>.md`.

````markdown
---
name: <kebab-name>
type: <developer | specialist | reviewer | auditor | coordinator>
color: "#<HEX>"
description: <One sentence: "Expert in X who Y for Z scenarios.">
capabilities:
  - <capability_1_in_snake_case>
  - <capability_2_in_snake_case>
  - <capability_3_in_snake_case>
priority: <high | medium | low>
hooks:
  pre: |
    echo "Starting <agent name> for task: $TASK"
    # any setup commands
  post: |
    echo "Completed <agent name>"
    # any cleanup or validation commands
---

# <Agent Title>

<2–3 paragraph mission statement. Establish: who this agent is, what unique perspective it brings, what it refuses to do.>

## Core Responsibilities

1. **<Responsibility 1>** — <one sentence>
2. **<Responsibility 2>** — <one sentence>
3. **<Responsibility 3>** — <one sentence>
4. **<Responsibility 4>** — <one sentence>
5. **<Responsibility 5>** — <one sentence>

## Out Of Scope

- <Thing this agent does NOT do, with a pointer to what does>
- <Another out-of-scope item>

## Implementation Guidelines

### <Guideline category 1, e.g. "Code Quality Standards">

<Concrete rules. Code examples where useful.>

```<lang>
<Example showing the agent's expected output style>
```

### <Guideline category 2>

<Concrete rules.>

### <Guideline category 3>

<Concrete rules.>

## Workflow

1. **Discover** — <what to read first>
2. **Plan** — <how to structure the work>
3. **Execute** — <implementation pattern>
4. **Verify** — <verification approach>
5. **Report** — <output format>

## Design Patterns To Apply

- <Pattern 1 with one-line description>
- <Pattern 2>
- <Pattern 3>

## Failure Modes To Avoid

- <Anti-pattern 1: what goes wrong if this agent overreaches>
- <Anti-pattern 2>

## Output Format

<Describe the expected response shape: prose vs table vs code, length target, required sections.>
````

**Authoring guidance for Claude agents:**

- Length target: 500–2000 words. Less, and the agent has no personality. More, and it becomes a treatise.
- `capabilities` is semantic metadata for routing — make them specific (`tdd_unit_testing` not `testing`).
- `hooks.pre` / `hooks.post` are bash strings — keep them safe and idempotent. They run on every invocation.
- Define **out-of-scope** explicitly. The single biggest quality lever for agents is what they refuse to do.

---

## A.4 OpenCode Agent Template

Use this when emitting `NEW_AGENT` and `.opencode/agent/` exists. File: `.opencode/agent/<kebab-name>.md`.

````markdown
---
mode: subagent
description: <One sentence: when to use this agent.>
model: <provider>/<model-id>
temperature: <0.0–1.0>
tools:
  read: true
  write: <true | false>
  edit: <true | false>
  bash: <true | false>
  glob: true
  grep: true
permission:
  bash: <allow | ask | deny>
  edit: <allow | ask | deny>
  write: <allow | ask | deny>
---

# <Agent Title>

<Short mission paragraph (3–5 sentences).>

## Responsibilities

- <Item 1>
- <Item 2>
- <Item 3>

## Workflow

1. <Step 1>
2. <Step 2>
3. <Step 3>

## Output Conventions

<Brief: response shape, voice, what to include/exclude.>

## Example Invocation

> User: "<example user request>"
>
> Agent response:
> <abbreviated example response showing voice and structure>
````

**Authoring guidance for OpenCode agents:**

- Use `temperature: 0.0–0.3` for deterministic tasks (refactoring, validation), `0.5–0.7` for design tasks, `0.8+` only for brainstorming.
- The `tools:` map gates capability — give the minimum needed. A read-only auditor needs `read: true, glob: true, grep: true` and nothing else.
- `permission: bash: ask` is a safe default for agents that may need to run commands; use `deny` for pure-analysis agents.
- Keep the body concise (under 500 words). OpenCode prefers tight, single-purpose agents.

---

## A.5 ARCHITECTURE.md Template

Use this when emitting `UPDATE_DOC` for ARCHITECTURE.md, or when creating it from scratch. File: `ARCHITECTURE.md` at repo root.

````markdown
# <PROJECT_NAME> Architecture

> Last updated: <YYYY-MM-DD>
> Maintained per the `architecture-doc-maintenance` rule (or equivalent).

## 1. High-Level Overview

<2–4 sentences explaining what this project is and its top-level shape.>

```
<ASCII diagram of the system if helpful>
```

| Component | Production endpoint | Purpose |
|---|---|---|
| <component 1> | <url or "internal"> | <one-line> |

## 2. Repository Structure

```
<repo-root>/
├── <dir1>/        <one-line>
├── <dir2>/        <one-line>
└── <dir3>/        <one-line>
```

## 3. Frontend (`<dir>/`)

- **Framework**: <name + version>
- **Routing**: <approach>
- **State management**: <library>
- **Styling**: <approach>
- **Build**: <tool>

Key directories:
| Path | Purpose |
|---|---|
| `<dir>/components/` | <what lives here> |
| `<dir>/routes/` | <what lives here> |

## 4. Backend (`<dir>/`)

- **Framework**: <name>
- **Language**: <name>
- **API style**: <REST / tRPC / GraphQL / gRPC>
- **Auth**: <library or scheme>

Key subsystems:
| Subsystem | Path | Approximate count |
|---|---|---|
| Routers | `<path>` | ~<N> |
| Schema files | `<path>` | ~<N> |
| Services | `<path>` | ~<N> |

## 5. Data Layer

- **Primary store**: <DB + version>
- **ORM / query builder**: <library>
- **Migrations**: <approach>
- **Caching**: <if any>

Tables: ~<N>. See `<path/to/schema/>`.

## 6. Infrastructure

| Service | Purpose | Profile / Environment |
|---|---|---|
| <service 1> | <what> | <when started> |

Container conventions:
- Naming prefix: `<prefix>`
- Network: `<network-name>`

## 7. Documentation

<Where docs live, who they're for, the difference between user docs and dev docs.>

## 8. AI Tooling (`.claude/` and/or `.opencode/`)

| Surface | Count | Purpose |
|---|---|---|
| Rules | <N> | Project-wide invariants |
| Skills | <N> | Multi-step workflows |
| Agents | <N> | Specialized roles |

See `<CLAUDE.md or AGENTS.md>` for the index.

## 9. Cross-Cutting Concerns

- **Authentication**: <approach>
- **Authorization**: <approach>
- **Internationalization**: <approach + supported languages>
- **Accessibility**: <standards followed>
- **Logging**: <library + destination>
- **Error tracking**: <if any>
- **Feature flags**: <if any>

## 10. Development Workflow

| Task | Command |
|---|---|
| Install | `<cmd>` |
| Start dev | `<cmd>` |
| Test | `<cmd>` |
| Lint | `<cmd>` |
| Build | `<cmd>` |

## 11. Production / Deployment

<How code reaches prod. CI/CD overview. Rollback procedure.>

## 12. Keeping This Document Updated

This document MUST be updated when:

- A new top-level directory is added
- A new service is added to docker-compose / kubernetes
- A new schema table or major API surface is added
- A new third-party integration is added
- The auth or i18n approach changes
- A new language is added to the stack

This document does NOT need updates for:

- Bug fixes
- Single-component additions inside an existing subsystem
- Dependency version bumps
- Translation additions
````

**Authoring guidance for ARCHITECTURE.md:**

- Keep section counts approximate (~N). Exact counts go stale instantly.
- Use the same section ordering across runs — readers learn the structure.
- The "Keeping This Document Updated" section is non-negotiable. Without it, drift returns immediately.

---

## A.6 CLAUDE.md / AGENTS.md Preamble Template

Use this when emitting `UPDATE_DOC` for `CLAUDE.md` or `AGENTS.md`, or creating from scratch.

````markdown
# <PROJECT_NAME> — AI Configuration Guide

> The first thing AI agents read in this repo. Keep it under 300 lines.

## Project Identity

- **Name**: <PROJECT_NAME>
- **Type**: <SaaS app | CLI tool | library | service | static site | …>
- **Primary language**: <language>
- **Stack**: <key technologies, comma-separated>

## Critical Conventions

These are absolute. Violating them breaks the project's core invariants.

| # | Convention | Where enforced |
|---|---|---|
| 1 | <e.g. "All code runs in containers"> | `<.claude/rules/container-only.md>` |
| 2 | <e.g. "Single source of truth for env vars"> | `<.claude/rules/env-vars.md>` |
| 3 | <e.g. "Never commit secrets"> | <pre-commit hook + rule> |

## Quick Command Reference

| Task | Command |
|---|---|
| Start dev | `<cmd>` |
| Run tests | `<cmd>` |
| Lint | `<cmd>` |
| Type check | `<cmd>` |
| Build | `<cmd>` |

## Rules Index

Rules live in `.claude/rules/`. They define what MUST be true in this codebase.

| Topic | File | Type |
|---|---|---|
| <topic 1> | `<file.md>` | Strict Rule |
| <topic 2> | `<file.md>` | Best Practice |

## Skills Index

Skills live in `.claude/skills/`. They encapsulate reusable multi-step workflows.

| Skill | Trigger |
|---|---|
| `<skill-1>` | When the user wants to <action> |
| `<skill-2>` | When the user wants to <action> |

## Agents Index

Agents live in `.claude/agents/` (and/or `.opencode/agent/`). They are specialized personas with scoped tooling.

| Agent | Specialty |
|---|---|
| `<agent-1>` | <one-line> |
| `<agent-2>` | <one-line> |

## File Organization

| Allowed in repo root | Everything else |
|---|---|
| `README.md`, `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md` | Goes in subdirectories |
| `package.json`, lockfile, config files at root only when required by tooling | |

## Concurrent Execution Pattern

When multiple operations are independent, batch them in one message (parallel tool calls). When they have dependencies, sequence them. Never serialize independent work.

## Important Reminders

- **NEVER** create files unless necessary
- **ALWAYS** prefer editing existing files
- **NEVER** create documentation files unless explicitly requested
- **ALWAYS** use the rules index above when in doubt about conventions
````

**Authoring guidance for CLAUDE.md / AGENTS.md:**

- This file is loaded into every AI session. Brevity is paramount. Aim for ≤ 300 lines.
- The Rules / Skills / Agents indexes are the most-used parts. Keep them current.
- Avoid duplicating rule content here — link to the rule files.
- Critical conventions go at the top because they shape every later decision.

---

# Appendix B — Heuristics Catalog

These are the concrete grep/glob recipes the prompt uses in Phase 1. They are intentionally written so any standard Unix-like environment can run them.

## B.1 Repeated-Import Heuristic (TypeScript / JavaScript)

**Goal**: find imports used 3+ times that aren't documented.

```
# Conceptual recipe — adapt to your search tool:
# 1. Find all import statements
grep -rE "^(import|from) " --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" .
# 2. Extract the from-target
# 3. Count distinct files per target
# 4. For top targets, search rule files for any mention
grep -lr "<target>" .claude/rules/ 2>/dev/null
# 5. If grep returns nothing AND count >= 3 → finding
```

## B.2 Repeated-Import Heuristic (Python)

```
grep -rE "^(import|from) " --include="*.py" .
# Extract module path, count files, cross-check against rules.
```

## B.3 Env-Var Heuristic

```
# TypeScript
grep -rhoE "process\.env\.[A-Z_][A-Z0-9_]+" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" . | sort -u
# Python
grep -rhoE "os\.getenv\(['\"]([A-Z_][A-Z0-9_]+)['\"]\)" --include="*.py" . | sort -u
grep -rhoE "os\.environ\[['\"]([A-Z_][A-Z0-9_]+)['\"]\]" --include="*.py" . | sort -u
# Documented
grep -hoE "^[A-Z_][A-Z0-9_]+=" .env.example 2>/dev/null | sed 's/=$//' | sort -u
# Then: code minus documented = undocumented
```

## B.4 Stale-File-Reference Heuristic

```
# Extract path-like strings from a rule file
grep -hoE "[a-zA-Z0-9_./-]+\.(ts|tsx|js|jsx|py|rs|go|rb|php|sol|md|yml|yaml|json)" .claude/rules/*.md | sort -u
# For each, check if it exists
test -e "<extracted-path>" || echo "DEAD: <extracted-path>"
```

## B.5 Repeated-Magic-Number Heuristic

```
# Find numeric literals appearing 3+ times in non-test code
grep -rhoE "\b[0-9]{4,}\b" --include="*.ts" --include="*.py" --exclude-dir=node_modules --exclude-dir=tests . | sort | uniq -c | sort -rn | head -20
# Numbers above some threshold appearing many times = candidates for config rule
```

## B.6 Docker Service Heuristic

```
# List services in compose
grep -E "^  [a-zA-Z]" docker-compose*.yml | awk '{print $1}' | tr -d ':'
# For each, check ARCHITECTURE.md
grep -l "<service-name>" ARCHITECTURE.md || echo "UNDOCUMENTED: <service-name>"
```

## B.7 Schema Count Heuristic

```
# Drizzle: count schema files
find . -path "*/schema/*.ts" -not -path "*/node_modules/*" | wc -l
# Prisma: count models
grep -c "^model " prisma/schema.prisma 2>/dev/null
# SQLAlchemy: classes inheriting Base
grep -rE "class \w+\(.*Base.*\):" --include="*.py" . | wc -l
```

## B.8 TODO/FIXME Density Heuristic

```
# Per top-level subdir
for dir in */; do
  count=$(grep -rE "(TODO|FIXME|XXX|HACK)" --include="*.ts" --include="*.py" --include="*.go" "$dir" 2>/dev/null | wc -l)
  echo "$count $dir"
done | sort -rn
# Top dirs may warrant a follow-up rule or skill
```

## B.9 Inconsistency Heuristic (mixed HTTP clients)

```
# TypeScript
fetch_count=$(grep -rl "fetch(" --include="*.ts" --include="*.tsx" . | wc -l)
axios_count=$(grep -rl "from ['\"]axios['\"]" --include="*.ts" --include="*.tsx" . | wc -l)
# If both > 5 → finding: pick one
```

## B.10 Orphan-Skill Heuristic

```
# For each skill, check if it's mentioned in CLAUDE.md / AGENTS.md
for skill in .claude/skills/*/; do
  name=$(basename "$skill")
  if ! grep -q "$name" CLAUDE.md AGENTS.md 2>/dev/null; then
    echo "ORPHAN: $name"
  fi
done
```

---

# Appendix C — Anti-Patterns

Things the prompt **must never auto-generate**, even if asked or tempted.

| Anti-pattern | Why to avoid | What to do instead |
|---|---|---|
| **Speculative rules** — "in case the project ever uses X" | Pollutes the rule index with irrelevant content | Only emit a rule when ≥ 3 code examples exist NOW |
| **Vendor-specific skills without imports** — e.g. a "Stripe webhook" skill in a project that doesn't use Stripe | The skill will never trigger and confuses agent routing | Detect the imports first, then propose |
| **Duplicate agents** — a new agent overlapping > 70% with an existing one | Splits responsibility and confuses routing | Downgrade to `UPDATE_AGENT` of the closest existing agent |
| **Contradictory rules** — a new rule that contradicts an existing one | Creates whiplash for the AI, latest-wins behavior | Always propose `UPDATE_RULE` to the existing one instead |
| **Documentation for deprecated code** — rules covering files marked `@deprecated` | Encourages continued use of dead code | Propose `DELETE` on related rules; do not document deprecated paths |
| **Project-name leakage** — putting the project's literal name in a generic rule | Breaks portability if rules are reused across projects | Use `<PROJECT_NAME>` placeholder; project name lives only in `ARCHITECTURE.md` / `CLAUDE.md` headers |
| **Auto-deletion** | Loss of human-curated content | Always require `confirm-delete:<#>` from the user |
| **Mass renames** | Breaks every external reference at once | Out of scope. Propose at most 1 rename per run, and only with strong justification |
| **Rules that only list "FORBIDDEN" without "REQUIRED"** | Tells the AI what not to do but not what to do | Always pair every banned pattern with the preferred alternative |
| **Skills with vague triggers** — "Use when working on X" | Will trigger on everything or nothing | Trigger must name specific keywords, file patterns, or imports |
| **Agents without `Out Of Scope`** | Agents over-reach into adjacent specialties | Always define what the agent refuses to do |
| **ARCHITECTURE.md with exact counts** — "12 routers, 47 schema files" | Goes stale immediately after one PR | Use approximate counts ("~10 routers") |
| **Hook-heavy agents that run network calls** in `pre`/`post` | Slow, error-prone, hard to audit | Keep hooks to local commands only |
| **Translation-key rules generated from code** without checking the i18n catalog | Documents keys that may not exist in all locales | Verify locale catalogs before proposing i18n rules |
| **Re-emitting `CONTRIBUTING.md` as a rule** | The rule and the doc compete | Reference the existing doc; do not duplicate |
| **Emitting both Claude and OpenCode versions when only one is detected** | Pollutes the project with unused config | Emit format X only if directory X exists |

---

# Appendix D — Voice And Style Detection

When generating new content, match the project's existing voice. Detect it by sampling 3 existing rule files and 1 README.

| Signal | If detected | Match by |
|---|---|---|
| Tables in every section | "Table-heavy" voice | Use tables liberally in new content |
| Long prose paragraphs | "Prose" voice | Write paragraphs, not bullets |
| Emoji headers / decorations | "Casual" voice | Mirror their use |
| No emojis, formal headers | "Formal" voice | Avoid emojis |
| Frequent code blocks | "Show, don't tell" voice | Add code examples |
| Sparse code, more explanation | "Tell, then show" voice | Lead with prose, add code as evidence |
| "MUST" / "SHALL" wording | RFC 2119 voice | Use the same modal verbs |
| "should" / "prefer" wording | Advisory voice | Match the softer modality |

If detection is ambiguous, default to: **table-heavy, formal, RFC 2119 wording**.

---

# Appendix E — Run Modes

The prompt supports two implicit modes based on user input:

## E.1 Full Audit Mode (default)

The user invokes the prompt with no qualifier. Run all 7 phases.

## E.2 Targeted Mode

The user specifies a scope: "audit only the auth subsystem", "improve only the rules", "update ARCHITECTURE.md only".

In targeted mode:

- Phase 0 still detects everything (cheap and informative).
- Phase 1 restricts scans to the requested scope.
- Phase 2/3/4/5/6 only consider proposals matching the scope.
- The change cap may be relaxed proportionally (e.g. "rules only" can lift the cap to 15 since other change types are excluded).

If the targeted scope yields zero findings, print "No drift detected in <scope>." and exit.

---

# Appendix F — Example Walk-Through

A condensed example to make the workflow concrete. Substitute realistic content per project.

## Phase 0 Output (example)

```
=== Capability Inventory ===
Claude rules:    24 files
Claude skills:   11 directories
Claude agents:   8 files
OpenCode agents: 0 files          (skipped)
ARCHITECTURE.md: present, 412 lines
CLAUDE.md:       present, 287 lines
AGENTS.md:       absent
Project name:    <derived>
Stack:           TypeScript, Next.js, Postgres, Drizzle, Docker
```

## Phase 1 Output (example)

```
=== Findings ===
1  undocumented-pattern   src/auth/session.ts:12, +7 more   high     NEW_RULE: auth-patterns
2  stale-ref-in-rule      .claude/rules/db.md:34            high     UPDATE_RULE
3  arch-stat-stale        ARCHITECTURE.md:108               medium   UPDATE_DOC
4  env-var-undocumented   src/email/resend.ts:5             high     UPDATE_DOC (.env.example)
5  orphan-skill           .claude/skills/legacy-tool/       low      DELETE
6  undocumented-service   docker-compose.yml:24             medium   UPDATE_DOC
```

## Phase 3 Output (example)

```
=== Proposals ===
# Type         Target                                       Summary                                   Risk
1 NEW_RULE     .claude/rules/auth-patterns.md               Document session-handling conventions     low
2 UPDATE_RULE  .claude/rules/db.md                          Replace removed `legacy_users` references  medium
3 UPDATE_DOC   ARCHITECTURE.md                              Refresh schema count and add new service  medium
4 UPDATE_DOC   .env.example                                 Add RESEND_API_KEY                        low
5 DELETE       .claude/skills/legacy-tool/                  Tool removed from project last quarter    high

Awaiting confirmation. Reply `proceed` to apply all 5 changes,
`proceed: 1,2,3,4` to skip the delete, or `revise: <feedback>`.
```

## Phase 5 Output (example)

```
Writing NEW_RULE: .claude/rules/auth-patterns.md
OK: .claude/rules/auth-patterns.md (118/0)
Writing UPDATE_RULE: .claude/rules/db.md
OK: .claude/rules/db.md (12/8)
Writing UPDATE_DOC: ARCHITECTURE.md
OK: ARCHITECTURE.md (4/2)
Writing UPDATE_DOC: .env.example
OK: .env.example (1/0)
SKIP (delete not confirmed): .claude/skills/legacy-tool/

=== Apply Summary ===
Created: 1   .claude/rules/auth-patterns.md
Updated: 3   .claude/rules/db.md, ARCHITECTURE.md, .env.example
Deleted: 0
Skipped: 1   .claude/skills/legacy-tool/  (no confirm-delete)
Failed:  0

# To undo this run:
git restore -- .claude/rules/auth-patterns.md .claude/rules/db.md ARCHITECTURE.md .env.example
```

---

# Appendix G — Self-Test

Before exiting, verify this prompt itself is portable and effective.

The prompt is **valid** if:

- It contains zero project-specific names (no `<project>` literal anywhere outside `<PROJECT_NAME>` placeholders and `<TEMPLATE>` examples).
- All 7 phases are present and ordered.
- The 10-change cap is stated explicitly.
- The mandatory STOP gate between Phase 3 and Phase 4 is explicit.
- All 6 templates (Rule, Skill, Claude Agent, OpenCode Agent, ARCHITECTURE.md, CLAUDE.md) are embedded inline.
- Every grep recipe in Appendix B is syntactically valid in a POSIX shell.
- No external skill, agent, or document is referenced by name.
- No git command is required for any phase to complete.
- The prompt would produce a no-op `findings` table when run on an already-aligned repo.

If you are an AI executing this prompt and any of these conditions fail, report the failure and stop.

---

# End Of Prompt

When invoked, begin with **Phase 0**. Do not skip ahead. Do not write files until Phase 5. Do not exceed 10 changes per run. Do not delete without explicit confirmation.

The goal is not to be exhaustive. The goal is to make this project's AI configuration **measurably better** in one focused, reviewable, reversible pass.
