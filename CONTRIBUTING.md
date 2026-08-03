# Contributing to Dockstash

Thanks for taking the time. This document is the short path from clone to a
green test suite, plus the handful of conventions that are load-bearing here.

---

## 1. Read this first: every command runs inside Docker

**Do not run `npm`, `node`, `npx`, `tsc` or `vitest` directly on your host.**
The toolchain is pinned to `node:20-bookworm` so local runs match CI exactly.
This surprises everyone once; it is the single rule most likely to waste your
afternoon.

The canonical form:

```bash
docker run --rm -e CI=1 -v "$PWD/<package>":/app -w /app node:20-bookworm <command>
```

where `<package>` is `client`, `server`, or `agent`.

Two things that will bite you:

- **`npm test` is watch mode.** In a container it hangs forever. Always use
  `npx vitest run`.
- **Some meta-tests read files across package boundaries** (e.g. the server's
  `ci-gates.test.ts` reads `client/vitest.config.ts`). Those need the repo root
  mounted, not just one package:

  ```bash
  docker run --rm -e CI=1 -v "$PWD":/repo -w /repo/server node:20-bookworm npx vitest run
  ```

Host-side, only `git`, `docker`, `gh`, and read-only file inspection are
expected to be used directly.

---

## 2. Setup

```bash
git clone <your-fork> dockstash && cd dockstash
cp .env.example .env
# generate the three secrets — see the header comment in .env.example

# install dependencies (once per package)
for p in client server agent; do
  docker run --rm -v "$PWD/$p":/app -w /app node:20-bookworm npm ci
done

# bring the stack up
docker compose up -d --build
make wait-healthy
```

`make help` lists the compose shortcuts.

---

## 3. The gates

Run all of these before opening a pull request. CI runs the same four stages
per package and fails on the first one that breaks.

```bash
P=server   # or client, or agent

docker run --rm -e CI=1 -v "$PWD/$P":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -e CI=1 -v "$PWD/$P":/app -w /app node:20-bookworm npm run lint
docker run --rm -e CI=1 -v "$PWD":/repo   -w /repo/$P node:20-bookworm npx vitest run --coverage
docker run --rm    -v "$PWD/$P":/app -w /app node:20-bookworm npm audit --audit-level=high
```

A single file:

```bash
docker run --rm -e CI=1 -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/auth/auth.test.ts
```

### The 100% coverage expectation

Coverage thresholds are **100% on lines, branches, functions and statements**
for all three packages. That is unusual, and it is deliberate: this is backup
software, and the failure mode of an untested branch is silent data loss that
surfaces only when someone tries to restore.

Practically it means:

- New code arrives with its tests. There is no "add tests later" lane.
- **Delete source and its tests in the same change.** Removing a module but
  leaving its test file breaks collection; removing a test but leaving the
  module breaks the threshold.
- If a branch is genuinely unreachable, mark it with a `/* c8 ignore next */`
  and a comment saying *why* — not to silence the gate, but to record the
  reasoning.

Details: [docs/ci-gates.en.md](docs/ci-gates.en.md).

---

## 4. Conventions

These are enforced by lint rules, meta-tests, or review. None of them are
stylistic preferences.

**Feature-module isolation.** Client features live in
`client/src/features/<name>/`; server modules in `server/src/modules/<name>/`.
Cross-feature imports go through `shared/` or the other module's `index.ts`
public API — never into its internals.

**Named exports only.** No `export default` on components, reducers, models, or
utilities. Named exports make refactoring and IDE discovery reliable.

**Typed Mongoose schemas.** Every schema uses `InferSchemaType` and exports the
type alongside the model. No bare `mongoose.model()`.

**Owner-scoped queries at query time.** Every owner-scoped load filters by
`owner` *in the query* (`Model.findOne({ _id, owner })`) — never a
`findById` followed by an ownership `if`. Foreign-owner requests return **404**,
not 403, so a caller cannot enumerate other accounts' resources.

**Argv-only spawn.** Every `child_process.spawn` uses `shell: false` with a
`string[]` argv. Secrets travel via `env`, never argv. `exec` is banned in
`modules/backups/**` and `agent/src/**`. SSH always pins the host key.

**Server-side fetch on user input goes through `safeFetch`.** It blocks
loopback, private, link-local and metadata addresses (v4 and v6) and
re-validates every redirect hop.

