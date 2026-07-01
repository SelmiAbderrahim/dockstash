# Integrate code-review-graph for AI-Assisted Code Review

| Field | Value |
| ----- | ----- |
| Source | <https://github.com/tirth8205/code-review-graph> |
| Target | Any project root |
| Purpose | Install, build, and maintain a structural code review graph that reduces AI token usage during code review and navigation |
| Priority | High |
| Estimated Hours | 1–3 (varies by repo size) |
| Dependencies | Python 3.10+, one of `uvx`/`pipx`/`pip`, `git`, `make` (optional but recommended) |
| Agents | general-purpose, devops-engineer |
| Skills | none required |

## Overview

`code-review-graph` is a Python CLI tool that builds a Tree-sitter AST graph of a repository and persists it locally in a SQLite database under `.code-review-graph/`. It exposes 22 MCP tools to AI assistants (Claude Code, Codex, Cursor, Windsurf, Zed, Continue, OpenCode, Antigravity) so that code review, blast-radius analysis, semantic search, and architecture queries run against a compact structural graph instead of raw file dumps. The published benchmark shows an 8.2x average token reduction across six real repositories, with 100% recall and 0.54 F1 on impact accuracy. It supports 19 languages plus Jupyter/Databricks notebooks: Python, TypeScript, TSX, JavaScript, Vue, Go, Rust, Java, Scala, C#, Ruby, Kotlin, Swift, PHP, Solidity, C/C++, Dart, R, Perl, Lua, and `.ipynb`.

This prompt walks an agent through a complete, repeatable integration: inventory the project, decide include and exclude lists, install the CLI and wire it into the active AI assistant's MCP configuration, run the initial build (which can be long), add Makefile targets for day-to-day maintenance, and verify the installation with a smoke test. After completing this playbook, every subsequent AI-assisted code review in the project benefits from a pre-computed structural index that is incrementally updated in under two seconds per change.

## Requirements

### 1. Inventory the Project

