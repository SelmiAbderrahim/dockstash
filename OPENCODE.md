# OPENCODE.md

OpenCode-specific guidance for this MERN starter. For project conventions, stack details, and feature-module rules, see [`CLAUDE.md`](CLAUDE.md).

---

## 1. Configured Providers and Models

`opencode.jsonc` declares a single active provider:

| Provider | Model ID | Role |
|----------|----------|------|
| Anthropic | `claude-sonnet-4-6` | Default + small model |
| Anthropic | `claude-opus-4-7` | Available on demand |

**Z.AI GLM** is included as a commented-out block. To activate it:

1. Uncomment the `zai-coding` block in `opencode.jsonc`.
2. Set the env var: `export ZAI_CODING_PLAN_API_KEY=your-key`.
3. Switch default: `"model": "zai-coding/glm-5.1"`.

Other OpenAI-compatible providers (OpenRouter, Together, etc.) follow the same pattern — add a top-level key under `"provider"` with `"npm": "@ai-sdk/openai-compatible"` and your base URL.

## 2. Where Agents Live

Agents are flat Markdown files in `.opencode/agent/`. Each file has YAML frontmatter:

```yaml
---
mode: subagent
description: "Short description shown in agent picker"
temperature: 0.2
tools:
  read: true
  write: true
  edit: true
  bash: true
  glob: true
  grep: true
  task: true
permission:
  bash: allow
  edit: allow
---
```

**39 agents** are currently ported. The full catalog lives in [`AGENTS.md`](AGENTS.md) section 6. Key agents for daily work:

| Agent | Purpose |
|-------|---------|
| `coder` | Implementation, write/edit code |
| `code-reviewer` | Read-only code review |
| `planner` | Task breakdown and orchestration |
| `tester` | Test strategy and QA |
| `typescript-pro` | Strict TypeScript work |
| `researcher` | Deep codebase exploration |

## 3. Where Commands Live

Slash commands are in `.opencode/command/`. Currently all commands are **SpecKit** workflows:

| Command | Purpose |
|---------|---------|
| `/speckit.constitution` | Define project constitution |
| `/speckit.specify` | Create feature specification |
| `/speckit.clarify` | Refine spec with clarifications |
| `/speckit.plan` | Generate implementation plan |
| `/speckit.implement` | Execute the plan |
| `/speckit.tasks` | List tasks from a spec |
| `/speckit.taskstoissues` | Convert tasks to GitHub issues |
| `/speckit.checklist` | Acceptance criteria checklist |
| `/speckit.analyze` | Analyze codebase for spec context |

## 4. Differences from Claude Code

Claude Code reads `.claude/` (agents in `agents/`, skills in `skills/`, settings in `settings.json`). OpenCode reads `.opencode/` (agents in `agent/`, commands in `command/`, config in root `opencode.jsonc`). Permission scopes (`allow`, `ask`, `deny`) come from frontmatter `permission` keys and the `permission` block in `opencode.jsonc` — not from a separate `settings.json`. Subagent invocation uses `task` tool with `subagent_type` matching the agent filename (without `.md`). Both tools share the same `.claude/rules/` directory for governance rules and read `AGENTS.md` as the entry point.

## 5. Setting Your API Key

Two methods — pick one:

**Environment variable** (recommended):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

**Local override file** (git-ignored):

Create `.opencode/local.json` (already git-ignored):

```json
{
  "provider": {
    "anthropic": { "apiKey": "sk-ant-..." }
  }
}
```

Never commit API keys. The `.opencode/.gitignore` already excludes `local.json`.

## 6. Running an Agent

```bash
# Start an interactive session with the default model
opencode

# Run a specific agent directly
opencode run coder "Add input validation to the signup form"

# Override the model for a session
opencode run --model anthropic/claude-opus-4-7 planner "Break down the billing refactor"

# Use a slash command
opencode run --command speckit.specify "Add Stripe webhook retry logic"
```

Inside an active session, agents are invoked via the `task` tool:

```
task(subagent_type="coder", prompt="Implement the changes described in plan.md")
```

## 7. Instructions Auto-Loaded

`opencode.jsonc` loads these files into every session:

| File | Why |
|------|-----|
| `AGENTS.md` | Project identity, rules index, ports |
| `.claude/rules/environment-variables.md` | Root `.env` only, no subdirectory `.env` |
| `.claude/rules/git-destructive-commands.md` | Per-turn confirmation for destructive git ops |
| `.claude/rules/site-url-env-pattern.md` | No hardcoded URLs |

Additional rules are read on demand when working in relevant feature areas. See [`AGENTS.md`](AGENTS.md) section 7 for the full rule catalog.