**Errors are i18n keys.** `error-handler.ts` emits a resolved i18n key plus
optional zod details. Never `err.stack`, never a raw `err.message`, not even in
development.

**Environment variables come from the root `.env` only.** Never create a `.env`
in a subdirectory. Server config flows through `server/src/config/env.ts`
(zod-validated at boot). Client config uses `import.meta.env.VITE_*`.

**No hardcoded URLs.** Derive from `CLIENT_URL` / `SERVER_URL` on the server and
`VITE_API_BASE_URL` / `VITE_SOCKET_URL` on the client. Tests and seed scripts
are the only exceptions.

**Tab state lives in the URL.** Every tabbed interface persists the active tab
as `?tab=` so links are shareable and refresh-safe. Never `useState`.

**i18n parity is seven locales.** `en, ar, fr, de, es, ru, zh`. A key added or
removed must be added or removed in all seven, on both sides
(`client/src/shared/i18n/locales/<loc>/` and
`server/src/shared/i18n/dictionaries/<loc>.ts`). Server-side parity is a
compile error; client-side is a silent fallback, so the parity test catches it.

**Design system.** Achromatic neutral tokens, flat 1px-border surfaces,
lucide icons, one Instrument Serif italic accent per display headline at most.
No brand hue, no gradient text, no card-lift-on-hover, no `transition: all`.
Every clickable ships all six states (default / hover / focus-visible / active /
disabled / loading).

---

## 5. Adding a feature

**Client** — create `client/src/features/<name>/` with `components/`,
`store/{slice,thunks,selectors}.ts`, `api.ts`, `types.ts`, `routes.tsx`, and an
`index.ts` exporting the public API. Register the reducer in `app/store.ts` and
spread the routes in `app/routes.tsx`.

**Server** — create `server/src/modules/<name>/` with `<name>.model.ts`,
`.schema.ts` (zod), `.service.ts`, `.controller.ts`, `.routes.ts`, `.test.ts`,
and `index.ts`. Mount in `app.ts`.

Controllers parse and validate, then delegate. Business logic lives in services;
services own the model calls. No DB access from a controller.

---

## 6. Licensing and the CLA

Dockstash is **AGPL-3.0-only**. Anything you contribute ships under that license
to every user, forever.

**Your first pull request must also sign the
[Contributor License Agreement](.github/CLA.md).** It is one line added to
[`CONTRIBUTORS.md`](CONTRIBUTORS.md) plus a checkbox in the PR template:

```
- Your Name <your@email> — signed CLA v1.0 on YYYY-MM-DD
```

The short version of why: you keep full ownership of your work — the CLA is a
license grant, not an assignment — but it lets the maintainer distribute the
codebase under terms besides the AGPL. That matters because some organizations
cannot use AGPL software at all, so Dockstash is also offered under a commercial
license and as a managed service at dockstash.com. Copyright law does not allow
relicensing code you do not own, so without the CLA a single external
contribution permanently closes that door — and chasing consent retroactively is
worse for everyone.

It does **not** let anyone take the AGPL version away. Every AGPL release stays
AGPL and remains forkable under that license.

If you are contributing on behalf of an employer, make sure you have their
permission before signing — Section 5 of the CLA covers this.

---

## 7. Pull requests

- Branch off `master`. One logical change per PR.
- Conventional-ish commit subjects (`feat:`, `fix:`, `docs:`, `refactor:`,
  `test:`, `chore:`) — not enforced by a hook, just easier to read.
- Fill in the PR template checklist honestly. "Tests added" with no tests is
  worse than an empty box.
- Update the docs in the same PR when behavior changes, and add a `CHANGELOG.md`
  entry for anything user-visible.
- If your change adds or removes an environment variable, update **all three**:
  `.env.example`, `server/src/config/env.ts`, and `docker-compose.yml`. They are
  checked against each other.

### A note on CI in forks

The `publish-agent` job pushes the agent image to a container registry using
repository secrets. Forks have no credentials, and the job only runs on pushes
to `master` in the upstream repository, so it will never fire on your fork or
your pull request. Every other job runs normally.

---

## 8. Reporting security issues

Please do **not** open a public issue. See [SECURITY.md](SECURITY.md) for the
private disclosure channel.
