---
name: pr-fix-actions
description: Fix failing CI checks and GitHub Actions on a Pull Request.
---

# PR Fix: Actions

Fix failing CI checks and GitHub Actions on a Pull Request.

## Arguments

- `$ARGUMENTS`: Optional PR number or URL. If not provided, uses the current branch's PR.

## Task Tracking

**You MUST use the TaskCreate and TaskUpdate tools to track your progress.** At the start, create tasks for each step below. Mark each task as `in_progress` when you start it and `completed` when you finish. This ensures you complete ALL steps.

## Instructions

1. **Determine the PR to work on:**
   - If `$ARGUMENTS` contains a PR number or URL, use that
   - Otherwise, get the current branch's PR using `gh pr view --json number,url,title,body --jq '.'`
   - If no PR is found, inform the user and stop

2. **Check for failing CI checks:**

   ```
   gh pr checks <PR_NUMBER>
   ```

   Identify which checks are failing:
   - Lint/formatting checks
   - Unit tests
   - Build checks

3. **For failing lint/formatting checks:**
   - Run `npm run lint:fix` to auto-fix lint issues (if configured)
   - Manually fix remaining formatting issues
   - Review the changes made

4. **For failing unit tests:**
   - Run the failing tests locally to reproduce:
     ```
     npm test -- <test-file-pattern>
     ```
     (Run from `server/` directory — mocha is configured there)
   - Investigate the test failures
   - Fix the underlying code issues or update tests if the behavior change is intentional

5. **For failing build checks:**
   - Run the client build locally:
     ```bash
     cd client && npm start -- --env.production
     ```
     Or run the server build check:
     ```bash
     cd server && npm test
     ```
   - Fix any build errors that appear

6. **After making all fixes, verify:**
   - Run relevant unit tests: `npm test` (from `server/`)
   - Check for any lint issues
   - Verify the dev server starts cleanly

7. **Commit and push the changes:**

   If any changes were made:

   ```
   git add -A
   git commit -m "Fix failing CI checks

   - <summary of fix 1>
   - <summary of fix 2>
   ..."
   ```

   Then push the changes to the PR branch.

8. **Provide a summary to the user:**
   - List which checks were failing
   - Describe what was fixed for each
   - Note any checks that could not be fixed and require human attention
