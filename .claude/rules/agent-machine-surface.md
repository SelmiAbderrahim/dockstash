# Fleet-Agent Machine Surface (Surface #5) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every `/api/agent` handler MUST authenticate through
`require-agent-auth.ts` and scope every DB touch by `req.agent.id`
(and, for cross-owner joins, `req.agent.owner`). The composite-token
verify path MUST keep: (1) the anchored `dsa_<24-hex agentId>.<48-hex
secret>` regex, (2) the dummy-record HMAC timing flatten on the
unknown-id branch, (3) `crypto.timingSafeEqual` under `verifyApiSecret`,
(4) ONE generic `agents.error.unauthorized` on every failure branch.
Rotation MUST swap `apiKeyHash` before returning the new token. No admin
or listing route echoes `apiKeyHash` or a plaintext secret. The daemon
MUST derive `SERVER_URL` from `DOCKSTASH_URL` (no baked-in fallback host)
and MUST NOT log its Bearer token. `agent/src/{restic-runner,docker-
client}` and their vendored server-side twins spawn argv-only —
`shell: true`, `child_process.exec`, `/var/run/docker.sock`, and
`dockerode` are FORBIDDEN in both copies.**

See `prompts/dockstash-security/05-fleet-agent-machine-surface-opus-4.7.md`,
`docs/fleet-agents.en.md`, and § "5. FLEET-AGENT MACHINE SURFACE" of
`prompts/SECURITY.md` for the threat model.

## Why This Rule Exists

Six failure modes this rule blocks in one pattern:

1. **Job read by id alone.** `AgentJob.findById(req.params.jobId)` in
   any `/api/agent` handler lets agent A pull agent B's job by guessing
   the ObjectId. Every read MUST include `agent: req.agent.id`.
2. **Timing enumeration on the token.** Without the dummy-record HMAC
   on the unknown-agentId branch, an attacker distinguishes
   "unknown id" (fast, no HMAC) from "known id, wrong secret" (slow,
   real HMAC) by wall-clock and iterates agentIds.
3. **String equality on the signature.** `===` on the stored hash
   leaks the first-differing byte. `crypto.timingSafeEqual` under
   `verifyApiSecret` flattens the timing curve.
4. **Stale rotation.** If `rotateAgentKey` returns the new token before
   persisting the new hash, or persists non-atomically, the OLD token
   still authenticates on the very next request — a stolen-token
   revocation becomes advisory instead of enforced.
5. **Secret echo.** A JSON route that includes `apiKeyHash` (or, worse,
   the plaintext) in the fleet list / agent detail response leaks the
   material a DB dump was designed not to reveal.
6. **Daemon side channels.** A hardcoded `SERVER_URL` fallback lets a
   copy-paste error phone home to the wrong host; a `logger.info(
   { headers })` inside `api-client.ts` sprays the composite Bearer
   into log ingest; `spawn('sh', ['-c', ...])` inside `restic-runner`
   turns any server-supplied param into arbitrary code execution.

## CORRECT

```ts
// agent-api.controller.ts — every handler scopes to req.agent.id
export const agentJobResultHandler: RequestHandler = asyncHandler(async (req, res) => {
  const principal = requireAgent(req.agent);
  const { jobId } = agentJobIdParamsSchema.parse(req.params);
  const input = agentJobResultSchema.parse(req.body);
  const job = await completeJob(principal, jobId, input, { t: req.t });
  res.status(200).json({ status: job.status });
});
```

```ts
// agent-jobs.service.ts — DB filter carries agent AND status
const job = await AgentJob.findOneAndUpdate(
  { _id: jobId, agent: principal.id, status: 'leased' },
  { status: 'succeeded', ... },
  { new: true },
);
if (!job) throw HttpError.notFound(t('agents.error.jobNotFound'));
```

```ts
// require-agent-auth.ts — anchored regex, dummy record, ONE 401
const TOKEN_RE = /^dsa_([0-9a-f]{24})\.([0-9a-f]{48})$/;
const match = TOKEN_RE.exec(token);
if (!match) throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
const agent = await Agent.findById(match[1]);
if (!agent) {
  verifyApiSecret(match[2], getDummyRecord()); // pay the HMAC cost anyway
  throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
}
if (!verifyApiSecret(match[2], agent.apiKeyHash)) {
  throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
}
```

```ts
// agents.service.ts — rotation persists BEFORE returning the token
export async function rotateAgentKey(agentId: string, userId: string, deps = {}) {
  const agent = await loadOwnedAgent(agentId, userId, deps);
  const secret = mintSecret();
  agent.apiKeyHash = hashApiSecret(secret);
  await agent.save();                                    // old hash dies here
  return { agent, token: composeToken(String(agent._id), secret) };
}
```

```ts
// agent/src/config.ts — required, no default fallback host
DOCKSTASH_URL: z.string().url().transform(v => v.replace(/\/+$/, '')),
```

## FORBIDDEN

```ts
// WRONG — job read by id alone. Agent A can pull agent B's job.
const job = await AgentJob.findById(req.params.jobId);
if (job.agent.toString() !== req.agent.id) throw HttpError.forbidden(...);
```

