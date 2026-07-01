# Claude Code to OpenCode Migration Prompt

> **Purpose**: Convert a project's Claude Code configuration (CLAUDE.md, agents, skills, rules, settings) to OpenCode-compatible format. Works for any project, not just a specific codebase.
>
> **How to use**: Run this prompt inside the project root with Claude Code or any AI coding assistant. The prompt is self-contained and will discover your existing Claude Code configuration automatically.

---

## Phase 0: Discovery & Inventory

Before converting anything, build a complete inventory of what exists.

### 0.1 Scan for Claude Code artifacts

Run these searches from the project root and record what you find:

```
Artifact Type           | Search Pattern                        | Record
------------------------|---------------------------------------|---------------------------
Main instructions       | CLAUDE.md, CLAUDE.local.md            | Path, line count
Settings                | .claude/settings.json                 | Exists? Contents summary
                        | .claude/settings.local.json           |
Rules                   | .claude/rules/*.md                    | Count, filenames
Agents                  | .claude/agents/**/*.md                | Count, filenames, hierarchy
Skills                  | .claude/skills/*/SKILL.md             | Count, skill names
Commands                | .claude/commands/**/*.md              | Count, command names
MCP config              | .mcp.json                             | Servers defined
Memory                  | .claude/projects/*/memory/MEMORY.md   | Exists?
Hooks                   | settings.json -> hooks                | Any defined?
```

### 0.2 Classify rules by load frequency

Split rules into two categories:

| Category | Criteria | Destination |
|----------|----------|-------------|
| **Always-load** | Cross-cutting rules that apply to virtually every task (coding standards, environment setup, naming conventions, RTL, testing policies) | `instructions[]` array in `opencode.jsonc` |
| **On-demand** | Feature-specific rules that only matter when working on that feature (e.g., mail server patterns, payment integration, blog config) | Referenced in agents or loaded when relevant files are touched |

**Heuristic**: If a rule file is referenced by >50% of agents or affects every code change, it's always-load. Cap always-load at ~10 files to avoid bloating every session's context.

### 0.3 Classify agents by role

| Claude Code Role | OpenCode Equivalent | Notes |
|------------------|---------------------|-------|
| General-purpose (coder, tester, reviewer, planner, researcher) | `mode: primary` or just referenced in AGENTS.md | These map to OpenCode's built-in `coder`/`task` agents |
| Domain specialist (e.g., stalwart-mail-specialist, pwa-specialist) | `mode: subagent` in `.opencode/agent/` | Converted as subagent markdown files |
| Orchestrator / coordinator | `mode: primary` with delegation instructions | Rare; most become subagents |
| Meta agents (agent-organizer, prompt-engineer) | Omit or merge into AGENTS.md guidance | OpenCode doesn't support meta-agent spawning the same way |

---

## Phase 1: Create `AGENTS.md` (OpenCode's entry point)

OpenCode reads `AGENTS.md` as its primary project context file (equivalent to `CLAUDE.md`). It should be a **concise pointer document**, not a copy of CLAUDE.md.

### Template

```markdown
# {Project Name} -- OpenCode Agent Guide

> **Coexistence note** -- Claude Code reads `CLAUDE.md`; OpenCode reads this
> file first, then `CLAUDE.md`. Both share the same `.claude/rules/` directory.
> This file is a concise pointer; `CLAUDE.md` is the comprehensive reference.
> Do not duplicate content that already lives in `CLAUDE.md` or the rules.

---

## 1. Project Identity

{1-3 sentence description of what the project is and its tech stack.}

| Layer | Tech |
|-------|------|
| Frontend | {list} |
| Backend | {list} |
| Infrastructure | {list} |

---

## 2. Critical Rules (Zero Tolerance)

{List the 5-10 most important rules as one-liners with pointers to full rule files.}

### 2.1 {Rule Name}
{One-line summary}
-> Full details: `.claude/rules/{rule-file}.md`

{Repeat for each critical rule}

---

## 3. Sources of Truth

| Concern | Authoritative File |
|---------|--------------------|
| {concern} | {path} |

---

## 4. Rules Directory

{Count} rule files live in `.claude/rules/`. Key categories:

| Category | Example Rules |
|----------|---------------|
| {category} | {rule names} |

When you need implementation details for a specific feature, read the relevant rule file.

---

## 5. OpenCode-Specific Notes

### 5.1 Instructions Pre-Loading

The `instructions[]` array in `.opencode/opencode.jsonc` loads {N} critical rule
files into every OpenCode session automatically. Feature-specific rules are
loaded on demand when you read files in those directories.

### 5.2 Provider Configuration

{Describe the AI provider setup in opencode.jsonc}

### 5.3 MCP Servers

{List MCP servers configured in opencode.jsonc}

### 5.4 Agents

OpenCode agents are defined as markdown files in `.opencode/agent/`.
Claude Code agents in `.claude/agents/` are the source of truth.

### 5.5 Slash Commands

OpenCode commands in `.opencode/command/` are mapped from Claude Code skills.

---

## 6. When You Need More Context

| Question | Read |
|----------|------|
| Full project structure | `CLAUDE.md` |
| Specific feature patterns | `.claude/rules/{feature}-patterns.md` |
| {other common questions} | {paths} |

---

## 7. Quick Reference

```bash
{Most common development commands}
```
```

