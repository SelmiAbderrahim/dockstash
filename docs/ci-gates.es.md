> Note: this document is currently maintained in English. Localized parity is planned in a future prompt.

# CI gates

Dockstash CI runs in Docker (prod parity). Every push and
pull-request runs the pipeline below on both `client/` and `server/`. Any
gate failure blocks the merge.

## Stages

| # | Stage | Command | Failure mode |
|---|-------|---------|-------------|
| 1 | Typecheck | `npm run typecheck` | tsc reports an error |
| 2 | Lint | `npm run lint` | eslint reports any error |
| 3 | Tests + coverage | `npx vitest run --coverage` | any test fails OR v8 coverage falls below 100% on lines/branches/functions/statements |
| 4 | `npm audit` | `npm audit --audit-level=high` | any high or critical advisory (fails on the FIRST advisory) |

## Coverage gate

100% v8 threshold enforced in both `server/vitest.config.ts` and
`client/vitest.config.ts`. When a new file drops coverage below 100%, add
tests — do NOT drop the threshold. Config-only exclusions
(`src/server.ts`, `src/config/logger.ts`, entry points) are documented in
the config file.

## `npm audit` gate

Both `client/` and `server/` run `npm audit --audit-level=high`. A single
high or critical advisory fails the pipeline. Dependencies MUST be pinned to
public-npm releases (no unbounded ranges); resolve advisories by upgrading
or pinning to a patched version. There is no allow-list — silencing an
advisory requires code change or dep swap.

## Where

`.github/workflows/ci.yml`. Runs in `node:24-bookworm` containers on
GitHub-hosted runners. The `docker-build` job additionally builds the
compose stack to catch Dockerfile drift.
