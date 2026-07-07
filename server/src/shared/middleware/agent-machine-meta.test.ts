import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guards for threat surface #5 (fleet-agent machine surface).
 * Static checks over:
 *   - `require-agent-auth.ts` — composite-token verify properties
 *   - `agent-jobs.service.ts` — per-agent scope on every DB read/write
 *   - `agents.service.ts` — atomic rotation
 *   - `agent-api.controller.ts` — every handler references `req.agent`
 *   - `agents.controller.ts` — no route returns `apiKeyHash`
 *   - `backups.restic-runner.ts` + `backups.docker-client.ts` — argv-only spawn
 *
 * The DAEMON side of the parity check (agent/src/{api-client,logging,
 * config,restic-runner,docker-client}) lives in `agent/src/security-meta.test.ts`
 * with the SAME invariant list — both must be green for the surface to hold.
 *
 * Cross-referenced from
 * `prompts/dockstash-security/05-fleet-agent-machine-surface-opus-4.7.md`,
 * `.claude/rules/agent-machine-surface.md`, and `docs/fleet-agents.en.md`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(HERE, '../../');

function read(rel: string): string {
  return readFileSync(path.resolve(SERVER_SRC, rel), 'utf8');
}

const REQUIRE_AGENT_AUTH = read('shared/middleware/require-agent-auth.ts');
const AGENT_JOBS_SERVICE = read('modules/agents/agent-jobs.service.ts');
const AGENTS_SERVICE = read('modules/agents/agents.service.ts');
const AGENT_API_CTL = read('modules/agents/agent-api.controller.ts');
const AGENTS_CTL = read('modules/agents/agents.controller.ts');
const RESTIC_RUNNER = read('modules/backups/backups.restic-runner.ts');
const DOCKER_CLIENT = read('modules/backups/backups.docker-client.ts');
const CRYPTO_IDX = read('shared/crypto/index.ts');

describe('agent-machine-meta: composite-token verify properties', () => {
  it('composite token regex is anchored, agentId=24-hex, secret=48-hex', () => {
    // Anchoring is what stops a trailing-garbage bypass; the fixed lengths
    // keep the scanner-friendly token shape stable across server + daemon + docs.
    expect(/\/\^dsa_\(\[0-9a-f\]\{24\}\)\\\.\(\[0-9a-f\]\{48\}\)\$\//.test(REQUIRE_AGENT_AUTH)).toBe(
      true,
    );
  });

  it('unknown-id verify path still pays HMAC cost against a dummy record', () => {
    // Timing flatten: an attacker cannot distinguish "unknown agentId" from
    // "known agentId, wrong secret" by wall-clock.
    expect(/getDummyRecord\s*\(\s*\)/.test(REQUIRE_AGENT_AUTH)).toBe(true);
    expect(
      /verifyApiSecret\s*\(\s*secret\s*,\s*getDummyRecord\s*\(\s*\)\s*\)/.test(REQUIRE_AGENT_AUTH),
    ).toBe(true);
  });

  it('every failure branch throws the same generic unauthorized key', () => {
    const throws = REQUIRE_AGENT_AUTH.match(/HttpError\.unauthorized\([^)]*\)/g) ?? [];
    expect(throws.length).toBeGreaterThanOrEqual(2);
    for (const t of throws) {
      expect(t).toContain('agents.error.unauthorized');
    }
  });

  it('verifyApiSecret uses timingSafeEqual with a length pre-guard', () => {
    expect(/timingSafeEqual/.test(CRYPTO_IDX)).toBe(true);
    // Length-guard BEFORE compare (timingSafeEqual throws on mismatched len).
    expect(/expected\.length\s*!==\s*actual\.length/.test(CRYPTO_IDX)).toBe(true);
  });
});