### Conversion rules for AGENTS.md

1. **Extract** the project identity, tech stack, and critical rules from `CLAUDE.md`
2. **Summarize** -- don't copy. Each rule gets a one-liner + pointer to the full `.claude/rules/*.md` file
3. **Categorize** the rules directory for discoverability
4. **Add** OpenCode-specific notes about `opencode.jsonc` configuration
5. **Keep it under 200 lines** -- this file is loaded into every session

---

## Phase 2: Create `.opencode/opencode.jsonc`

This is OpenCode's main configuration file. Convert from `.claude/settings.json` + `.mcp.json` + project conventions.

### Template

```jsonc
{
  "$schema": "https://opencode.ai/config.json",

  // Primary model for new sessions
  "model": "{provider}/{model-id}",
  "small_model": "{provider}/{small-model-id}",

  // Custom provider registration (if not using a built-in provider)
  // Only include this section if the project uses a non-standard provider.
  "provider": {
    "{provider-name}": {
      "npm": "{npm-package}",
      "name": "{Display Name}",
      "options": {
        "baseURL": "{api-base-url}",
        "apiKey": "{env:API_KEY_ENV_VAR}"
      },
      "models": {
        "{model-id}": {
          "name": "{Display Name}",
          "reasoning": true,
          "tool_call": true,
          "cost": { "input": 0, "output": 0, "cache_read": 0, "cache_write": 0 },
          "limit": { "context": 200000, "output": 100000 }
        }
      }
    }
  },

  // Permission defaults
  // Convert from .claude/settings.json permissions
  "permission": {
    "skill": {
      "*": "allow"
      // Add "ask" or "deny" overrides for sensitive skills
    },
    "bash": "allow",
    "edit": "allow",
    "webfetch": "allow",
    "websearch": "allow"
  },

  // Always-loaded instruction files (from Phase 0.2 classification)
  // AGENTS.md is always first. Then add cross-cutting rules.
  // Cap at ~10 files. Feature-specific rules are loaded on demand.
  "instructions": [
    "AGENTS.md"
    // Add always-load rules here
  ],

  // MCP servers (convert from .mcp.json or .claude/settings.json)
  "mcp": {
    // Remote MCP servers
    "{server-name}": {
      "type": "remote",
      "url": "{mcp-endpoint-url}",
      "headers": {
        "Authorization": "Bearer {env:API_KEY}"
      },
      "oauth": false,
      "enabled": true,
      "timeout": 15000
    },
    // Local (stdio) MCP servers
    "{server-name}": {
      "type": "local",
      "command": ["{command}", "{args}"],
      "environment": {
        "API_KEY": "{env:API_KEY}"
      },
      "enabled": true,
      "timeout": 20000
    }
  }
}
```

### Conversion rules for opencode.jsonc