- [ ] Detect source languages by scanning for file extensions: `.py`, `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.go`, `.rs`, `.java`, `.scala`, `.cs`, `.rb`, `.kt`, `.swift`, `.php`, `.sol`, `.c`, `.h`, `.cpp`, `.hpp`, `.dart`, `.r`, `.pl`, `.lua`, `.ipynb`
- [ ] Detect package and build manifests: `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, `poetry.lock`, `Cargo.toml`, `go.mod`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `Package.swift`, `mix.exs`
- [ ] Produce a 2-level tree of the repository:

  ```bash
  tree -L 2 -I 'node_modules|.git|dist|build|.venv|__pycache__|target|vendor'
  ```

  If `tree` is not installed, fall back to `find . -maxdepth 2 -type d` or `ls -la` at each level
- [ ] Report total file count and approximate lines of code per detected language
- [ ] Identify monorepo boundaries such as `packages/*`, `apps/*`, `services/*`, `crates/*`, `modules/*`
- [ ] Write the inventory summary to `.code-review-graph/inventory.md` so future runs can compare against it

### 2. Determine Include / Exclude Lists

- [ ] Start from the project's existing `.gitignore` as the baseline exclusion list
- [ ] Default includes: every source directory for a detected language, typically `src/`, `lib/`, `app/`, `packages/*/src/`, `apps/*/src/`, and root-level source files
- [ ] Default excludes:
  - Dependency and vendor trees: `node_modules/`, `.venv/`, `venv/`, `env/`, `vendor/`, `target/`, `__pycache__/`
  - Build artifacts: `dist/`, `build/`, `out/`, `.next/`, `.nuxt/`, `coverage/`, `.cache/`, `.turbo/`, `tmp/`
  - Editor and VCS: `.git/`, `.idea/`, `.vscode/`
  - Test fixtures and snapshots: `*.snap`, `__snapshots__/`, fixture directories
  - Lockfiles: `*.lock`, `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`
  - Generated code: `*.generated.*`, `*.pb.go`, `*_pb2.py`
  - Minified bundles: `*.min.js`, `*.min.css`
  - Binary assets: images, fonts, archives, media files
- [ ] Apply a large-file heuristic: skip any file larger than 1 MB or longer than 10,000 lines — these add noise and low signal to graph-based review
- [ ] Record the final configuration at `.code-review-graph/config.json` (or the tool's native config location) with a short rationale comment for each non-default entry
- [ ] Note that include/exclude lists should be revisited after the first build: observe which files add noise, then prune and rebuild

### 3. Install code-review-graph

- [ ] Choose an installer in this order of preference:
  1. `uvx code-review-graph <subcommand>` — zero global footprint, recommended
  2. `pipx install code-review-graph` — isolated user install
  3. `pip install --user code-review-graph` — last resort
- [ ] Verify Python 3.10 or newer is available: `python3 --version`
- [ ] Run the MCP auto-configuration step:

  ```bash
  code-review-graph install
  ```

  This auto-detects and configures any supported assistant present on the machine: Codex, Claude Code, Cursor, Windsurf, Zed, Continue, OpenCode, Antigravity
- [ ] To target a single platform instead, use the `--platform` flag:

  ```bash
  code-review-graph install --platform claude-code
  ```

- [ ] Verify the MCP configuration file for the target tool was written (for example, the Claude Code MCP settings file or `.cursor/mcp.json`)
- [ ] Restart the editor or assistant so the MCP server is loaded into the session

### 4. Build the Initial Graph (long-running)

- [ ] Run the initial build from the repository root:

  ```bash
  code-review-graph build
  ```

- [ ] **IMPORTANT: The first build can take several minutes on medium-to-large repositories and significantly longer on very large monorepos. Do NOT abort it.** Stream output, keep the session alive, and treat long silences as normal progress
- [ ] If the build appears to hang, inspect `.code-review-graph/` for partial state and resume with `code-review-graph build` rather than restarting from scratch
- [ ] On transient failures (network issues during MCP install, disk pressure, tree-sitter grammar download), retry the build
- [ ] Verify on success:
  - [ ] `.code-review-graph/graph.db` exists and is non-empty
  - [ ] `code-review-graph status` reports a non-zero node count and a non-zero edge count
- [ ] Record the initial node and edge counts in `.code-review-graph/inventory.md` for future regression checks

### 5. Add Makefile Targets

Append a `## CODE REVIEW GRAPH` section to the project's `Makefile`. If no Makefile exists, create one. Follow any existing project conventions, which typically include `.PHONY:` declarations and `##` help comments for `make help` extraction. Add these targets verbatim (Makefile recipes require hard tabs, not spaces — preserve the indentation exactly when copying):

<!-- markdownlint-disable MD010 -->
```makefile
## CODE REVIEW GRAPH

.PHONY: graph-install graph-build graph-update graph-watch graph-status graph-search graph-eval graph-viz graph-clean graph-recheck graph-help

graph-install: ## Install code-review-graph and configure MCP for detected AI tools
	@echo "Installing code-review-graph..."
	@if command -v uvx >/dev/null 2>&1; then \
		uvx code-review-graph install; \
	elif command -v pipx >/dev/null 2>&1; then \
		pipx install code-review-graph && code-review-graph install; \
	else \
		pip install --user code-review-graph && code-review-graph install; \
	fi

graph-build: ## Build the initial code review graph (first run may take several minutes)
	@echo "Building code review graph (this may take a while on the first run)..."
	code-review-graph build

graph-update: ## Incremental re-index of changed files (fast, <2s typical)
	@echo "Updating code review graph..."
	code-review-graph build --update

graph-recheck: ## Force a full rescan of the codebase (slower than graph-update)
	@echo "Re-checking entire codebase..."
	code-review-graph build --full

graph-watch: ## Continuous watch mode: keep the graph fresh as files change
	code-review-graph watch

graph-status: ## Print graph statistics (nodes, edges, languages, last update)
	code-review-graph status

graph-search: ## Search the graph. Usage: make graph-search Q="auth flow"
	@test -n "$(Q)" || (echo "Usage: make graph-search Q=\"your query\""; exit 1)
	code-review-graph search "$(Q)"

graph-eval: ## Run the token-reduction benchmark against recent commits
	code-review-graph eval --all

graph-viz: ## Launch the interactive D3.js graph visualization
	code-review-graph viz

graph-clean: ## Remove the local graph database (next build will be from scratch)
	rm -rf .code-review-graph

graph-help: ## Show all code-review-graph commands
	code-review-graph --help
```
<!-- markdownlint-enable MD010 -->

Post-add tasks:

- [ ] Run `make graph-status` to confirm the wiring works end-to-end
- [ ] If the project uses Python, Node, or Cargo workspaces, note that `make graph-update` is safe to run in CI after every merge

### 6. Verify and Smoke Test

- [ ] `make graph-status` reports non-zero node and edge counts
- [ ] `make graph-search Q="<a well-known symbol in the repo>"` returns at least one result
- [ ] From the AI assistant, invoke a blast-radius query on a recently changed file and confirm the returned file set is scoped — it should not span the entire repository
- [ ] Add `.code-review-graph/` to the project's `.gitignore`; the database is local and regenerable
- [ ] Optional: add a short note to `CONTRIBUTING.md` or `README.md` pointing developers at the `make graph-*` commands

### 7. Keep It Alive

- [ ] Document `graph-update`, `graph-watch`, and `graph-recheck` in the project README
- [ ] Wire `make graph-update` into a git `post-commit` hook (or equivalent) so every commit keeps the graph fresh:

  ```bash
  echo 'make graph-update >/dev/null 2>&1 || true' >> .git/hooks/post-commit
  chmod +x .git/hooks/post-commit
  ```

- [ ] Add `make graph-update` to CI on pull-request builds to catch drift between branches
- [ ] Record initial benchmark numbers from `make graph-eval` in `.code-review-graph/inventory.md` so future regressions are visible

## Useful Commands Reference

| Task | CLI | Make target |
| ---- | --- | ----------- |
| Install CLI and configure MCP | `code-review-graph install` | `make graph-install` |
| Initial build | `code-review-graph build` | `make graph-build` |
| Incremental update | `code-review-graph build --update` | `make graph-update` |
| Full re-scan | `code-review-graph build --full` | `make graph-recheck` |
| Watch mode | `code-review-graph watch` | `make graph-watch` |
| Status and statistics | `code-review-graph status` | `make graph-status` |
| Search | `code-review-graph search "<query>"` | `make graph-search Q="<query>"` |
| Token-reduction benchmark | `code-review-graph eval --all` | `make graph-eval` |
| Interactive visualization | `code-review-graph viz` | `make graph-viz` |
| Remove local graph database | `rm -rf .code-review-graph` | `make graph-clean` |

## Troubleshooting

- **First build appears to hang.** This is expected on large repositories. Check that disk space is available and that `.code-review-graph/` is receiving writes. Do not abort — resume with `code-review-graph build` if the process is interrupted.
- **MCP server not loading in the editor.** Restart the editor fully, verify the MCP configuration file was written at the expected path for that tool, and re-run `code-review-graph install --platform <name>` to regenerate it.
- **A language is missing from the graph.** Confirm that the language has Tree-sitter grammar support in the installed version of `code-review-graph` and that the source files are located inside an included path. Re-run `make graph-recheck` after adjusting includes.
- **Too many or too few files indexed.** Iterate on `.code-review-graph/config.json` includes and excludes, then run `make graph-recheck` to rebuild from the updated configuration.
- **`code-review-graph: command not found`.** The CLI was installed via `pip install --user` but `~/.local/bin` is not on `PATH`. Either add it to `PATH` or switch to `uvx code-review-graph` / `pipx install code-review-graph`.
- **Graph drift after a large merge.** Run `make graph-recheck` to force a full rescan rather than relying on incremental updates.

## Success Criteria

- [ ] `code-review-graph` is on `PATH` or invocable via `uvx`
- [ ] MCP configuration file has been written for at least one AI assistant
- [ ] The assistant has been restarted and can see the new MCP server
- [ ] Initial build completed and `.code-review-graph/graph.db` exists and is non-empty
- [ ] `.code-review-graph/inventory.md` records languages, file counts, and initial node/edge counts
- [ ] Project `Makefile` contains the `graph-*` targets and they all parse
- [ ] `.gitignore` excludes `.code-review-graph/`
- [ ] `make graph-status` reports non-zero nodes and edges
- [ ] A smoke-test search via `make graph-search` returns at least one result
- [ ] A blast-radius query from the AI assistant returns a scoped file set rather than the full repository
- [ ] Incremental updates are wired into a git hook or CI step so the graph stays fresh over time
