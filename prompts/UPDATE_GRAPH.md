# Update the code-review-graph for the Current Project

| Field | Value |
| ----- | ----- |
| Source | <https://github.com/tirth8205/code-review-graph> |
| Target | Any project root that has already been bootstrapped via `prompts/GRAPH.md` |
| Purpose | Refresh the local code review graph so it reflects every commit, branch switch, dependency bump, and large refactor since the last build |
| Priority | Medium (run on every meaningful diff) |
| Estimated Hours | 0.05–0.5 (incremental update is typically <2s; full rescan grows with repo size) |
| Dependencies | A working `code-review-graph` install on `PATH` (or via `uvx`), a populated `.code-review-graph/` directory, a clean or known working tree |
| Agents | general-purpose, devops-engineer |
| Skills | none required |

## Overview

`prompts/GRAPH.md` is the one-time install playbook: it inventories the project, writes the include / exclude lists, configures MCP for the active AI assistants, runs the first build, and wires up Makefile targets. This prompt is the **maintenance** counterpart: it keeps the local `.code-review-graph/graph.db` in step with the working tree so every subsequent AI-assisted code review, blast-radius query, and semantic search reads against current structure rather than a snapshot from days or weeks ago.

A stale graph silently degrades AI review quality — symbols get re-resolved against deleted files, blast-radius queries miss new call sites, and semantic search returns hits in code that no longer exists. The fix is cheap: incremental updates run in under two seconds for typical commits and the toolchain is fully idempotent (re-running an update on an unchanged tree is a no-op). The cost of skipping it is invisible until a wrong review recommendation lands in a PR.

This playbook covers the full update lifecycle: detect drift, choose the right update mode (incremental vs. full rescan), refresh the graph, verify the result, and re-record benchmark numbers if anything material changed. It is safe to re-run on every commit, every branch switch, and every dependency bump.

## Requirements

### 1. Pre-flight Checks

- [ ] Confirm the project has already been bootstrapped: `.code-review-graph/graph.db` exists and `code-review-graph status` reports a non-zero node count
- [ ] If those preconditions are missing, **stop and run `prompts/GRAPH.md` first** — this prompt is for projects that already have a graph
- [ ] Verify the CLI is reachable: `code-review-graph --version` (or `uvx code-review-graph --version`)
- [ ] Run `git status --porcelain` and record the result. A non-empty working tree is fine for an update — the graph reads files from disk, not from git — but note any uncommitted changes so the operator knows the update reflects working-tree state, not committed state
- [ ] Read `.code-review-graph/inventory.md` and capture the previously recorded node and edge counts as a baseline for regression checks at the end
- [ ] Confirm sufficient disk space: incremental updates rewrite portions of `.code-review-graph/graph.db`, full rescans may temporarily double the database size

### 2. Detect What Changed

Identifying drift before running the update lets you pick the cheaper command and helps catch surprises (e.g., a generated-code commit that should have been on the exclude list).

- [ ] Diff against the last commit included in the graph. If there is no recorded marker, diff the full working tree:

  ```bash
  git log -n 1 --format='%H' > /tmp/graph-last-tip
  git diff --name-only "$(cat .code-review-graph/last-build-sha 2>/dev/null || echo HEAD~10)" HEAD
  ```

