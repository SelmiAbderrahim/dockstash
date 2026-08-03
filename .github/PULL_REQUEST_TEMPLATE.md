<!--
Thanks for contributing. Fill this in honestly — an unchecked box with a note is
far more useful than a checked one that isn't true.
-->

## What this changes

<!-- One or two sentences. Link the issue it closes, if there is one. -->

Closes #

## Why

<!-- The problem behind the change. Skip if the "what" already says it. -->

## Gates

All commands run inside Docker (see CONTRIBUTING.md §1 — bare `npm` on the host
will not match CI).

- [ ] `npm run typecheck` passes for every package I touched
- [ ] `npm run lint` passes
- [ ] `npx vitest run --coverage` passes and coverage still reports **100%** on
      lines / branches / functions / statements
- [ ] `npm audit --audit-level=high` is clean
- [ ] `docker compose config` parses and the stack still boots (`make wait-healthy`)
      — only if this touches compose, env, or a Dockerfile

## Checklist

- [ ] Tests added or updated alongside the code (source and tests deleted
      together, if this removes something)
- [ ] Docs updated in this PR if behavior changed
- [ ] `CHANGELOG.md` entry added for anything user-visible
- [ ] If an env var was added or removed, all three are updated:
      `.env.example`, `server/src/config/env.ts`, `docker-compose.yml`
- [ ] If i18n keys changed, all seven locales updated (`en, ar, fr, de, es, ru,
      zh`) on both client and server
- [ ] Conventions in CONTRIBUTING.md §4 followed (feature-module isolation,
      named exports, owner-scoped queries, argv-only spawn, i18n-key errors)
- [ ] **CLA signed** — I have read [`.github/CLA.md`](CLA.md) and added my line
      to `CONTRIBUTORS.md` (first-time contributors only; one line, one time)

## Anything reviewers should look at closely

<!-- A trade-off you made, a branch you're unsure about, a follow-up you left. -->
