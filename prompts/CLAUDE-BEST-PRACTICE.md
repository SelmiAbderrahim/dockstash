# CLAUDE-BEST-PRACTICE

> A self-contained, project-agnostic prompt that audits any codebase against the
> Claude Code best-practice playbook (Boris Cherny + community, distilled from
> https://github.com/shanraisshan/claude-code-best-practice) and applies the
> recommended changes — tiered with confirmation gates, mirrored across every
> AI CLI it detects.
>
> Drop this file into any project and run it via `/run prompts/CLAUDE-BEST-PRACTICE.md`
> (Claude Code), `claude < prompts/CLAUDE-BEST-PRACTICE.md`, or paste it as a
> message. It works on Claude Code, OpenCode, Codex CLI, Gemini CLI, Cursor,
> Windsurf, Aider, and any other compatible agentic CLI.

---

## Mission

Audit the current repository against the Claude Code best-practice playbook,
produce a severity-ranked report, and (with explicit per-bucket approval) apply
the recommended changes to every AI CLI footprint detected in the project.

Outcomes you should produce, in order:

1. A **detection matrix** of which AI CLIs/tooling are present.
2. An **audit report** with one finding per file/concept, severity-tagged.
3. A **tiered apply plan** asking the user which buckets to execute.
4. The **applied changes** (additive, idempotent), each printed before write.
5. A **cross-CLI mirror** so every detected CLI sees the same canonical rules.
6. A **verification checklist** the user can run to confirm health.

You are NOT the user — do not fabricate consent. Every destructive change is
gated. Re-runs of this prompt MUST be safe.

---

## Operating Rules (read once, then enforce)

1. **Plan first.** Engage plan mode for non-trivial changes. Never write before
   you have shown what you intend to write.
2. **Working tree clean.** Before any write, run `git status --porcelain`. If it
   is non-empty, ask the user whether to proceed (their uncommitted work could
   collide).
3. **Never overwrite handcrafted files** without diff + explicit confirmation.
   Prefer additive: new files, appended sections clearly fenced with
   `<!-- BEGIN best-practice --> ... <!-- END best-practice -->` so a future
   re-run can update only the managed section.
4. **No destructive git ops.** Never `git stash`, `git reset --hard`,
   `git clean -fd`, `git push --force`, `git rebase`, `git commit --amend`, or
   `--no-verify`. If an obstacle suggests one, stop and ask.
5. **Idempotent.** Every write step must check existing state and either skip,
   patch, or upsert. Never duplicate sections.
6. **Project-agnostic.** Do not assume any framework, package manager, runtime,
   or directory layout beyond what detection confirms. Branch on lockfiles.
7. **Conservative when project already follows the practice; aggressive on a
   fresh project.** Calibrate verbosity to existing maturity.
8. **One bucket at a time.** When you reach the apply phase, ask per bucket and
   wait for "yes" before touching disk.
9. **Show diffs.** Before any modification of an existing file, print a unified
   diff in a code fence and require explicit "yes".
10. **Stop on signal.** If the user types "stop", "abort", "no", "cancel", or
    similar at any prompt, halt all changes and summarise what was done so far.

---

## Phase 1 — Detection Matrix

Run these checks *non-destructively* and emit a markdown table summarising what
is present. Use shell, glob, or your file tool — whatever your CLI provides.

### 1.1 Project type

| Lockfile / manifest               | Implies                       |
| --------------------------------- | ----------------------------- |
| `package.json`                    | Node / JS / TS                |
| `pnpm-lock.yaml` / `yarn.lock` / `package-lock.json` / `bun.lockb` | Node package manager |
| `pyproject.toml` / `requirements.txt` / `Pipfile` / `poetry.lock` | Python |
| `Cargo.toml`                      | Rust                          |
| `go.mod`                          | Go                            |
| `Gemfile`                         | Ruby                          |
| `composer.json`                   | PHP                           |
| `pom.xml` / `build.gradle*`       | JVM                           |
| `*.csproj` / `*.sln`              | .NET                          |
| `Dockerfile` / `docker-compose.*` | Containerised dev             |
| `Makefile` / `justfile` / `Taskfile.yml` | Task runner            |

Branch hook/format/test recommendations on what you find. If you find none of
these, treat as a docs/markdown-only repo and skip language-specific tooling.

### 1.2 AI CLI footprints

For each row below, check existence and report `present` / `absent` / `empty`.

| AI tool         | Footprint to look for                                                                 |
| --------------- | ------------------------------------------------------------------------------------- |
| Claude Code     | `CLAUDE.md`, `.claude/`, `.claude/agents/`, `.claude/commands/`, `.claude/skills/`, `.claude/hooks/`, `.claude/rules/`, `.claude/settings.json`, `.claude/settings.local.json`, `~/.claude/CLAUDE.md` |
| OpenCode        | `AGENTS.md`, `.opencode/`, `.opencode.json`, `opencode.json`                          |
| Codex CLI       | `AGENTS.md` (shared with OpenCode), `.codex/`, `~/.codex/`                            |
| Gemini CLI      | `GEMINI.md`, `.gemini/`, `~/.gemini/`                                                 |
| Cursor          | `.cursorrules`, `.cursor/rules/`, `.cursor/mcp.json`                                  |
| Windsurf        | `.windsurfrules`, `.windsurf/`                                                        |
| Aider           | `.aider.conf.yml`, `.aiderignore`, `.aider.tags.cache.v3/`                            |
| Continue.dev    | `.continue/config.json`, `.continue/config.yaml`                                      |
| GitHub Copilot  | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`           |
| Spec Kit        | `.specify/`, `.specify/memory/constitution.md`                                        |
| MCP             | `.mcp.json`, `~/.config/Claude/claude_desktop_config.json`, `mcp` keys in `settings.json` |
| Plugin marketplaces | `.claude/marketplaces/`, `~/.claude/plugins/`                                     |
| Hooks (non-Claude) | `lefthook.yml`, `.husky/`, `.pre-commit-config.yaml`, `.git/hooks/*` (non-default) |
| Devcontainer    | `.devcontainer/devcontainer.json`                                                     |

For empty stub files (`.cursorrules` of size 0, `GEMINI.md` of size 0, etc.),
report `empty` — these are placeholders and should be filled, not skipped.

### 1.3 Git & branch hygiene

```bash
git rev-parse --is-inside-work-tree     # confirm we are in a repo
git status --porcelain                  # working tree clean check
git branch --show-current               # for PR-flow recommendations
git log --oneline -5                    # commit cadence sanity check
```

### 1.4 Output

Render Phase 1 as a single markdown report:

```
## Detection

- Project type: <list>
- AI CLIs detected: <Claude Code · OpenCode · …>
- AI CLIs absent:   <Gemini CLI · Cursor · …>
- AI CLIs empty:    <list of stub files>
- Git: <branch>, <clean|dirty>, <N commits behind/ahead>
```

Stop here if `git status` is dirty and the user has not said "proceed anyway".

---

## Phase 2 — Audit

For each *present* AI CLI, run the audit below. Skip silently for absent CLIs.
For each *empty* CLI footprint, queue a "scaffold" recommendation in Phase 3.

### 2.1 Claude Code audit (when `.claude/` or `CLAUDE.md` is present)

Check each item; emit one finding per item with severity:

- ✅ already good
- ⚠ minor / nice-to-have
- 🔴 missing / should add
- 🛑 anti-pattern / should fix

| Concept                | Check                                                                                                        | Source tip |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | ---------- |
| `CLAUDE.md` size       | `wc -l CLAUDE.md` ≤ 200 lines (Boris). Report each `**/CLAUDE.md` separately                                  | Boris      |
| `.claude/rules/`       | Exists? Each rule has `paths:` frontmatter for lazy-load? `wc -l` per rule ≤ 200                              | Claude     |
| Monorepo CLAUDE.md     | If multiple language/app subtrees exist, recommend ancestor + descendant CLAUDE.md split                      | Boris      |
| `<important if="...">` | Domain-critical instructions tagged so they are not lost as the file grows                                    | Dex        |
| Subagents (`.claude/agents/*.md`) | Has at least one feature-specific agent (vs only generic ones)? Personas defined?                  | Boris      |
| Commands (`.claude/commands/*.md`) | Slash commands exist for at least the user's repeated daily/hourly workflows?                     | Boris      |
| Skills (`.claude/skills/<name>/SKILL.md`) | Folder layout (`SKILL.md` + optional `references/`, `scripts/`, `examples/`)? Description reads as a trigger, not a summary? Has a Gotchas section? | Thariq |
| Hooks (`.claude/hooks/`) | At least: PostToolUse (auto-format), Stop (verifier nudge)? Permission-routing hook for safe auto-approval?  | Boris      |
| `settings.json`        | Permissions use wildcards (`Bash(npm run *)`, `Edit(/docs/**)`)? Sandbox enabled? Status line set? Output style set? Spinner verbs customised? Attribution config present (no auto Co-Authored-By if undesired)? | Boris · Cat · davila7 |
| `.mcp.json`            | Shared (`.mcp.json` checked in) vs local (`.claude/settings.local.json`) split is intentional?                | Claude     |
| Tasks                  | If long-running work is common, has user adopted `/tasks` for multi-session tracking?                         | Boris      |
| Worktrees              | Long-lived parallel work happens? Recommend `EnterWorktree` / `isolation: "worktree"` frontmatter on subagents | Boris    |
| `/loop` / `/schedule`  | If the user has any "every N minutes/hours" task, has a schedule been set up?                                 | Boris      |
| Status line            | Custom status line for context-percent + cost + model awareness                                               | Boris · Shayan |
| Plan mode default      | Does the user always launch in plan mode? Recommend `/config` flag                                            | Boris      |
| Voice dictation        | If the user prompts a lot, suggest `/voice` or external dictation                                             | Boris      |
| Update cadence         | Is `claude --version` recent? Recommend daily `claude update` and `/changelog` reading                        | Shayan     |

### 2.2 OpenCode / Codex audit (when `AGENTS.md` is present)

`AGENTS.md` is the canonical instructions file for OpenCode and the Codex CLI.
It plays the same role as `CLAUDE.md` for Claude Code.

Check:

- Size ≤ 200 lines (same rationale as `CLAUDE.md`)
- Has a "Tools / Commands" section so the agent can run tests on first try
- Mentions the project's Makefile / task runner / Docker / package manager
- Lists destructive ops to refuse (mirrors Claude's git-destructive rules)
- If both `CLAUDE.md` and `AGENTS.md` exist, check for content drift

### 2.3 Gemini CLI audit (when `GEMINI.md` is present)

- File non-empty (often it ships as a 0-byte stub)
- Same "Tools / Commands" section
- Same destructive-ops refusal section

### 2.4 Cursor audit (when `.cursorrules` or `.cursor/rules/` is present)

- File non-empty
- Mirrors the canonical rules from `CLAUDE.md` (or `AGENTS.md`)
- For multi-rule layout (`.cursor/rules/*.mdc`), each rule has `description` and
  `globs` frontmatter

### 2.5 Windsurf audit (when `.windsurfrules` is present)

- File non-empty
- Mirrors the canonical rules
- Honors the 6 KB limit by linking out to `.claude/rules/*.md` rather than
  inlining everything

### 2.6 Aider audit (when `.aider.conf.yml` is present)

- `auto-commits: false` (so Aider does not commit silently)
- `read:` includes the canonical instructions file so Aider has context
- `gitignore` covers `.aider.tags.cache.v3/`

### 2.7 Continue.dev audit (when `.continue/` is present)

- `config.yaml` over `config.json` (yaml is the modern path)
- `rules:` block points to the canonical instructions file

### 2.8 GitHub Copilot audit (when `.github/copilot-instructions.md` is present)

- Non-empty
- Mirrors canonical rules
- Sub-rules in `.github/instructions/*.instructions.md` use `applyTo:`
  frontmatter for path-scoped instructions

### 2.9 Spec Kit audit (when `.specify/` is present)

- `constitution.md` exists and is current
- `/speckit.*` slash commands available in Claude Code

### 2.10 MCP audit (when `.mcp.json` is present)

- File parses as valid JSON
- Each server has `command` (or `url`) + `args` + optional `env`
- Sensitive values use env-var substitution, not inline literals
- Tool count is reasonable for the model's tool budget

### 2.11 Hooks audit (Claude Code hooks)

| Hook event   | Recommended baseline                                                              |
| ------------ | --------------------------------------------------------------------------------- |
| `PostToolUse` (Edit/Write) | Auto-formatter (`prettier`/`ruff format`/`gofmt`/`cargo fmt`/etc.) wrapped to no-op when no formatter is installed |
| `Stop`       | Optional "verify your work" nudge (e.g. "did you run the tests?")                  |
| `PreToolUse` (Bash) | Optional permission router: scan command for destructive patterns and block / require confirm |
| `SessionStart` | Print a 3-line orientation: branch, last commit, dirty file count                |

For non-Claude CLIs that have hooks (Cursor, Windsurf, Codex), suggest
analogous wiring; otherwise rely on git hooks via `lefthook` / `husky` /
`pre-commit`.

### 2.12 Cross-CLI rule drift

If two or more of `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `.cursorrules`,
`.windsurfrules`, `.github/copilot-instructions.md` exist, run a quick diff to
flag content drift (e.g. CLAUDE.md says "use pnpm" but AGENTS.md says "use npm").
List drift items in the report.

---

## Phase 3 — Recommendation Report

Render a single markdown report grouped by CLI, then a "cross-cutting" section.
Keep each finding to 1-2 lines plus a one-line "why" citing the playbook tip.

Format:

```
### Claude Code

| Severity | File / Concept | Finding | Why (source) |
| --- | --- | --- | --- |
| 🔴 | `CLAUDE.md` (412 lines) | Exceeds 200-line target; split into ancestor + `.claude/rules/*.md` lazy-loaded by glob | Boris (≤200 lines per file) |
| ⚠ | `.claude/agents/` | Only generic `qa.md` and `backend.md`; consider feature-specific personas | Boris (feature-specific subagents > generic) |
| ✅ | `.claude/settings.json` | Permissions already use wildcards | — |
…

### OpenCode

…

### Cross-CLI

| Severity | Item | Detail |
| --- | --- | --- |
| 🛑 | Drift | `CLAUDE.md` says "pnpm", `AGENTS.md` says "npm" |
…
```

End the report with a single-sentence summary and the question:

> "Apply changes? Reply with bucket letters (e.g. `a c f`) or `all` or `none`."

Wait for input. Do not start writing.

---

## Phase 4 — Apply (tiered, gated, idempotent)

The user picks any subset of the buckets below. For each bucket:

1. List every file you will create or modify, with a one-line purpose.
2. For modifications of existing files, print a unified diff.
3. Ask "proceed with bucket X?" and require a yes per bucket.
4. Apply, then summarise what changed.

### Bucket (a) — Memory hygiene

**Goal.** Bring `CLAUDE.md` (and equivalents) under 200 lines, lazy-load
domain-specific rules via `.claude/rules/*.md` with `paths:` frontmatter, and
add `<important if="...">` tags to high-stakes invariants.

Operations:

- Split overflow content out of `CLAUDE.md` into `.claude/rules/<topic>.md`
  with frontmatter:

  ```yaml
  ---
  description: Short trigger sentence the model uses to decide whether to load this rule.
  paths:
    - "src/**"
    - "**/*.ts"
  ---
  ```

- Add a `<!-- BEGIN best-practice --> ... <!-- END best-practice -->` fenced
  managed section at the bottom of `CLAUDE.md` containing a pointer index to
  the lazy-loaded rules.
- For every `**/CLAUDE.md` found in monorepo subtrees, repeat.

### Bucket (b) — Settings & permissions

Patch `.claude/settings.json` (preserving existing keys; never clobber). Use
`settings.local.json` for personal-only settings.

Baseline (merge, do not replace):

```jsonc
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "claude-opus-4-7",
  "outputStyle": "explanatory",
  "thinking": true,
  "statusLine": "auto",
  "permissions": {
    "allow": [
      "Read(**)",
      "Glob(**)",
      "Grep(**)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)"
    ],
    "deny": [
      "Bash(git stash:*)",
      "Bash(git reset --hard:*)",
      "Bash(git clean -f*:*)",
      "Bash(git checkout -- *)",
      "Bash(git restore *)",
      "Bash(git rebase:*)",
      "Bash(git commit --amend:*)",
      "Bash(git push --force:*)",
      "Bash(git push -f:*)",
      "Bash(git push --force-with-lease:*)",
      "Bash(git push --delete:*)",
      "Bash(git branch -D:*)",
      "Bash(git filter-branch:*)",
      "Bash(--no-verify:*)",
      "Bash(--no-gpg-sign:*)"
    ]
  },
  "sandbox": {
    "enabled": true,
    "filesystem": "project",
    "network": "deny-by-default"
  },
  "attribution": {
    "commit": ""
  }
}
```

Notes:

- Detect existing `model` value; do not downgrade.
- If the project's `package.json` exposes `lint`, `test`, `typecheck`, add
  `Bash(npm run lint:*)`, `Bash(npm run test:*)`, etc. (substitute the right
  package manager).
- If sandbox is already configured, leave it alone.

### Bucket (c) — Workflow scaffolding

Create only when missing (skip silently otherwise):

- `.claude/agents/_template.md` — persona template
- `.claude/commands/_template.md` — slash command template
- `.claude/skills/_template/SKILL.md` — skill folder template
- `.claude/commands/plan.md` — explicit plan-first command
- `.claude/commands/code-review.md` — multi-agent PR review trigger
- `.claude/commands/simplify.md` — refactor for reuse / DRY pass
- `.claude/commands/go.md` — end-to-end verify (build → test → simplify → PR)

Each template uses the canonical layout shown in **Appendix B**.

### Bucket (d) — Cross-CLI mirror

For every detected non-Claude CLI, generate or update its instructions file
from the canonical Claude Code memory. The canonical source is whichever of
these is largest and most recent: `CLAUDE.md` > `AGENTS.md` > `GEMINI.md`.

For each target file, write within a clearly fenced managed section so a future
re-run only updates the managed section:

```
<!-- BEGIN claude-code-best-practice (managed; do not edit by hand) -->
…canonical rules excerpt + footer naming the source file and timestamp…
<!-- END claude-code-best-practice -->
```

Targets and any per-CLI accommodations:

- `AGENTS.md` (OpenCode / Codex) — mirror in full; respect their format.
- `GEMINI.md` — mirror in full; trim Claude-specific UI mentions.
- `.cursorrules` — mirror condensed (Cursor truncates around 6 KB);
  link to `.claude/rules/*.md` for the rest.
- `.cursor/rules/<topic>.mdc` — if the directory layout exists, generate one
  `.mdc` per topic with `description:` and `globs:` frontmatter.
- `.windsurfrules` — same as `.cursorrules`.
- `.github/copilot-instructions.md` — mirror the canonical rules, formatted in
  short imperative bullets (Copilot's preferred shape).
- `.aider.conf.yml` — set `read: [ "CLAUDE.md", ".claude/rules/" ]` and
  `auto-commits: false`.
- `.continue/config.yaml` — `rules:` block referencing the canonical file.

If any target file is currently empty / 0-byte, fill it. If non-empty and
unmanaged, prepend the managed section above the existing content and warn the
user to reconcile.

### Bucket (e) — MCP scaffolding

If no `.mcp.json` exists, create one with a minimal stub:

```jsonc
{
  "$schema": "https://json.schemastore.org/mcp.json",
  "mcpServers": {
    // Example (commented):
    // "github": {
    //   "command": "npx",
    //   "args": ["-y", "@modelcontextprotocol/server-github"],
    //   "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" }
    // }
  }
}
```

If `.mcp.json` exists, validate JSON, list servers, and warn on any inline
secrets (recommend env-var substitution).

### Bucket (f) — Hook bundle

Create only when missing:

- `.claude/hooks/post-tool-use-format.sh` — auto-formatter dispatch (probes for
  `prettier`, `ruff format`, `gofmt`, `cargo fmt`, `dotnet format`; no-op when
  none are installed).
- `.claude/hooks/stop-verifier.sh` — print a one-line nudge: "Did you run
  tests / typecheck / lint?".
- `.claude/hooks/pre-tool-use-careful.sh` — when the in-session `/careful` flag
  is set (file marker), block `rm -rf`, `git push --force`, etc.
- `.claude/hooks/session-start-orient.sh` — print branch, last commit, dirty
  file count.

Wire them in `.claude/settings.json` under the `hooks` key. All hooks must be
chmod +x and idempotent (no state writes outside `.claude/`).

For non-Claude CLIs without hooks, fall back to `lefthook.yml` or
`.pre-commit-config.yaml` for the format step.

---

## Phase 5 — Cross-CLI Mirror (canonical → derivatives)

Run after Bucket (d) is applied (or as part of it). Source of truth selection:

1. If `CLAUDE.md` is present and ≥ 50 lines, it is canonical.
2. Else if `AGENTS.md` is present and ≥ 50 lines, it is canonical.
3. Else if `GEMINI.md` is present and ≥ 50 lines, it is canonical.
4. Else: scaffold a minimal canonical from this prompt's **Appendix B**, then
   mirror.

The mirror operation is one-direction (canonical → derivatives). Never back-port
edits from a derivative to canonical without confirmation.

Each derivative gets a footer:

```
> Mirrored from <canonical-file> on <ISO-date>. Edits made directly here may
> be overwritten on the next run. Edit the canonical file instead.
```

---

## Phase 6 — Verification

Print a checklist the user can run. Tailor it to detected CLIs.

```
## Verification

- [ ] `git status` clean (no unintended diffs outside the managed sections)
- [ ] `claude --version` recent (within last 7 days)
- [ ] `claude /doctor` (Claude Code) reports no issues
- [ ] `wc -l CLAUDE.md` ≤ 200
- [ ] All `.claude/rules/*.md` have `paths:` frontmatter
- [ ] `.claude/settings.json` parses + permissions wildcards present
- [ ] `.mcp.json` parses (if present); no inline secrets
- [ ] Hook scripts in `.claude/hooks/` are executable
- [ ] Spot-check one slash command: `claude /code-review`
- [ ] Spot-check one subagent: `claude` then "use the <name> subagent for X"
- [ ] Spot-check one skill: `claude` then trigger phrase from the skill description
- [ ] AGENTS.md / GEMINI.md / .cursorrules / .windsurfrules show the managed footer
- [ ] No drift between CLAUDE.md and mirrored files (`diff <(extract managed) …`)
```

End with a one-sentence "what changed" summary citing the buckets applied.

---

## Appendix A — Playbook concepts (curated)

This is the distilled tip table the audit phase cites. Use it as the source of
"why" lines in the recommendation report. Keep these short — full sources are
linked from the canonical repo.

### Prompting

- Challenge the work: "grill me on these changes; don't ship until I pass." (Boris)
- After a mediocre fix: "knowing what you know now, scrap and do the elegant solution." (Boris)
- Most bugs: paste the bug, say "fix", don't micromanage. (Boris)

### Planning / Specs

- Always start in plan mode. (Boris)
- Start with a minimal spec; ask the model to interview you with `AskUserQuestion`. (Thariq)
- Phase-wise gated plan with tests per phase. (Dex)
- Spin up a second Claude (or cross-model) as a staff-engineer reviewer. (Boris)
- Prototype > PRD: 20-30 versions over a single doc. (Boris)

### Context

- Watch for context rot ~30-40% utilisation; manually `/compact` or `/clear`. (Dex · Thariq)
- Rewind > correct: `/rewind` and re-prompt instead of polluting context with corrections. (Thariq)
- `/compact` with a focus hint beats letting auto-compact fire. (Thariq)
- Use subagents for context management — child sees noise, parent sees conclusion. (Thariq)

### Session

- Every turn is a branch point: Continue / `/rewind` / `/clear` / `/compact` / Subagent. (Thariq)
- New task = new session. Related tasks may reuse for momentum. (Thariq)
- "Summarize from here" before rewinding to leave a handoff note. (Thariq)
- `/rename` important sessions, `/resume` later. (Cat)

### CLAUDE.md & rules

- ≤ 200 lines per file; split into `.claude/rules/*.md` with `paths:` frontmatter for lazy load. (Boris · Claude)
- `<important if="...">` tags for invariants. (Dex)
- Multiple CLAUDE.md for monorepos. (Boris)
- Anyone should be able to clone, run "test", and have it pass — if not, CLAUDE.md is missing setup commands. (Dex)
- Use settings.json for harness-enforced behaviour (attribution, perms, model). (davila7)

### Agents

- Feature-specific personas + skills > one generic backend/qa agent. (Boris)
- "Use subagents" to throw more compute. (Boris)
- Agent teams + tmux + worktrees for parallel work. (Boris)
- Test-time compute: one agent codes, another (same model) reviews. (Boris)

### Commands

- Use commands for repeated workflows; agents for fresh-context tasks. (Boris)
- If you do it more than once a day → command or skill. (Boris)

### Skills

- `context: fork` runs a skill in an isolated subagent. (Lydia)
- Folder layout: `SKILL.md` + `references/`, `scripts/`, `examples/`. (Thariq)
- Build a Gotchas section over time. (Thariq)
- Description = trigger, not summary — write for the model. (Thariq)
- Don't railroad; give goals + constraints. (Thariq)
- Bundle scripts/libs so Claude composes vs reconstructs. (Thariq)
- `!command` in SKILL.md injects dynamic shell output at invocation. (Lydia)

### Hooks

- PostToolUse for auto-format (handles last-mile CI failures). (Boris)
- Stop hook to nudge verification at end of turn. (Boris)
- PreToolUse permission router via Opus to auto-approve safe ops. (Boris)
- `/careful` and `/freeze` on-demand hooks for blast-radius control. (Thariq)

### Workflows

- `/model` to choose, `/context` for utilisation, `/usage` for plan limits, `/config` to tune. (Cat)
- `ultrathink` keyword for high-effort reasoning. (Claude)
- `/focus` mode hides intermediate work. (Boris)
- `/loop` for local recurring tasks; `/schedule` for cloud cron. (Boris)
- Wildcard permissions over `--dangerously-skip-permissions`. (Boris)
- `/sandbox` to reduce permission prompts (~84% drop internally). (Boris · Cat)
- Auto mode (Shift+Tab cycle) with model-based safety classifier. (Boris)
- Build a `/go` skill: test → simplify → PR. (Boris)

### Git / PR

- Small PRs, one feature each (~118 LOC median is reasonable). (Boris)
- Squash merge for linear history. (Boris)
- Commit hourly or on task completion. (Shayan)
- Tag the agent on a coworker's PR to auto-generate lint rules from review feedback. (Boris)
- `/code-review` for multi-agent PR analysis. (Boris)

### Debugging

- Screenshots when stuck. (Shayan)
- Browser/Playwright/DevTools MCP so the agent sees console logs. (Claude)
- Run server as a background task so logs are visible. (Shayan)
- `/doctor` for installation/auth/config issues. (Shayan)
- Cross-model QA (e.g. Codex / Gemini reviewing a Claude plan). (Shayan)
- Agentic search (glob + grep) > vector RAG for code. (Boris)

### Daily

- Update Claude Code daily. (Shayan)
- Read `/changelog` first thing. (Shayan)
- iTerm/Ghostty/tmux > IDE-embedded panel. (Boris)
- Voice dictation (`/voice` or external) for prompt throughput. (Boris)
- Custom status line for context awareness. (Boris · Shayan)

---

## Appendix B — Templates (copy-paste)

Use these when scaffolding. Keep them minimal — the user fills in specifics.

### B.1 `.claude/settings.json` baseline

See Bucket (b) above.

### B.2 Subagent template (`.claude/agents/_template.md`)

```markdown
---
name: <kebab-case-name>
description: One sentence describing when to use this subagent. Read by the router model.
model: inherit
tools: [Read, Grep, Glob, Bash]
isolation: worktree   # optional; remove if not needed
---

# <Title>

## When to use
<2-3 lines, very concrete>

## When NOT to use
<2-3 lines>

## Output contract
<exactly what the subagent returns to the parent>

## Operating rules
- Plan-first.
- Never modify files outside <scope>.
- Return ≤ 200 words unless asked.
```

### B.3 Slash command template (`.claude/commands/_template.md`)

```markdown
---
description: One-line description (shown in `/` menu).
allowed-tools: [Read, Edit, Bash, Grep, Glob]
argument-hint: "<optional positional arg>"
---

# /<command-name>

<Body. Use $ARGUMENTS for positional input. Reference files with @path/to/file.>
```

### B.4 Skill template (`.claude/skills/_template/SKILL.md`)

```markdown
---
name: <kebab-case-name>
description: |
  Trigger-shaped sentence: "When the user wants X (e.g., …), …"
  Includes 2-3 example phrasings the model will recognise.
context: fork  # optional; runs in isolated subagent
---

# <Title>

## Goal
<one paragraph>

## Procedure
1. …
2. …
3. …

## Gotchas
- <Add Claude's actual failure points here over time>
- <…>

## References
- references/<file>.md
```

Optional siblings:

```
.claude/skills/<name>/
├── SKILL.md
├── references/    # progressive disclosure: large reference content the model loads on demand
├── scripts/       # callable scripts the skill composes with
└── examples/      # input/output pairs
```

### B.5 PostToolUse auto-format hook (`.claude/hooks/post-tool-use-format.sh`)

```bash
#!/usr/bin/env bash
# Auto-format the last-edited file. No-op when no formatter is installed.
set -euo pipefail

file="${CLAUDE_TOOL_INPUT_PATH:-${CLAUDE_TOOL_FILE_PATH:-}}"
[[ -n "${file:-}" && -f "$file" ]] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.css|*.scss|*.html|*.yaml|*.yml)
    command -v prettier >/dev/null && prettier --write --log-level=warn "$file" || true
    ;;
  *.py)
    command -v ruff >/dev/null && ruff format "$file" || true
    ;;
  *.go)
    command -v gofmt >/dev/null && gofmt -w "$file" || true
    ;;
  *.rs)
    command -v rustfmt >/dev/null && rustfmt --quiet "$file" || true
    ;;
  *.cs|*.csproj)
    command -v dotnet >/dev/null && dotnet format --include "$file" >/dev/null 2>&1 || true
    ;;
esac

exit 0
```

### B.6 Stop verifier hook (`.claude/hooks/stop-verifier.sh`)

```bash
#!/usr/bin/env bash
# End-of-turn nudge. Adapts to the project's task runner.
set -euo pipefail

if [[ -f Makefile ]] && grep -qE '^(test|lint|typecheck):' Makefile; then
  echo "↪ Reminder: \`make test\` / \`make lint\` / \`make typecheck\` before declaring done."
elif [[ -f package.json ]] && grep -qE '"(test|lint|typecheck)"' package.json; then
  echo "↪ Reminder: run the project's test/lint/typecheck scripts before declaring done."
elif [[ -f pyproject.toml ]]; then
  echo "↪ Reminder: run pytest / ruff / mypy before declaring done."
fi
exit 0
```

### B.7 PreToolUse careful hook (`.claude/hooks/pre-tool-use-careful.sh`)

```bash
#!/usr/bin/env bash
# When the in-session marker .claude/.careful exists, block destructive ops.
set -euo pipefail
[[ -f .claude/.careful ]] || exit 0

cmd="${CLAUDE_TOOL_INPUT_COMMAND:-}"
case "$cmd" in
  *"rm -rf"*|*"git push --force"*|*"git push -f"*|*"git reset --hard"*|*"git stash"*|*"git clean -f"*|*"--no-verify"*)
    echo "BLOCKED by /careful mode: $cmd"
    exit 2
    ;;
esac
exit 0
```

### B.8 SessionStart orient hook (`.claude/hooks/session-start-orient.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
branch=$(git branch --show-current 2>/dev/null || echo "(detached)")
last=$(git log -1 --pretty=format:'%h %s (%cr)' 2>/dev/null || echo "(no commits)")
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "→ branch: $branch  |  last: $last  |  dirty files: $dirty"
exit 0
```

### B.9 `.mcp.json` shape

See Bucket (e) above.

### B.10 Canonical rules excerpt (mirrored to derivatives)

```markdown
## Project rules (canonical)

- Plan first. Show diffs before writing.
- Working tree must be clean before destructive ops; ask if dirty.
- No `git stash`, `git reset --hard`, `git clean -fd`, `git push --force`,
  `git rebase`, `git commit --amend`, `--no-verify` without explicit user
  confirmation in the same turn.
- Edits below 500 lines per file when possible.
- Use the project's task runner (Makefile / npm scripts / cargo / pyproject)
  rather than ad-hoc invocations.
- Match existing code style; don't introduce new patterns without reason.
- Prefer additive changes; mark managed sections with
  `<!-- BEGIN best-practice --> ... <!-- END best-practice -->`.

## Conventions

- Tests live in `<conventional path>` for this stack.
- Lint, format, and typecheck must pass before "done".
- Commit messages: <imperative, scoped, ≤72 chars subject>.
- PRs: small, single-feature, squash-merge.
```

---

## Appendix C — Cross-CLI cheatsheet

| Concept           | Claude Code                          | OpenCode / Codex      | Gemini CLI       | Cursor                                  | Windsurf                | Copilot                                       |
| ----------------- | ------------------------------------ | --------------------- | ---------------- | --------------------------------------- | ----------------------- | --------------------------------------------- |
| Memory            | `CLAUDE.md` + `.claude/rules/`       | `AGENTS.md`           | `GEMINI.md`      | `.cursorrules` or `.cursor/rules/*.mdc` | `.windsurfrules`        | `.github/copilot-instructions.md` + `.github/instructions/*.instructions.md` |
| Settings          | `.claude/settings.json`              | `.opencode/config.*`  | `.gemini/*`      | Editor settings                         | Editor settings         | n/a                                           |
| Hooks             | `.claude/hooks/`                     | (limited)             | (limited)        | (limited)                               | (limited)               | n/a                                           |
| Subagents         | `.claude/agents/*.md`                | n/a                   | n/a              | n/a                                     | n/a                     | n/a                                           |
| Commands          | `.claude/commands/*.md`              | (custom)              | (custom)         | (custom)                                | (custom)                | n/a                                           |
| Skills            | `.claude/skills/<name>/SKILL.md`     | n/a                   | n/a              | n/a                                     | n/a                     | n/a                                           |
| MCP               | `.mcp.json` + settings               | (supported)           | (supported)      | `.cursor/mcp.json`                      | (limited)               | n/a                                           |
| Plan mode         | First-class                          | n/a                   | n/a              | n/a                                     | "Cascade"               | n/a                                           |
| Sandbox           | `--permission-mode auto` + sandbox   | n/a                   | n/a              | n/a                                     | n/a                     | n/a                                           |
| Worktrees         | `EnterWorktree` / `isolation`        | manual                | manual           | manual                                  | manual                  | manual                                        |

---

## Quick start (for the human reading this prompt)

1. Drop this file at `prompts/CLAUDE-BEST-PRACTICE.md` in any project.
2. From the project root, run your AI CLI of choice and ask it to "follow the
   instructions in `prompts/CLAUDE-BEST-PRACTICE.md` for this project".
3. Approve the buckets you want.
4. Re-run any time — it is idempotent and only patches managed sections.

---

## Done condition

When the apply phase completes, print:

```
## Summary

Buckets applied: <list>
Files created:   <count>
Files modified:  <count>  (managed sections only)
Detected CLIs:   <list>
Mirror targets:  <list>

Next steps: run the verification checklist above.
```

If the user said "none" or aborted, print the recommendation report and exit
without writing.

<!-- BEGIN runtime-enforcement-link -->
## Runtime Enforcement

The directives in this document are also enforced at runtime in ServerlessBase's four AI chat surfaces via `services/agent-skills/best-practice-prompt.ts`. See `.claude/rules/runtime-best-practice-enforcement.md` for the runtime contract.
<!-- END runtime-enforcement-link -->
