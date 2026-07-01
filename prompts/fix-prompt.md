# Fix Issue

Investigate, fix, test, and validate an issue in the ServerlessBase codebase.

## Issue / Task

```

```

- `$GITHUB_ISSUE` — Optional. GitHub issue number (e.g., `#142`).
- `$AFFECTED_FILES` — Optional. Known affected files or areas.
- `$REPRO_STEPS` — Optional. Steps to reproduce.

---

## Phase 1: Investigation

1. **Context** — Read relevant `.claude/rules/*.md`, `.claude/agents/`, `ARCHITECTURE.md`.
2. **Explore** — Use graph MCP tools first (`semantic_search_nodes`, `query_graph`, `get_impact_radius`), then Grep/Glob/Read. Trace: route → component → hook → service → tRPC → backend → DB.
3. **Root cause** — Identify the root cause, not the symptom. Check git history if needed.

**STOP.** Present before coding:

1. **Root cause** — What is broken and why.
2. **Affected files** — Every file that needs changes.
3. **Proposed fix** — What to change and how.
4. **Risk assessment** — What else could break (use `get_impact_radius`).
5. **Test plan** — How to verify the fix.

Wait for user approval.

---

## Phase 2: Implement the Fix

### Mandatory Constraints

#### Execution

| Rule | Detail |
|------|--------|
| Docker-only | ALL commands via `docker exec -it serverless-client ...` or `make shell-*`. NEVER on host. |
| Naming | `serverless-*` prefix. NEVER `dokploy-*`. |
| Environment | Root `.env` only. NEVER subdirectory `.env` files. |

#### Frontend (if UI changes)

| Rule | Detail |
|------|--------|
| RTL | Logical CSS only (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start/end`, `start-*/end-*`). NEVER physical (`ml-*`, `mr-*`, `text-left/right`). NEVER `rtl:flex-row-reverse`. Icons: `rtl:scale-x-[-1]`. |
| i18n | All strings in 5 languages (`en`, `ar`, `fr`, `de`, `es`). Interpolation vars must match. |
| Dark mode | Semantic tokens only (`bg-card`, `text-foreground`). NEVER hardcode hex/rgb. |
| Touch/Mobile | Min 44x44px targets. Mobile-first (`sm:` → `md:` → `lg:`). |
| Tabs | Persist in URL via `validateSearch` + `navigate({ replace: true })`. |
| Switch | NEVER `min-h-[44px]` on Switch directly. Use parent container. |

#### Data Layer (if API/data changes)

| Rule | Detail |
|------|--------|
| Query keys | Use factory from `queryKeys.ts`. NEVER ad-hoc keys. |
| Service layer | Use `trpcQuery`/`trpcMutation` from `@/lib/api/dokploy`. |
| Errors | `isApiError()` on frontend. i18n helpers (`notFoundError`, etc.) on backend. |

#### Styling (Uncodixify)

| Rule | Detail |
|------|--------|
| No lift/glow | NEVER `hover:-translate-y-*`, `hover:shadow-md`, `animate-pulse` on badges, `transition-all`, gradients. |
| Radius/duration | `rounded-md` buttons, `rounded-lg` cards. Max `duration-200`. |

### Steps

1. Read each file before editing — match existing patterns.
2. Make minimal, targeted changes — don't refactor unrelated code.
3. If UI strings added: verify keys exist in all 5 locale files with matching `{{vars}}`.

---

## Phase 3: Test & Validate

```bash
docker exec -it serverless-client npm run typecheck
docker exec -it serverless-client npm run lint
docker exec -it serverless-client npm test  # if available
```

Fix any failures before proceeding.

### Verification Checklist

- [ ] Original issue is resolved
- [ ] No console errors, no new TS/lint errors
- [ ] **RTL**: Arabic layout correct, icons mirror
- [ ] **Dark mode**: Semantic tokens, no white flashes
- [ ] **Mobile**: Usable at 375px, touch targets 44px+
- [ ] **Data**: Loads on init, refreshes after mutations, error/loading states work

---

## Phase 4: Documentation (skip for trivial fixes)

| Condition | Action |
|-----------|--------|
| New pattern others should follow | Add/update `.claude/rules/*.md` |
| Architecture change | Update `ARCHITECTURE.md` |
| Agent/skill domain change | Update `.claude/agents/` or `.claude/skills/` |

---

## Completion Summary

1. **Issue** — What was broken
2. **Root cause** — Why
3. **Fix** — Files changed (with line numbers)
4. **Tests** — Added/modified
5. **Validation** — typecheck + lint pass
6. **Docs** — Updated (if any)
