# Rename Prompt Files by Model Tier

## Purpose

Take a folder under `prompts/` and rename every executable prompt file so its filename ends with the correct model-tier suffix for `prompt_executor.py --mode=auto`. The executor reads the suffix from the filename and routes each prompt to the right model without the user having to pass `-m/--model`.

This is a **meta-prompt**. Do not execute it through `prompt_executor.py`. Invoke it directly by passing the target folder.

## Input

The user will tell you which folder to process, for example:

> Rename prompt files in `prompts/19-oss-mirror`

If the folder is ambiguous, ask for clarification before starting.

## Model Tiers (the rubric)

Pick one tier per file based on the task's difficulty. Correctness-over-speed decides close calls — reach for the bigger model when in doubt.

| Alias | Use for | Examples |
|-------|---------|----------|
| `gpt-5.5` | **Hardest** (OpenAI Codex peer). Same tier as `opus-4.7`. Used for the same category of work; split rule below decides which peer gets each file. | Same examples as `opus-4.7`. |
| `opus-4.7` | **Hardest** (Anthropic peer). Architecture decisions, security-sensitive changes, multi-system refactors, subtle concurrency / billing / auth / migration logic, novel algorithms, anything where a quiet bug is expensive. | DB migrations touching money, auth middleware rewrites, multi-surface abstractions, PAYG source enums, new MCP tool tiers. |
| `sonnet-4.6` | **Medium.** Feature implementation, UI building, integrating existing patterns, routine debugging, most CRUD work. Default when unsure. | New dashboard tab, tool registration into existing surfaces, ZIP exports, FF preset configs, UI polish. |
| `glm-5.1` | **Easy.** Mechanical refactors, renames, straightforward additions that follow a visible pattern, copy-paste-adjust work, doc updates, translation-file edits. | i18n JSON additions, CHANGELOG entries, `.claude/rules/*.md` writes, simple field renames. |

**Hardest-tier split rule (3:2):** classify a file as Hardest first, then deterministically pick `gpt-5.5` vs `opus-4.7` so the load splits **3-of-5 → `gpt-5.5`, 2-of-5 → `opus-4.7`** (60/40 across two providers). See Phase 2 below for the exact counter.

Fallback behavior:

- `gpt-5.5` ↔ `opus-4.7` sticky-swap on provider credit/quota errors (peer-tier, bidirectional across OpenAI and Anthropic).
- `glm-5.1` ↔ `haiku-4.5` sticky-swap on provider credit/quota errors (easy-tier, bidirectional).

So both `gpt-5.5` and `glm-5.1` are safe choices even if one provider's balance is tight.

## Filename Convention

Target pattern:

```
NN-descriptive-kebab-<model-alias>.md
```

- `NN` — two-digit order prefix (preserve whatever the folder already uses).
- `descriptive-kebab` — kebab-case description. Normalize any existing underscores (`_prereq`, `_v2`) to kebab so the model suffix can live at the very end.
- `<model-alias>` — one of: `gpt-5.5`, `opus-4.7`, `sonnet-4.6`, `glm-5.1`. Must be the last token before `.md`.

Examples:

- `00-redesign-payment-flow-gpt-5.5.md` (1st Hardest → gpt-5.5 per 3:2 split)
- `01-rewrite-auth-middleware-opus-4.7.md` (4th Hardest → opus-4.7 per 3:2 split)
- `02-add-settings-panel-sonnet-4.6.md`
- `03-rename-legacy-fields-glm-5.1.md`

## Files You MUST Skip Renaming

Leave these alone — they're not part of the execution set:

- `README.md`, `TABLE-OF-CONTENTS.md`, `OVERVIEW.md`, anything already matching the reference-filename substrings in `prompt-executor/prompt_executor.py` (`overview`, `readme`, `table-of-contents`, `toc`, `index-of-prompts`, `architecture`, `reference`, `dependency-graph`).
- Files whose stem already ends with a recognized model alias (`-gpt-5.5`, `-opus-4.7`, `-sonnet-4.6`, `-glm-5.1`, `-opus`, `-sonnet`, `-haiku`, `-haiku-4.5`, `-glm`, `-glm-5`, `-glm-5-turbo`, `-glm-4.7`, `-glm-4.7-flash`, `-flash`). Skip them — assume someone already set the tier.
- Files already marked done with a `_done` or `_done.md` suffix.
- Meta-prompt / source documents (rename these to end with `-reference` so the executor auto-skips them, e.g. `00-original-meta-prompt.md` → `00-original-meta-prompt-reference.md`).

## Reference-Filename Pitfalls (IMPORTANT)

The executor's reference-file filter (`is_reference_file`) silently drops any file whose name contains these substrings (case-insensitive):

> `overview`, `readme`, `table-of-contents`, `toc`, `index-of-prompts`, `architecture`, `reference`, `dependency-graph`

If an executable file's description contains one of these words, the executor will skip it. **You must rename around the substring**, e.g.:

- `11-rules-architecture-agents-skills-changelog.md` → `11-rules-arch-agents-skills-changelog-glm-5.1.md` (replace `architecture` with `arch`).
- `07-api-reference-scaffold.md` → `07-api-ref-scaffold-sonnet-4.6.md` (replace `reference` with `ref`).

Check every proposed new filename against this substring list before confirming the rename.

## Workflow

### Phase 1 — Read the folder

1. List the target folder with `ls` (or `Glob` for `*.md`).
2. For each file, skip the ones in "Files You MUST Skip Renaming" above.
3. Read each remaining file's content (enough to understand scope — the first ~100 lines is usually sufficient; read more if needed).

### Phase 2 — Classify difficulty

For each file, decide **Hardest** / `sonnet-4.6` / `glm-5.1` using the rubric. Signals that push toward Hardest (gpt-5.5 / opus-4.7):

- Touches database schema, migrations, PAYG, Stripe, auth, feature flags across multiple surfaces.
- Introduces new abstractions used by 2+ subsystems.
- Security or data-integrity consequences if wrong.
- Novel algorithm design (not pattern-following).

Signals that push toward GLM:

- Pure markdown / rules / docs writes.
- Translation-file (`client/public/locales/*/*.json`) additions.
- Mechanical renames or field additions where the pattern is already visible in the codebase.

If none of the above clearly apply, default to `sonnet-4.6`.

#### Split rule for the Hardest tier (3:2 → gpt-5.5 / opus-4.7)

Once you've collected the set of files classified as Hardest, **enumerate them in their original numeric-prefix order** (the `NN-` at the start of each filename — not the order they appear in your scratchpad). Walk the list and assign:

| Position in Hardest set (1-indexed) | Alias       |
|-------------------------------------|-------------|
| 1                                   | `gpt-5.5`   |
| 2                                   | `gpt-5.5`   |
| 3                                   | `gpt-5.5`   |
| 4                                   | `opus-4.7`  |
| 5                                   | `opus-4.7`  |
| 6                                   | `gpt-5.5`   |
| 7                                   | `gpt-5.5`   |
| 8                                   | `gpt-5.5`   |
| 9                                   | `opus-4.7`  |
| 10                                  | `opus-4.7`  |
| … (cycle of 5: 3×gpt-5.5, 2×opus-4.7) | …         |

This is deterministic (anyone running the renamer on the same folder gets the same split), auditable (you can recount the suffixes in the proposed rename table), and load-balances roughly 60/40 across OpenAI Codex and Anthropic Claude. Tier-band quality is the same on both peers — see `prompts/dont-execute-me.md` and `.claude/skills/codex-cli/SKILL.md`.

If the user prefers all-Opus or all-gpt-5.5 for a specific batch, they can override during the Phase 3 approval step.

### Phase 3 — Propose renames

Build a table with three columns: old name, proposed new name, tier (with a one-line justification). Include any reference-filename substring fixes.

Present this table to the user via `AskUserQuestion` with options:

1. "Approve — rename all" (recommended)
2. "Adjust some" — user edits the mapping manually
3. "Abort"