| Claude Code Source | OpenCode Target | Notes |
|--------------------|-----------------|-------|
| Default model (implicit or from CLAUDE.md) | `"model"` | Use `{provider}/{model-id}` format |
| `.claude/settings.json` -> `permissions.allow` | `"permission"` | Convert Bash glob patterns to tool-level allow/deny |
| `.claude/settings.json` -> `permissions.deny` | `"permission"` | Map destructive patterns to `"deny"` |
| `.claude/settings.json` -> `hooks` | Not directly supported | Document in AGENTS.md or use MCP |
| `.claude/settings.json` -> `env` | Environment-level config | OpenCode reads env vars directly |
| `.claude/settings.json` -> `enabledMcpjsonServers` | `"mcp"` | Convert each server to remote/local format |
| `.mcp.json` -> server definitions | `"mcp"` | Map `stdio` -> `"type": "local"`, `sse`/`streamable-http` -> `"type": "remote"` |
| `.claude/settings.json` -> `statusLine` | Not supported | Omit |
| `.claude/settings.json` -> `includeCoAuthoredBy` | Not supported | Omit |

### Permission conversion rules

Claude Code uses Bash glob patterns like `Bash(git status)`. OpenCode uses tool-level permissions:

```
Claude Code                          -> OpenCode
-----------------------------------------|--------------------------
Bash(git:*)                          -> "bash": "allow"
Bash(rm -rf /)                       -> (documented warning in AGENTS.md)
(no explicit deny)                   -> "bash": "allow" (default)
```

OpenCode permissions are coarser-grained. If Claude Code has fine-grained Bash restrictions, document them as rules in AGENTS.md rather than trying to replicate them in permissions.

### Skill permission conversion

Map sensitive Claude Code skills to OpenCode skill permissions:

```
Claude Code Skill Category            -> OpenCode Skill Permission
-------------------------------------------|--------------------------
Legal, security, payment skills       -> "{skill-name}": "ask"
Deployment, release skills            -> "{skill-name}": "ask"
Experimental/swarm skills             -> "{skill-name}": "deny"
All others                            -> "*": "allow"
```

---

## Phase 3: Convert Agents

Convert each `.claude/agents/**/*.md` file to a flat `.opencode/agent/{name}.md` file.

### Frontmatter mapping

| Claude Code Field | OpenCode Field | Conversion |
|-------------------|----------------|------------|
| `name` | (filename) | Filename becomes the agent ID. Use kebab-case. |
| `type` | `mode` | `developer`/`analyst`/`tester` -> `subagent`. Core agents -> `primary`. |
| `color` | `color` | Copy as-is (hex string) |
| `description` | `description` | Copy or expand. Use `\|` for multiline YAML. |
| `capabilities` | (body text) | Move to markdown body; no OpenCode equivalent field |
| `priority` | (omit) | No OpenCode equivalent |
| `hooks.pre` | (omit) | No OpenCode equivalent; document in body if critical |
| `hooks.post` | (omit) | No OpenCode equivalent; document in body if critical |
| (none) | `model` | Set to the project's default model (e.g., `zai-coding/glm-5.1`) |
| (none) | `temperature` | Set to `0.2` for specialists, omit for general agents |
| (none) | `tools` | Set based on agent role (see tool mapping below) |
| (none) | `permission` | Set based on agent role (see permission mapping below) |

### Tool mapping by agent role

| Agent Role | tools | permission |
|------------|-------|------------|
| Read-only (reviewer, analyzer, auditor) | `"*": false, read: true, glob: true, grep: true` | `read: allow, edit: deny, bash: deny` |
| Implementation (coder, developer, builder) | `read: true, write: true, edit: true, bash: true, glob: true, grep: true` | `bash: allow, edit: allow` |
| Research-only (researcher, explorer) | `read: true, glob: true, grep: true, webfetch: true, websearch: true` | `read: allow, bash: deny, edit: deny` |
| Full-access (orchestrator, coordinator) | All `true` | `bash: allow, edit: allow` |

### Body conversion

1. **Keep** the core instruction text from the Claude agent
2. **Add** a "Bridged From" section at the bottom referencing the original Claude agent path
3. **Remove** Claude-specific MCP tool call examples (e.g., `mcp__claude-flow__*`)
4. **Remove** hook-related instructions that don't apply in OpenCode
5. **Condense** -- OpenCode agents should be concise. If the Claude agent is >100 lines, extract the essential instructions and reference rule files for details

### Agent template

