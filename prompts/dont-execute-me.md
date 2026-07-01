# Analyze & Generate Prompt Files (No Code Execution)

## Purpose

This is a **meta-prompt template**. Given a list of points below, analyze each one thoroughly and generate a dedicated prompt file for each — without modifying any project code.

## Workflow

### Phase 1: Research (before generating anything)

For each point listed below:

1. **Understand the problem** — Use web search and Context7 MCP tools to gather up-to-date information about the relevant libraries, APIs, or patterns involved.
2. **Explore the codebase** — Read the relevant source files, agents (`.claude/agents/`), skills (`.claude/skills/`), and existing prompts (`prompts/`) to understand current state.
3. **Ask before proceeding** — If anything is ambiguous, ask me for clarification. Present options one at a time and wait for approval before moving to the next point.

### Phase 2: Generate prompt files (after all points are understood)

For each point, create a prompt file inside a **single new folder** under `prompts/`. Name the folder descriptively (e.g., `prompts/XX-folder-name/`).

**Do NOT modify any other files.** Only create prompt files.

Every generated prompt filename MUST end with a model-tier suffix so `prompt_executor.py --mode=auto` can pick the right model per-file. See **Filename Convention** below.

## Quality Gates (apply to every generated prompt)

Each prompt file must include instructions for all of the following:

| Gate | Requirement |
|------|-------------|
| **Tests** | 100% test coverage for all changes. All tests must pass. Include specific test cases and edge cases in the prompt. |
| **i18n** | All 5 languages supported (en, ar, fr, de, es) — both client-side UI strings and backend response messages (errors + success). Include i18n test coverage. |
| **Docs** | If the point warrants user-facing documentation, include a sub-task to create/update docs under `/docs` with all 5 language variants. Skip only if clearly inappropriate. |
| **Agents & Skills** | Reference the correct Claude agent from `.claude/agents/` and any relevant skills from `.claude/skills/`. If an existing agent or skill needs updating to handle this point, note that in the prompt. |

## Prompt File Format

Every generated prompt file must follow this structure:

```markdown
# {Title}

## Agent
{agent-name from .claude/agents/}

## Task
{Clear description of what to implement/fix}

### {Numbered sections with specific requirements}
...

### Tests
- {Specific test cases to write}
- {Edge cases to cover}
- {i18n test requirements}

### i18n
- {Translation keys to add/update}
- {Backend messages to localize}
- {RTL considerations if applicable}

### Documentation (if applicable)
- {Docs pages to create/update under /docs}
- {5-language support}
```

## Constraints

- **No code execution** — Only generate prompt files. Do not edit source code, configs, tests, agents, or skills directly.
- **One option at a time** — Before generating, present your analysis and proposed prompt breakdown. Wait for my approval on each point before proceeding.
- **Follow project conventions** — All prompts must respect: Docker-only execution, bigint cents for money, org-scoped data access, cursor-based pagination, ISO 8601 dates, camelCase API responses, mobile-first design, dark mode, RTL support.

## Filename Convention (for auto-mode execution)

Every prompt file MUST end with a model-tier suffix that matches the task's difficulty. The pattern is:

```
NN-descriptive-kebab-<model-alias>.md
```

Pick the alias based on how hard the task is — correctness matters more than speed for hard tasks, so reach for the bigger model when in doubt:

| Alias        | When to use                                                                                                                                                |
|--------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `gpt-5.5`    | **Hardest** (OpenAI Codex peer). Same tier as `opus-4.7`. Used for the same category of work; load-balanced with `opus-4.7` per the split rule below.       |
| `opus-4.7`   | **Hardest** (Anthropic peer). Architecture decisions, security-sensitive changes, multi-system refactors, subtle concurrency / billing / auth logic, novel algorithms, anything where a quiet bug is expensive. |
| `sonnet-4.6` | **Medium.** Feature implementation, UI building, integrating existing patterns, routine debugging, most CRUD work. Use this when you're not sure.          |
| `glm-5.1`    | **Easy.** Mechanical refactors, renames, straightforward additions that follow a visible pattern, copy-paste-adjust work, doc updates, translation-file edits. |

**Split rule for the "Hardest" tier:** classify the file as Hardest first, then deterministically split between the two peer models — **3-of-5 → `gpt-5.5`, 2-of-5 → `opus-4.7`** (60/40) in the file's numeric-prefix order within the batch. This balances load across two providers and exploits both models' strengths. See `prompts/RENAME-PROMPT-FILE.md` for the exact counter rule the renamer applies.

Examples:

- `00-redesign-payment-flow-gpt-5.5.md` (1st Hardest → gpt-5.5)
- `01-rewrite-auth-middleware-opus-4.7.md` (4th Hardest → opus-4.7)
- `02-add-settings-panel-sonnet-4.6.md`
- `03-rename-legacy-fields-glm-5.1.md`

The executor's `--mode=auto` reads the suffix per-file and routes each prompt to the right backend automatically. Sticky-swap fallbacks on provider credit/quota errors:

- `gpt-5.5` ↔ `opus-4.7` (bidirectional, peer-tier swap across providers).
- `glm-5.1` ↔ `haiku-4.5` (bidirectional, easy-tier swap across providers).

So both `gpt-5.5` and `glm-5.1` are safe choices even if one provider's credit is tight.

Files without a recognized suffix are skipped in auto mode unless `-m/--model` is passed as a fallback, so **always include the suffix**.

---

## Points to Analyze