Do not proceed without explicit approval.

### Phase 4 — Execute renames

Use `git mv` (not `mv`) so the move is tracked cleanly in git history. One `git mv` per file. Chain them with `&&` so the batch aborts on first failure.

### Phase 5 — Update the README (if present)

If the folder has a `README.md`, update:

- The execution-order table / list of files.
- Any dependency graph or cross-references.
- A short note that tiers are per-file and `--mode=auto` routes automatically, with a copy-paste run command:
  ```bash
  python3 prompt-executor/prompt_executor.py run prompts/<folder> --mode=auto
  ```

Leave the rest of the README intact.

### Phase 6 — Verify

Run these checks and show the user the output:

```bash
# Confirm every new name parses to the expected alias
docker exec -it serverless-main-app python3 -c "
import sys; sys.path.insert(0, '/workspace/prompt-executor')
import prompt_executor as pe
from pathlib import Path
folder = Path('/workspace/prompts/<folder>')
for p in sorted(folder.glob('*.md')):
    alias = pe.extract_model_from_filename(p)
    ref = pe.is_reference_file(p)
    print(f'{alias or \"(none)\":<12} ref={ref} {p.name}')
"
```

(Or run the equivalent from the prompt-executor venv directly if Docker isn't handy: `.venv/bin/python -c ...`.)

Confirm:

- Every intended-executable file resolves to an alias (`opus-4.7` / `sonnet-4.6` / `glm-5.1`).
- No intended-executable file is flagged as a reference (`ref=True`).
- `collect_pending_items(folder)` returns exactly the expected executable set.

If any check fails, fix the offending filename (reference-substring collision, typo in alias, missing suffix) and re-verify.

## Output Format for User Review

Before executing, present a table like this:

```
| # | Old name                                               | New name                                                          | Tier        | Why                                                         |
|---|--------------------------------------------------------|-------------------------------------------------------------------|-------------|-------------------------------------------------------------|
| 1 | 01-foo.md                                              | 01-foo-sonnet-4.6.md                                              | sonnet-4.6  | Standard feature wiring                                     |
| 2 | 02-migrate-billing-enum.md                             | 02-migrate-billing-enum-gpt-5.5.md                                | gpt-5.5     | 1st Hardest in batch — gpt-5.5 per 3:2 split                |
| 3 | 04-rewrite-auth-middleware.md                          | 04-rewrite-auth-middleware-opus-4.7.md                            | opus-4.7    | 4th Hardest in batch — opus-4.7 per 3:2 split               |
| 4 | 11-architecture-notes.md                               | 11-arch-notes-glm-5.1.md                                          | glm-5.1     | Docs only; renamed `architecture` → `arch`                  |
```

Plus a short note like:

> Will also rename `00-original-meta-prompt.md` → `00-original-meta-prompt-reference.md` so the executor skips it, and update `README.md` to reflect the new names.

## Constraints

- **No prompt-file content changes.** Only filenames and the README. Do not edit the body of any prompt file.
- **Use `git mv`**, not `mv`, so git preserves rename history (100% similarity).
- **Ask before renaming.** One batched approval via `AskUserQuestion`, no silent surprises.
- **Respect existing order prefixes.** Do not renumber files.
- **Respect existing tiers.** If a file already has a model suffix, leave it alone — someone deliberately picked that tier.
- **No new files.** Do not create additional prompt files — only rename and, at most, update one `README.md`.

## References

- Executor CLI and filename parser: `prompt-executor/prompt_executor/` (`extract_model_from_filename`, `is_reference_file`, `MODEL_ALIASES`, `SWAP_PAIRS` in `config.py`/`utils.py`).
- Filename convention authority: `prompts/dont-execute-me.md` § "Filename Convention (for auto-mode execution)".
- Codex CLI / gpt-5.5 routing reference: `.claude/skills/codex-cli/SKILL.md` (plus `references/prompt-executor-integration.md` for the exact `codex exec` argv).
- Worked example of a full renaming (14 files): `prompts/brand-assets-everywhere/` and its `README.md`.