```markdown
---
mode: {primary|subagent}
description: "{concise description}"
model: {provider/model-id}
temperature: {0.2 for specialists, omit for general}
tools:
  read: true
  write: {true|false}
  edit: {true|false}
  bash: {true|false}
  glob: true
  grep: true
permission:
  bash: {allow|deny}
  edit: {allow|deny}
  read: allow
  glob: allow
  grep: allow
---

# {Agent Name}

{Core instructions -- what this agent does, its expertise, key behaviors.}

## Key Rules

{List the .claude/rules/*.md files this agent must follow.}

## Key Files

{List the most important files/directories this agent works with.}

> Bridged from `{original .claude/agents/ path}`.
```

### Hierarchy flattening

Claude Code agents use subdirectories (e.g., `.claude/agents/core/coder.md`, `.claude/agents/serverlessbase/chatbot-specialist.md`). OpenCode agents are **flat** -- all in `.opencode/agent/`.

Naming convention for flattened files:

| Claude Path | OpenCode Filename |
|-------------|-------------------|
| `.claude/agents/core/coder.md` | `.opencode/agent/coder.md` |
| `.claude/agents/core/tester.md` | `.opencode/agent/tester.md` |
| `.claude/agents/serverlessbase/chatbot-specialist.md` | `.opencode/agent/chatbot-specialist.md` |
| `.claude/agents/integrations/stripe-billing-specialist.md` | `.opencode/agent/stripe-billing-specialist.md` |
| `.claude/agents/analysis/code-review/analyze-code-quality.md` | `.opencode/agent/analyze-code-quality.md` |

If two agents from different subdirectories have the same filename, prefix with the parent directory (e.g., `core-coder.md` vs `sparc-coder.md`).

### Agents to skip

| Agent Type | Reason |
|------------|--------|
| Meta-orchestration agents (swarm coordinators, hive-mind) | OpenCode doesn't support multi-agent swarms |
| Template/example agents in `.claude/agents/templates/` | Not real agents, just scaffolding |
| Agents that only wrap MCP tool calls | The MCP tools are available directly |

---

## Phase 4: Convert Skills to Commands

Convert `.claude/skills/*/SKILL.md` files to `.opencode/command/*.md` files.

### Frontmatter mapping

| Claude Skill Field | OpenCode Command Field | Conversion |
|--------------------|------------------------|------------|
| `name` | (filename) | Filename becomes the command ID |
| `description` | `description` | Copy the "when to use" description |
| (none) | `agent` | Set to the appropriate agent (e.g., `coder`, `plan`) |
| (none) | `model` | Set to project default model |
| (none) | `subtask` | `true` for background-safe commands, `false` for interactive |
| `metadata.category` | (omit) | No OpenCode equivalent; use filename prefix for grouping |
| `metadata.version` | (omit) | No OpenCode equivalent |
| `metadata.dependencies` | (omit) | Document in body if critical |

### Command template

```markdown
---
description: "{When to use this command and what it does}"
agent: {coder|plan|task}
model: {provider/model-id}
subtask: {true|false}
---

## User Input

```text
$ARGUMENTS
```

{Consider the user input before proceeding (if not empty).}

## Instructions

{Core skill instructions converted from SKILL.md body.
 Remove Claude-specific references.
 Keep the actionable steps.}
```

### Skills to skip

| Skill Type | Reason |
|------------|--------|
| Built-in CLI skills (`/help`, `/clear`, `/compact`) | OpenCode has its own built-ins |
| Skills that only invoke `Skill` tool recursively | Not applicable |
| Skills tightly coupled to Claude Code hooks system | No OpenCode equivalent |
| Meta-skills (`statusline`, `keybindings-help`) | Claude Code UI-specific |

### Namespace mapping

Claude Code skills use colon-separated namespaces (e.g., `speckit:plan`, `github:pr-manager`). OpenCode commands use dot-separated names:

```
Claude Code: speckit:plan      -> OpenCode: speckit.plan.md
Claude Code: github:pr-manager -> OpenCode: github.pr-manager.md
Claude Code: swarm:init        -> OpenCode: swarm.init.md
```

---

## Phase 5: Verify & Reconcile

### 5.1 Validate file structure

After conversion, verify the directory structure:

```
{project-root}/
  AGENTS.md                          # OpenCode entry point (NEW)
  CLAUDE.md                          # Kept as-is (both platforms read it)
  .claude/                           # Kept as-is (shared source of truth)
    settings.json
    rules/*.md
    agents/**/*.md
    skills/*/SKILL.md
  .opencode/                         # NEW
    opencode.jsonc                   # Main config
    agent/                           # Flat agent files
      {name}.md
      {name}.md
      ...
    command/                         # Slash commands
      {name}.md
      {name}.md
      ...
```

