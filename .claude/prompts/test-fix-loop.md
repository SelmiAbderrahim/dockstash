# Continuous Test-Fix Loop

Run the full test suite repeatedly, fixing every failure until 100% pass rate is achieved.

## Pre-Flight Checks

Before starting, verify the Docker environment is ready:

```bash
docker ps --filter "name=serverless-client" --format "{{.Names}}"
```

If `serverless-client` is not running, start it:

```bash
make start
```

Wait for the container to be healthy before proceeding.

## The Loop

Execute this loop until zero failures remain:

### Step 1: Run Tests

```bash
make test
```

If `make test` is not configured, fall back to:

```bash
docker exec -it serverless-client npm test 2>&1
```

**NEVER run `npm test` directly on the host machine. ALL commands go through Docker.**

### Step 2: Parse Results

From the test output, extract:

- **Total tests** run
- **Passing** count
- **Failing** count
- **Error** count
- Each failed test's **name**, **file path**, and **error message**

Maintain a running tally across iterations using TodoWrite:

| Metric | Value |
|--------|-------|
| Iteration | N |
| Total | X |
| Passing | Y |
| Failing | Z |
| Fixed this round | W |

If all tests pass, stop. Print the final tally and exit.

### Step 3: Investigate Each Failure

For each failed test, do the following in order:

1. **Read the test file** that contains the failing test
2. **Read the source file** that the test imports/exercises
3. **Check recent git changes** to the source file:
   ```bash
   git log --oneline -5 -- <source-file-path>
   git diff HEAD~3 -- <source-file-path>
   ```
4. **Determine root cause** - classify as one of:
   - **Source bug**: The source code has a defect; fix the source
   - **Test drift**: The test expectations are outdated or wrong; fix the test
   - **Import/config issue**: Missing dependency, wrong path, missing mock
   - **Type error**: TypeScript type mismatch
   - **Async issue**: Missing await, unresolved promise, race condition
   - **Environment issue**: Missing env var, Docker config problem

Use the `Explore` agent to find related files and understand code structure when the failure involves unfamiliar code paths.

### Step 4: Fix the Failure

Apply the fix to either the source code or the test file (whichever is the actual root cause). Follow these rules:

- Prefer editing existing files over creating new ones
- Maintain existing code style and conventions
- Use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`), never physical (`ml-*`, `mr-*`, `pl-*`, `pr-*`)
- Use `serverless-*` naming, never `dokploy-*`
- Never hardcode secrets or API keys
- Never add comments unless the fix requires explanation for future developers

Use the `coder` agent for implementing fixes when the change spans multiple files or requires significant refactoring.

### Step 5: Validate the Fix

After each fix, run the specific test file first for fast feedback:

```bash
docker exec -it serverless-client npx vitest run <test-file-path> 2>&1
```

If the specific test runner is not vitest, adapt to whatever the project uses (jest, etc.). Check `package.json` in the container to determine the test runner:

```bash
docker exec -it serverless-client cat package.json | grep -A5 '"scripts"'
```

### Step 6: Run Linting and Typecheck

After fixing, verify no new issues were introduced:

```bash
docker exec -it serverless-client npm run lint 2>&1
docker exec -it serverless-client npm run typecheck 2>&1
```

If lint or typecheck fails, fix those issues before moving to the next test failure.

### Step 7: Log the Fix

For each fix, record in the todo list:

- **Test name**: The failing test's describe/it block name
- **File changed**: Absolute path to the modified file
- **Root cause**: One-line description of what was wrong
- **Fix applied**: One-line description of what was changed
- **Status**: passed / still-failing / skipped

### Step 8: Handle Stuck Tests

If a test still fails after 3 fix attempts:

1. Mark it as `skipped` in the log
2. Move to the next failing test
3. After all other tests are fixed, come back to skipped tests with fresh context
4. On the second pass, if still stuck after 2 more attempts, report it as unresolvable with a detailed explanation of what was tried

### Step 9: Full Suite Re-Run

After fixing all individual failures (or skipping stuck ones), run the full suite again:

```bash
make test
```

If new failures appear (regressions from fixes), loop back to Step 2.

## Completion Criteria

The loop ends when:

- `make test` reports **0 failures, 0 errors**
- `npm run lint` passes (via Docker)
- `npm run typecheck` passes (via Docker)

## Final Report

When complete, output a summary:

```
## Test Fix Loop Complete

- **Iterations**: N
- **Total tests**: X
- **All passing**: Yes/No
- **Tests fixed**: Y
- **Tests skipped (unresolvable)**: Z

### Fixes Applied

| # | Test | File Changed | Root Cause | Fix |
|---|------|-------------|------------|-----|
| 1 | ... | ... | ... | ... |

### Skipped Tests (if any)

| Test | File | Attempts | Last Error |
|------|------|----------|------------|
| ... | ... | 5 | ... |
```

## Constraints Reminder

- **Docker-only**: Every command runs inside containers. No host execution.
- **Container check**: Always verify container exists before `docker exec`.
- **Root `.env` only**: Never create `.env` files in subdirectories.
- **No `dokploy-*`**: Use `serverless-*` naming everywhere.
- **RTL compliance**: Logical properties only (`ms-*`, `me-*`, `start-*`, `end-*`).
- **No unnecessary files**: Prefer editing existing files.
- **No comments in code**: Unless absolutely necessary for the fix.
- **Concurrent operations**: Batch independent file reads and bash commands in single messages.
