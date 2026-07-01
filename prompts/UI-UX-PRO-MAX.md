# Integrate ui-ux-pro-max-skill into Project Agent Tooling

Clone the `nextlevelbuilder/ui-ux-pro-max-skill` repository, copy its skills/agents/references into the project's `.claude/`, `.opencode/`, and `.cursor/` tooling directories (where they exist), update the relevant UI rules files to reference the new skill, then clean up the clone.

## Steps

### 1. Clone the Repository

- Before running, tell the user: "I'm about to clone `https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git` over the network into a temporary directory."
- Run: `git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git /tmp/ui-ux-pro-max-skill`
- If `/tmp/ui-ux-pro-max-skill` already exists, remove it first with `rm -rf /tmp/ui-ux-pro-max-skill` (confirm with user before this destructive action per CLAUDE.md rules).

### 2. Inspect the Cloned Repo

- Run `ls -la /tmp/ui-ux-pro-max-skill` and walk the tree to identify:
  - **Skills**: look for `skills/`, `.claude/skills/`, or top-level `SKILL.md` files
  - **Agents**: look for `agents/`, `.claude/agents/`, or `*.agent.md` files
  - **References**: look for `references/`, `docs/`, `assets/`, or similar
  - **Rules/Patterns**: look for `rules/`, `.claude/rules/`, or pattern docs
  - **License/Attribution**: `LICENSE`, `NOTICE`, `README.md`, `AUTHORS`
- Report the discovered structure before proceeding to copy.

### 3. Copy to Tooling Directories

For each of these destinations, check if the parent directory exists at `/home/serverlessbase/serverless-v2/`. **Skip any destination whose parent does not exist — do not create parent directories.**

| Parent Dir Check | Copy To (under `ui-ux-pro-max/` subdir) |
|---|---|
| `.claude/` exists (always) | `.claude/skills/ui-ux-pro-max/`, `.claude/agents/ui-ux-pro-max/`, `.claude/references/ui-ux-pro-max/` |
| `.opencode/` exists? | `.opencode/skills/ui-ux-pro-max/`, `.opencode/agents/ui-ux-pro-max/`, `.opencode/references/ui-ux-pro-max/` |
| `.cursor/` exists? (also check `.curosr/` typo) | `.cursor/skills/ui-ux-pro-max/`, `.cursor/agents/ui-ux-pro-max/`, `.cursor/references/ui-ux-pro-max/` |

Rules for copying:
- Use `cp -r` or `rsync -a` (not `mv` — the source must remain for multi-destination copy).
- Namespace everything under a `ui-ux-pro-max/` subdirectory inside each `skills/`, `agents/`, `references/` folder to avoid collisions with existing content.
- If a `ui-ux-pro-max/` subdirectory already exists in any destination, STOP and ask the user whether to overwrite or merge — do not silently clobber.
- Preserve `LICENSE`, `NOTICE`, and attribution files by copying them into `.claude/skills/ui-ux-pro-max/` (and other destinations) alongside the skill content.
- If the upstream repo uses a different internal layout (e.g., everything under `.claude/`), flatten appropriately so the final structure in each destination is `{dest}/skills/ui-ux-pro-max/...`, `{dest}/agents/ui-ux-pro-max/...`, `{dest}/references/ui-ux-pro-max/...`.

### 4. Update UI/Styling Rules Files

Add a short "see also" pointer (do NOT rewrite existing content) to the top of each of these files, just below the main heading:

- `/home/serverlessbase/serverless-v2/.claude/rules/uncodixify-ui.md`
- `/home/serverlessbase/serverless-v2/.claude/rules/service-component-patterns.md`
- `/home/serverlessbase/serverless-v2/.claude/rules/switch-component-styling.md`

Template for the pointer block:

```markdown
## See Also

For comprehensive UI/UX patterns beyond this rule, consult the **ui-ux-pro-max** skill at `.claude/skills/ui-ux-pro-max/SKILL.md`. Use it alongside (not instead of) this rule.
```

Also:
- Check for equivalent rules directories at `.opencode/rules/` and `.cursor/rules/` — if any of the three files above exist there, apply the same pointer update with the correct path prefix (`.opencode/skills/...` or `.cursor/skills/...`).
- Check `/home/serverlessbase/serverless-v2/CLAUDE.md` for a UI/styling section — if one exists, add a single-line reference to the new skill. Do NOT add it if no UI section exists.

### 5. Verify Each Copy

For every destination written to:
- Run `ls -R {destination}/ui-ux-pro-max/ | head -50` to confirm files landed.
- Count files in source vs destination using `find {path} -type f | wc -l` — they should match (per copied subtree).
- Confirm `SKILL.md` (or equivalent entry-point files) exist in each `skills/ui-ux-pro-max/` destination.
- Confirm license/attribution files are present.

### 6. Clean Up the Clone

- Confirm with the user: "Ready to delete `/tmp/ui-ux-pro-max-skill` now that copies are verified?"
- On confirmation, run `rm -rf /tmp/ui-ux-pro-max-skill`.
- **NEVER** run `rm -rf` against any path under `/home/serverlessbase/serverless-v2/` in this task.

### 7. Report Back

Produce a final summary containing:
- Source repo and commit SHA that was cloned
- Table of destinations written to, with file counts per destination
- List of rules files updated (full absolute paths)
- Confirmation that `/tmp/ui-ux-pro-max-skill` was deleted
- Any destinations that were skipped (because parent dir did not exist) and why
- Any warnings (collisions found, merges performed, etc.)

## Constraints

- **Network clone**: explain the `git clone` to the user before running it.
- **No `mv`**: use `cp -r` or `rsync -a` so the source survives for multi-destination copy.
- **`rm -rf` scope**: only permitted against `/tmp/ui-ux-pro-max-skill` (the clone). Confirm with the user before every `rm -rf` invocation per CLAUDE.md destructive-command rules.
- **No overwriting**: if `ui-ux-pro-max/` already exists in a destination, stop and ask the user.
- **No parent creation**: do not create `.opencode/` or `.cursor/` if they don't exist — skip those destinations silently (but report the skip).
- **Docker-only rule does NOT apply** here — this is meta-tooling maintenance, not application code.
- **Preserve rules content**: the rule-file updates are additive pointers only. Do not rewrite, reflow, or reformat existing rule text.
- **Preserve upstream attribution**: carry `LICENSE`, `NOTICE`, and `README.md` files alongside the skill content into each destination.
- Follow the repo's `.claude/rules/git-destructive-commands.md` — state each destructive command, its blast radius, and wait for explicit "yes" before running.

## Report Back

At the end, produce the summary described in step 7 as your final message. Include absolute paths, file counts, and any skipped or merged destinations so the user can verify correctness at a glance.