### 5.2 Cross-reference checklist

| Check | How |
|-------|-----|
| Every always-load rule in `instructions[]` exists | `ls` each path listed in opencode.jsonc |
| Every `.opencode/agent/*.md` has valid frontmatter | Parse YAML frontmatter of each file |
| Every `.opencode/command/*.md` has valid frontmatter | Parse YAML frontmatter of each file |
| No orphaned agents (Claude agent exists but OpenCode doesn't) | Compare agent counts |
| No duplicate agent filenames after flattening | `ls .opencode/agent/ \| sort \| uniq -d` |
| MCP servers in opencode.jsonc match .mcp.json | Compare server lists |
| AGENTS.md rule count matches `.claude/rules/` count | Compare numbers |
| AGENTS.md is under 200 lines | `wc -l AGENTS.md` |

### 5.3 Coexistence validation

Both platforms must work side by side:

| Requirement | Validation |
|-------------|------------|
| `CLAUDE.md` unchanged | `git diff CLAUDE.md` shows no changes |
| `.claude/` directory unchanged | `git diff .claude/` shows no changes |
| `AGENTS.md` does not duplicate `CLAUDE.md` | Manual review: AGENTS.md should be pointers, not copies |
| `.opencode/opencode.jsonc` is valid JSONC | Parse with a JSONC parser |
| Rule files referenced by both platforms | Both `instructions[]` and Claude Code load from `.claude/rules/` |

---

## Phase 6: Migration Tracking (Optional)

Create `docs/internal/claude-to-opencode-migration.md` to track the conversion:

```markdown
# Claude Code to OpenCode Migration Log

## Status: {In Progress | Complete}
## Date: {YYYY-MM-DD}

## Inventory

| Artifact | Claude Code Count | OpenCode Count | Status |
|----------|-------------------|----------------|--------|
| Rules | {N} | {N} (shared) | Shared |
| Agents | {N} | {N} | Converted |
| Skills/Commands | {N} | {N} | Converted |
| MCP Servers | {N} | {N} | Converted |

## Skipped Agents

| Agent | Reason |
|-------|--------|
| {name} | {reason} |

## Skipped Skills

| Skill | Reason |
|-------|--------|
| {name} | {reason} |

## Notes

{Any project-specific decisions or deviations from the standard migration.}
```

---

## Quick Reference: File Format Comparison

| Concern | Claude Code | OpenCode |
|---------|------------|----------|
| Entry point | `CLAUDE.md` | `AGENTS.md` (reads `CLAUDE.md` too) |
| Config | `.claude/settings.json` (JSON) | `.opencode/opencode.jsonc` (JSONC) |
| Rules | `.claude/rules/*.md` | Same (shared via `instructions[]`) |
| Agents | `.claude/agents/**/*.md` (hierarchical) | `.opencode/agent/*.md` (flat) |
| Skills | `.claude/skills/*/SKILL.md` | `.opencode/command/*.md` |
| MCP | `.mcp.json` or `settings.json` | `opencode.jsonc` -> `"mcp"` |
| Memory | `.claude/projects/*/memory/` | `OpenCode.md` or custom |
| Hooks | `settings.json` -> `"hooks"` | Not supported (document in AGENTS.md) |
| Permissions | `Bash(glob:*)` patterns | Tool-level `allow`/`deny`/`ask` |
| Model config | Implicit (uses Claude) | Explicit `"model"` + `"provider"` |

---

## Execution Order

Run the phases in order. Each phase depends on the previous:

```
Phase 0: Discovery    -> Inventory of what exists
Phase 1: AGENTS.md    -> OpenCode entry point
Phase 2: opencode.jsonc -> Config, permissions, MCP, instructions
Phase 3: Agents       -> .opencode/agent/*.md files
Phase 4: Commands     -> .opencode/command/*.md files  
Phase 5: Verify       -> Cross-reference and validate
Phase 6: Track        -> Migration log (optional)
```

For large projects (50+ agents, 100+ skills), consider running Phases 3 and 4 in batches of 20 to avoid context exhaustion.
