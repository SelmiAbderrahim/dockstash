---
name: Review Changes
description: Perform a structured code review using change detection and impact analysis for the MERN stack
---

## Review Changes

Perform a thorough, risk-aware code review on the current diff.

### Steps

1. **Gather the diff:**
   ```bash
   git diff --stat
   git diff
   ```

2. **Identify high-risk areas:**
   - Changes to `server/src/modules/<feature>/model.js` (Mongoose schemas)
   - Changes to Redux reducers (`client/src/features/<feature>/reducer.js`)
   - Changes to Express route handlers (`server/src/modules/<feature>/controller.js`)
   - Changes to shared middleware (`server/src/shared/middleware/`)
   - Changes to `server/src/shared/config/` (configuration)

3. **Check test coverage for each changed module:**
   ```bash
   find server/tests -name "*<feature>*" -type f
   ```
   If no test files exist for a changed module, flag it as untested.

4. **Trace impact radius:**
   - Use grep to find all imports of changed modules:
     ```bash
     grep -rn "require.*<changed-module>" client/src/ server/src/
     grep -rn "from.*<changed-module>" client/src/ server/src/
     ```
   - Check if changed component exports are used in other features:
     ```bash
     grep -rn "<ComponentName>" client/src/features/
     ```

5. **Validate against project rules** (see `.claude/rules/`):
   - No cross-feature internal imports (`mern-feature-modules.md`)
   - No default exports (`mern-no-default-exports.md`)
   - Schema types present on all Mongoose models (`mern-mongoose-typed-schemas.md`)
   - No hardcoded URLs (`site-url-env-pattern.md`)
   - Environment variables in root `.env` only (`environment-variables.md`)

### Output Format

Provide findings grouped by risk level (high/medium/low) with:
- What changed and why it matters
- Test coverage status
- Rule violations found
- Suggested improvements
- Overall merge recommendation
