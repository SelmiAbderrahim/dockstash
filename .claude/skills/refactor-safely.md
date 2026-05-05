---
name: Refactor Safely
description: Plan and execute safe refactoring with dependency analysis for the MERN stack
---

## Refactor Safely

Plan and execute refactoring with confidence using search-based dependency analysis.

### Steps

1. **Identify refactoring target:**
   - Use grep to find all usages of the symbol to rename or module to move:
     ```bash
     grep -rn "<symbol>" client/src/ server/src/ --include="*.js"
     ```

2. **Map dependencies before refactoring:**
   - Find all files importing the target module:
     ```bash
     grep -rn "require.*<module>" client/src/ server/src/ --include="*.js"
     ```
   - Check feature module boundaries (see `mern-feature-modules.md` rule).

3. **Preview changes:**
   - List every file and line that will change before making edits.
   - Group changes by risk: shared utilities (low), feature internals (medium), cross-feature exports (high).

4. **Execute the refactor:**
   - Make changes using edit operations, not full file rewrites.
   - Update JSDoc types if renaming affects Mongoose schemas or Redux actions.

5. **Verify after refactoring:**
   - Run server tests: `npm test` (from `server/`)
   - Search for stale references:
     ```bash
     grep -rn "<old-name>" client/src/ server/src/ --include="*.js"
     ```
   - Check that no `require()` calls point to deleted or moved files.

### Special Cases

#### Redux State Shape Changes
When refactoring a reducer's state shape:
1. Find all selectors that read from that slice (`grep -rn "state\.<slice>" client/src/`)
2. Find all `connect()` calls mapping the slice
3. Update selectors, then components, then tests

#### Mongoose Schema Changes
When refactoring a Mongoose schema:
1. Find all controller methods that query the model (`grep -rn "<Model>\." server/src/`)
2. Find all tests seeding data with the old shape
3. Check if a data migration is needed (field rename, default values)
4. Update the JSDoc `@typedef` alongside the schema (see `mern-mongoose-typed-schemas.md`)

#### Moving a Feature Module
When moving `features/<old>` to `features/<new>`:
1. Update the module's `index.js` re-exports
2. Find all consumers importing from the old path and update them
3. Verify no other feature was reaching into internals directly

### Safety Checks

- Always list affected files before editing.
- Run `npm test` after every non-trivial change.
- Never change a Mongoose schema's field names without checking for data in the database.
- Keep refactors small — one rename or one move per commit.
