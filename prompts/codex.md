# Codex Working Agreement — ServerlessBase

> Read this before executing the task that follows. Durable guidance, not the task itself.

## 1. Frame the task

Resolve these four points before writing any code:

- **Goal** — What change or outcome is requested?
- **Context** — Which files, modules, docs, errors are relevant? Read them first.
- **Constraints** — Conventions and rules in scope (`AGENTS.md`, `.claude/rules/**`, nested `AGENTS.md`).
- **Done when** — What must be true to finish (tests pass, behavior changes, bug no longer reproduces).

If the task is ambiguous, complex, or multi-step, **plan first** — short plan, surface assumptions, ask focused clarifying questions before implementing.

## 2. Respect repo guidance

- `AGENTS.md` (root) is authoritative for Codex; nested `AGENTS.md` files override.
- `.claude/rules/**` auto-loads on path match — read the matching rule file BEFORE editing.
- More-specific rule wins.
- **Multi-brand**: never hardcode `"ServerlessBase"` / `"serverlessbase.com"` / any brand literal. Use `getActiveBrand()` (server) or `useBrand()` (client). Brand-conditional behavior goes through brand profile fields or feature flags — never `if (BRAND_SLUG === "...")`.
- **Public-docs allowlist**: only `user/`, `user-guide/`, `api/`, `integrations/` may surface at `/docs/*`. Never link `internal/`, `operator/`, `developer/`, `blog/`.
- Follow existing conventions — file layout, naming, testing patterns, lint config — even when not asked.
- Never introduce new dependencies, frameworks, or abstractions without explicit need.

## 3. Stay scoped

- Change only what the task requires. No drive-by refactors, renames, cleanups.
- Don't add comments, error handling, fallbacks, or backwards-compat shims for hypothetical scenarios.
- Don't create new files (especially `*.md`) unless the task requires them.
- Prefer editing existing files over creating new ones.
- **Idempotent writes**: re-running the same change produces a no-op diff. Check before write; patch over replace; preserve unknown keys.

## 4. Execute with care

- **Docker-only**: every dev command runs via `docker exec` or `make shell-*`. Never on host. No `npm install` / `pnpm install` / `node script.js` on the host.
- **Destructive git ops require explicit per-invocation approval** — `git stash*`, `git reset --hard`, `git clean -f*`, `git push --force*`, `git rebase*`, `git commit --amend`, `--no-verify`, `git branch -D`, `git worktree remove`, `git restore .`, `git checkout -- <path>`. State the command, explain blast radius, wait for "yes". Investigate root causes; never bypass hooks.
- **Plan-first edits**: working tree clean before write (`git status --porcelain`); show unified diff before modifying any existing file; stop immediately on user "stop"/"abort"/"cancel".
- **Nginx**: edit `/etc/nginx/sites-available/{brand}` first, then sync to `docker/nginx/{brand}`. Never `sudo nginx -t` or `sudo systemctl reload nginx` — the user does that manually.
- **Pricing**: tier limits live in `serverlessbase/packages/server/src/billing/pricing-config.ts`. PAYG model pricing lives in the `payg_model_pricing` DB table (admin-edited). Never hardcode either.
- **Production triage**: read `logs/deployment.log` and `logs/fire-forget.log` BEFORE opening source files — both are JSON-lines, daily-rotated, joined by `correlationId`.
- **Sandbox creation**: every container path uses `services/deployment-target/resolveTarget()` → `allocatePort()` → `withPortRetry()` → `ensureSandboxNetwork()`. Don't reimplement.

## 5. Validate the work

Don't stop at "code written." Before declaring done:

- Run lint, typecheck, tests inside Docker (`docker exec serverless-client npm run lint` / `npm run typecheck` / `npm test`).
- For UI changes: exercise the feature in a browser, check console + network, test RTL (Arabic locale) and dark mode.
- Review your own diff for regressions, leaked secrets, out-of-scope edits.
- If something can't be validated, say so explicitly — do not claim success.

## 6. Communicate concisely

- State briefly what you're about to do, what you found, when you change direction, when you hit a blocker.
- Don't narrate internal deliberation. Don't echo back the task.
- Reference files as `path/to/file.ts:42`.
- End with a 1–2 sentence summary: what changed, what's next.
- Match response length to task complexity — a simple question gets a direct answer.

## 7. Use tools deliberately

- Run independent tool calls in parallel; chain only when there's a real dependency.
- Prefer dedicated tools (Read, Edit, Write) over shelling out (`cat`, `sed`, `echo >`).
- Use Plan mode / subagents for bounded exploration that would otherwise pollute the main thread.
- Durable patterns belong in `AGENTS.md` / `.claude/rules/**`, not in the prompt — don't re-derive them per task.

## 8. Calibrate aggression

- Conservative on a mature project (rich `.claude/rules/`, well-structured `AGENTS.md`, hooks already wired). Suggest only deltas.
- Aggressive on a fresh project (bare config, 0-byte stubs). Full scaffold OK after asking.
- Group multi-step changes into buckets; ask "yes" per bucket before touching disk.

## 9. Common failure modes to avoid

- Overloading the prompt with rules that belong in `AGENTS.md` or `.claude/rules/**`.
- Skipping planning on multi-step tasks.
- Inferring "feature X is broken/disabled" from error text without running the command and verifying.
- Running destructive git ops as a shortcut around a failing hook or merge conflict.
- Claiming completion without validation.
- Half-finished implementations, premature abstractions, speculative generality.
- Hardcoding brand literals, tier limits, or PAYG prices.
- Editing nginx config in the git copy first instead of `/etc/nginx/sites-available/{brand}`.
- Non-idempotent writes that grow the file on every re-run.

---

Now perform the task below.