describe('agent-machine-meta: per-agent scope on every DB touch', () => {
  it('claim/log/complete queries all include `agent: principal.id`', () => {
    // Bare AgentJob.findById(req.params.jobId) is the IDOR shape — any hit is
    // a regression (a job read by id alone would let agent A read agent B's job).
    expect(/AgentJob\.findById\(\s*req\.params/.test(AGENT_JOBS_SERVICE)).toBe(false);
    expect(/AgentJob\.findOneAndUpdate\(\s*\{\s*agent:\s*principal\.id/.test(
      AGENT_JOBS_SERVICE,
    )).toBe(true);
    // completeJob + appendJobLogs BOTH filter by (_id, agent: principal.id).
    const scoped = AGENT_JOBS_SERVICE.match(
      /\{\s*_id:\s*jobId,\s*agent:\s*principal\.id/g,
    ) ?? [];
    expect(scoped.length).toBeGreaterThanOrEqual(2);
  });

  it('claim-time re-verifies project owner via claim principal, not the daemon payload', () => {
    // The claimed project's owner MUST equal the calling principal's owner.
    expect(/project\.owner\.toString\(\)\s*!==\s*principal\.owner/.test(AGENT_JOBS_SERVICE)).toBe(
      true,
    );
  });

  it('stampProject scopes writes by (project, owner) — no bare findById', () => {
    // Surface #2 / S2-02 fix: defense-in-depth against a stray join.
    expect(/Project\.findOne\(\s*\{\s*_id:\s*projectId,\s*owner\s*\}/.test(
      AGENT_JOBS_SERVICE,
    )).toBe(true);
  });
});

describe('agent-machine-meta: every `/api/agent` handler references req.agent', () => {
  it('all exported RequestHandlers call requireAgent(req.agent)', () => {
    // Enumerate the exports; each handler must derive its principal from
    // req.agent (populated by requireAgentAuth) — never trust req.body or
    // req.params for the caller identity.
    const handlers = AGENT_API_CTL.match(
      /export\s+const\s+(\w+Handler):\s*RequestHandler/g,
    ) ?? [];
    expect(handlers.length).toBeGreaterThanOrEqual(4);
    for (const h of handlers) {
      const name = /export\s+const\s+(\w+Handler)/.exec(h)?.[1] ?? '';
      const body = extractHandlerBody(AGENT_API_CTL, name);
      expect(body, `handler ${name} does not reference req.agent`).toMatch(
        /requireAgent\(\s*req\.agent\s*\)/,
      );
    }
  });
});

describe('agent-machine-meta: token lifecycle — issued once, rotation atomic, no echo', () => {
  it('rotateAgentKey overwrites apiKeyHash and persists BEFORE returning the new token', () => {
    // The old HMAC MUST be invalid on the very next request. The token is
    // composed after the persist so the response and DB state agree.
    const src = AGENTS_SERVICE;
    const rotateIdx = src.indexOf('export async function rotateAgentKey');
    expect(rotateIdx).toBeGreaterThan(-1);
    const rotateBody = src.slice(rotateIdx, src.indexOf('\n}', rotateIdx) + 2);
    expect(/apiKeyHash\s*=\s*hashApiSecret\s*\(\s*secret\s*\)/.test(rotateBody)).toBe(true);
    expect(/await\s+agent\.save\s*\(\s*\)/.test(rotateBody)).toBe(true);
    const saveIdx = rotateBody.indexOf('agent.save()');
    const composeIdx = rotateBody.indexOf('composeToken');
    expect(saveIdx).toBeGreaterThan(-1);
    expect(composeIdx).toBeGreaterThan(saveIdx);
  });

  it('no admin/agent route returns apiKeyHash or a plaintext secret', () => {
    // serializeAgent must never surface apiKeyHash; a stray include is a
    // secret-echo finding.
    expect(/apiKeyHash/.test(AGENTS_CTL)).toBe(false);
    // Fleet + list responses never emit `token` — that's only returned by
    // register + rotate (once). Bound the count so a new route that echoes
    // an existing token trips the guard.
    const emissions = AGENTS_CTL.match(/\btoken\b/g) ?? [];
    expect(emissions.length).toBeLessThanOrEqual(6);
  });
});

/**
 * Cross-copy parity — SERVER half.
 *
 * The daemon at `agent/src/{restic-runner,docker-client}.ts` vendors its own
 * copy of these two files, so the same invariant list runs in
 * `agent/src/security-meta.test.ts`. Both halves green ⇒ argv-only shape is
 * preserved end-to-end.
 */
describe('agent-machine-meta: cross-copy parity (server half)', () => {
  it('restic-runner spawns argv-only, password via env, host key pinned', () => {
    expect(/from\s+'node:child_process'/.test(RESTIC_RUNNER)).toBe(true);
    expect(/SpawnImpl/.test(RESTIC_RUNNER)).toBe(true);
    expect(/shell:\s*true/.test(RESTIC_RUNNER)).toBe(false);
    // Only fail on child_process.exec — a local `exec(argv)` helper inside
    // the runner is fine (that's the argv-only wrapper the file exports).
    expect(/from\s+'node:child_process'[^;]*\bexec\b/.test(RESTIC_RUNNER)).toBe(false);
    expect(/RESTIC_PASSWORD/.test(RESTIC_RUNNER)).toBe(true);
    expect(/StrictHostKeyChecking=yes/.test(RESTIC_RUNNER)).toBe(true);
  });

  it('docker-client routes through the socket-proxy (no /var/run/docker.sock, no dockerode)', () => {
    expect(/\/var\/run\/docker\.sock/.test(DOCKER_CLIENT)).toBe(false);
    expect(/from\s+'dockerode'/.test(DOCKER_CLIENT)).toBe(false);
    expect(/parseDockerHost/.test(DOCKER_CLIENT)).toBe(true);
  });
});

/**
 * Extract the body of a `export const NAME: RequestHandler = asyncHandler(async (...) => { ... });`
 * declaration. Uses brace-depth so nested braces in inline objects stay intact.
 */
function extractHandlerBody(src: string, name: string): string {
  const idx = src.indexOf(`export const ${name}`);
  if (idx < 0) return '';
  const arrow = src.indexOf('=>', idx);
  const braceStart = src.indexOf('{', arrow);
  if (braceStart < 0) return '';
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(braceStart, i + 1);
    }
  }
  return src.slice(braceStart);
}
