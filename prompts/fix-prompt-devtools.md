# Fix Issue (with Chrome DevTools MCP)

Investigate, fix, and validate an issue in the ServerlessBase codebase using a real Chrome instance to reproduce the bug, scope the root cause from live evidence, and confirm the fix in the running browser. This is the heavyweight sibling of [`fix-prompt.md`](./fix-prompt.md) — use it whenever the bug is observable in the dashboard (UI regressions, hydration mismatches, network races, console errors, slow LCP/INP/CLS) instead of guessing from grep results.

## Issue / Task

```