- [ ] Categorise the changed paths:
  - **Source files in indexed languages** → incremental update will pick them up
  - **New top-level directories** → may need to be added to includes
  - **Deleted directories** → graph nodes will be marked stale; incremental update handles this
  - **Lockfile or manifest changes** (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`) → no graph effect, but note for inventory
  - **Files in excluded paths that look interesting** (e.g., a new `apps/whatever/`) → revisit `.code-review-graph/config.json` before updating
- [ ] If the change set spans more than ~30% of the source tree (large refactor, monorepo split, mass rename, generated-code drop), prefer a full rescan over incremental — incremental updates have higher overhead per-file and the consolidation work is no longer cheaper

### 3. Decide on Update Mode

Pick one. The default is incremental.

| Mode | Command | When to use |
| ---- | ------- | ----------- |
| Incremental | `code-review-graph build --update` (or `make graph-update`) | Default. Single commit, small set of file changes, no structural surprises |
| Full rescan | `code-review-graph build --full` (or `make graph-recheck`) | Large merge, mass rename, includes/excludes changed, suspected drift, post-rebase, post-cherry-pick storm |
| Watch | `code-review-graph watch` (or `make graph-watch`) | Active development session — keeps the graph fresh continuously while you work |
| Recover | `make graph-clean && make graph-build` | Database corruption, version mismatch after a CLI upgrade, unexplained query failures |

- [ ] If `.code-review-graph/config.json` (or its native equivalent) was edited since the last build, you MUST run a full rescan — incremental updates cannot retroactively re-apply include/exclude changes
- [ ] If the CLI version changed (`code-review-graph --version`) since the last build, run a full rescan — schema migrations between versions can leave stale node types behind

### 4. Run the Update (long-running for full rescans)

- [ ] Execute the chosen mode:

  ```bash
  # Incremental (typical case)
  code-review-graph build --update

  # Full rescan (when justified by step 3)
  code-review-graph build --full
  ```

- [ ] **IMPORTANT: Full rescans on large monorepos can take several minutes (or longer). Do NOT abort.** Stream output, treat long silences as normal progress, and resume rather than restart on interruption
- [ ] Incremental updates should complete in seconds. If an incremental update runs longer than ~30 seconds on a small commit, something is off — check disk space, check whether the CLI was upgraded mid-run, and consider falling back to a full rescan
- [ ] On transient failures (tree-sitter grammar download, disk pressure), retry. If failures repeat, run `make graph-clean && make graph-build` to rebuild from scratch
- [ ] Record the post-update commit SHA so the next run knows where to diff from:

  ```bash
  git rev-parse HEAD > .code-review-graph/last-build-sha
  ```

### 5. Verify the Refresh

- [ ] `code-review-graph status` reports updated counts and a recent timestamp for "last update"
- [ ] Spot-check a symbol introduced or modified in this update via `make graph-search Q="<new-symbol>"`. The result should include the file you just changed
- [ ] If the change set deleted a symbol, search for it and confirm zero results — a stale hit means the update did not register the deletion, and a full rescan is warranted
- [ ] Compare the new node and edge counts against the baseline recorded in step 1:
  - Small delta on a small commit → expected
  - Large negative delta (many fewer nodes) on a small commit → likely indicates the update silently dropped indexed content; investigate
  - Large positive delta on a small commit → likely indicates an excluded path is now being indexed; revisit `.code-review-graph/config.json`
- [ ] From the AI assistant, run a blast-radius query on a file that was changed in the update. The returned set should include the new call sites — if it does not, the assistant is reading a stale graph and the editor likely needs a restart so the MCP server picks up the refreshed database

### 6. Update Inventory and Benchmarks

- [ ] Append a dated entry to `.code-review-graph/inventory.md` with:
  - The commit SHA (or working-tree state) the update was run against
  - The chosen mode (incremental, full, recover)
  - Old and new node and edge counts
  - Any notable changes to includes / excludes
  - Any anomalies caught during verification
- [ ] If a full rescan ran, also re-run the token-reduction benchmark and record the result so future regressions are visible:

  ```bash
  make graph-eval
  ```

- [ ] Incremental updates do not require a fresh benchmark — the metric is dominated by graph structure, not by a few file changes

### 7. Keep It Fresh Between Runs

- [ ] Confirm the `post-commit` git hook from `prompts/GRAPH.md` is still installed and executable:

  ```bash
  test -x .git/hooks/post-commit && grep -q graph-update .git/hooks/post-commit && echo OK
  ```

- [ ] Confirm CI runs `make graph-update` on pull-request builds. If it does not, add it to the appropriate pipeline file
- [ ] Encourage `make graph-watch` during active development so the graph stays fresh without manual intervention
- [ ] On every dependency bump that changes language versions (e.g., Python 3.10 → 3.12, Node 18 → 22, Rust edition change), schedule a full rescan — Tree-sitter grammar behaviour can shift between language versions

## Useful Commands Reference

| Task | CLI | Make target |
| ---- | --- | ----------- |
| Incremental update | `code-review-graph build --update` | `make graph-update` |
| Full re-scan | `code-review-graph build --full` | `make graph-recheck` |
| Watch mode (live updates) | `code-review-graph watch` | `make graph-watch` |
| Status and statistics | `code-review-graph status` | `make graph-status` |
| Search to verify | `code-review-graph search "<query>"` | `make graph-search Q="<query>"` |
| Token-reduction benchmark | `code-review-graph eval --all` | `make graph-eval` |
| Clean + rebuild (recovery) | `rm -rf .code-review-graph && code-review-graph build` | `make graph-clean && make graph-build` |

## Troubleshooting

- **Incremental update reports "no changes" but the working tree clearly differs.** The CLI matches against its own internal change-tracking, not git. Fall back to `make graph-recheck` to force a full rescan.
- **Search returns hits in deleted files.** Stale graph state. Run `make graph-recheck`. If the problem persists, run `make graph-clean && make graph-build`.
- **Node count dropped after an incremental update on a small commit.** Inspect `.code-review-graph/config.json` for include/exclude drift — a small commit should not produce a large structural change. Revert any unintended config changes and run `make graph-recheck`.
- **AI assistant returns blast-radius results that ignore today's changes.** The MCP server is holding an open handle to a pre-update database snapshot. Restart the editor or assistant fully and re-issue the query.
- **Update silently fails after a CLI upgrade.** Schema mismatch. Run `make graph-clean && make graph-build` to rebuild against the new CLI version.
- **Full rescan exceeds available disk.** Free space first; the rescan can temporarily require up to ~2x the existing database size. As a temporary workaround, prune very large generated files via the exclude list before retrying.
- **`code-review-graph: command not found` after it worked yesterday.** A `pip install --user` install fell off `PATH` because the shell environment changed. Switch to `uvx code-review-graph` for a stable invocation path.

## Success Criteria

- [ ] An update mode was chosen deliberately based on the change set, not by reflex
- [ ] `.code-review-graph/graph.db` was modified during this run (timestamp newer than before) for any non-empty change set
- [ ] `code-review-graph status` reports a recent "last update" timestamp and plausible node/edge counts relative to the baseline
- [ ] A spot-check search confirms newly-changed symbols are findable; deleted symbols are not
- [ ] `.code-review-graph/last-build-sha` records the commit the update was anchored to (or notes "working-tree" for dirty trees)
- [ ] `.code-review-graph/inventory.md` has a fresh dated entry describing what changed
- [ ] On full rescans, a fresh benchmark number is recorded
- [ ] The AI assistant returns blast-radius results that include today's modifications, confirming the MCP server picked up the refreshed database
- [ ] Post-commit hook and CI integration remain wired so the next update is as cheap as today's