```ts
// WRONG — distinguishing failure branches. Timing + status oracle.
if (!match) return res.status(400).json({ error: 'bad token shape' });
if (!agent) return res.status(404).json({ error: 'unknown agent' });
if (!verifyApiSecret(secret, agent.apiKeyHash))
  return res.status(401).json({ error: 'bad secret' });
```

```ts
// WRONG — unknown-agentId skips the HMAC cost. Timing side channel.
const agent = await Agent.findById(agentId);
if (!agent) throw HttpError.unauthorized('...');   // no dummy verify → fast path
if (!verifyApiSecret(secret, agent.apiKeyHash)) throw HttpError.unauthorized('...');
```

```ts
// WRONG — string compare on the hash. Leaks first-differing byte.
if (agent.apiKeyHash.hash === hashApiSecret(secret).hash) return next();
```

```ts
// WRONG — rotation composes the token BEFORE persisting. Old token still
// works during the request/response gap.
const token = composeToken(String(agent._id), secret);
agent.apiKeyHash = hashApiSecret(secret);
await agent.save();
return { agent, token };
```

```ts
// WRONG — secret echo in a listing/detail response.
res.status(200).json({ agent: { ...serializeAgent(agent), apiKeyHash: agent.apiKeyHash } });
```

```ts
// WRONG — hardcoded SERVER_URL fallback on the daemon.
DOCKSTASH_URL: z.string().url().default('https://dockstash.com'),
```

```ts
// WRONG — Bearer token printed to daemon logs.
log.info({ headers: { authorization: `Bearer ${this.token}` } }, 'posting');
```

```ts
// WRONG — shell string on either restic-runner copy.
spawn('sh', ['-c', `restic -r ${repoUrl} snapshots`], { shell: true });
```

## Contract

For every `/api/agent` handler and its downstream service:

1. **Authenticate via `requireAgentAuth`.** No hand-parsed Bearer, no
   second `jwt.verify` path, no header trust for identity.
2. **Scope every DB read/write by `req.agent.id`** (and by
   `req.agent.owner` for cross-owner joins like the project scope on
   `stampProject`). `AgentJob.findById(req.params.jobId)` in a
   controller / service is a durable regression.
3. **Preserve the composite-token verify invariants** in
   `require-agent-auth.ts`: anchored regex, `findById` on `match[1]`,
   dummy-record HMAC on unknown-id, `timingSafeEqual` under
   `verifyApiSecret`, one generic `agents.error.unauthorized`.
4. **Rotation swaps `apiKeyHash` and persists BEFORE returning the new
   token.** The old HMAC is invalid on the very next request.
5. **No route echoes `apiKeyHash` or a plaintext secret.** `token` is
   returned exactly once by `register` and by `rotate`.
6. **Daemon `SERVER_URL` pin.** `DOCKSTASH_URL` is required (no
   `.default(...)`), and `agent/src/api-client.ts` emits no log lines
   that could carry the composite Bearer.
7. **Cross-copy parity** on `restic-runner` and `docker-client`: same
   `node:child_process` import, same `SpawnImpl` injection point, no
   `shell: true`, no `child_process.exec`, `RESTIC_PASSWORD` via env,
   `StrictHostKeyChecking=yes` on every SFTP call. Both copies are
   guarded by identical invariant lists in
   `server/src/shared/middleware/agent-machine-meta.test.ts` and
   `agent/src/security-meta.test.ts`.

## Escape Hatch

None. A `/api/agent` handler or verify-path regression is a Critical
finding, not a judgment call.

## Validation

```bash
# Server-side static guards for this surface — green:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/agent-machine-meta.test.ts

# Daemon-side static guards + cross-copy parity — green:
docker run --rm -v "$PWD/agent":/app -w /app node:20-bookworm \
  npx vitest run src/security-meta.test.ts

# Full agent + agent-api suite — verify/scope/rotation/lifecycle covered:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/agents
```

All three must return green. A red run is not "almost done" — it is a
durable regression.

## Checklist

- [ ] Every `/api/agent` handler calls `requireAgent(req.agent)` and
      scopes downstream DB queries by `agent: principal.id`.
- [ ] `AgentJob.findById(req.params.jobId)` never appears in any
      controller / service.
- [ ] `require-agent-auth.ts` keeps: anchored `TOKEN_RE`, dummy-record
      HMAC branch, `verifyApiSecret` compare, single 401 key.
- [ ] `rotateAgentKey` persists `apiKeyHash` BEFORE composing the token.
- [ ] `serializeAgent` and any admin listing NEVER include `apiKeyHash`
      or a plaintext secret.
- [ ] `agent/src/config.ts` `DOCKSTASH_URL` has no `.default(...)`.
- [ ] `agent/src/api-client.ts` emits no `log.*` calls.
- [ ] `agent/src/logging.ts` redacts `repo.password` and `ssh.privateKey`.
- [ ] Both `restic-runner` copies + both `docker-client` copies satisfy
      the parity invariants (argv-only spawn, no shell, no raw socket).
- [ ] `agent-machine-meta.test.ts` (server) AND `security-meta.test.ts`
      (agent) green.
