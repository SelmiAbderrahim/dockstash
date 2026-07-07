import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guards for threat surface #5 — DAEMON half.
 *
 * The server half lives in
 * `server/src/shared/middleware/agent-machine-meta.test.ts` and asserts the
 * SAME cross-copy invariant list on the server's own restic-runner /
 * docker-client. Both green ⇒ argv-only spawn shape is preserved end-to-end;
 * a drift on either side fails loudly.
 *
 * Cross-referenced from
 * `prompts/dockstash-security/05-fleet-agent-machine-surface-opus-4.7.md`,
 * `.claude/rules/agent-machine-surface.md`, and `docs/fleet-agents.en.md`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));

function read(rel: string): string {
  return readFileSync(path.resolve(HERE, rel), 'utf8');
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

function walk(root: string, out: string[] = []): string[] {
  for (const entry of readdirSync(root)) {
    const p = path.join(root, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (entry.endsWith('.ts')) out.push(p);
  }
  return out;
}

const AGENT_TS = walk(HERE).filter((p) => !p.includes('.test.'));

const CONFIG = read('config.ts');
const API_CLIENT = read('api-client.ts');
const LOGGING = read('logging.ts');
const RESTIC = read('restic-runner.ts');
const DOCKER = read('docker-client.ts');
const EXECUTOR = read('executor.ts');
const BACKUP = read('backup.ts');
const RESTORE = read('restore.ts');

describe('agent-security-meta: SERVER_URL pin + composite-token shape', () => {
  it('daemon config requires DOCKSTASH_URL (no hardcoded fallback host)', () => {
    // The URL zod field is `.string().url()` without a `.default(...)`.
    // Startup fails when unset — the daemon never falls back to a baked-in host.
    expect(/DOCKSTASH_URL:\s*z\s*\n?\s*\.string\(\)\s*\n?\s*\.url\(\)/.test(CONFIG)).toBe(true);
    // And no accidental `.default('https://dockstash.com')` slips in.
    const urlBlock = /DOCKSTASH_URL:[\s\S]*?DOCKSTASH_AGENT_TOKEN:/.exec(CONFIG)?.[0] ?? '';
    expect(/\.default\(\s*['"`]https?:/.test(urlBlock)).toBe(false);
  });

  it('composite token regex mirrors the server-side shape exactly', () => {
    expect(/\/\^dsa_\[a-f0-9\]\{24\}\\\.\[a-f0-9\]\{48\}\$\//.test(CONFIG)).toBe(true);
  });
});

describe('agent-security-meta: api-client never logs the Bearer token', () => {
  it('Bearer header composed from the ctor-supplied token, not a literal', () => {
    expect(/authorization:\s*`Bearer\s*\$\{this\.token\}`/.test(API_CLIENT)).toBe(true);
  });

  it('api-client emits no log lines — the poller owns logging + retries', () => {
    // A stray log inside api-client is the shape that historically leaked
    // credentials: e.g. `log.debug({ headers })` printing the composite token.
    expect(/log\.(info|warn|error|debug|trace)\(/.test(API_CLIENT)).toBe(false);
  });

  it('pino logger redacts the credential-shaped paths defensively', () => {
    expect(/redact:/.test(LOGGING)).toBe(true);
    expect(/repo\.password/.test(LOGGING)).toBe(true);
    expect(/ssh\.privateKey/.test(LOGGING)).toBe(true);
  });
});

describe('agent-security-meta: no shell strings in job execution paths', () => {
  it('executor / backup / restore never call child_process.exec or shell:true', () => {
    for (const src of [EXECUTOR, BACKUP, RESTORE]) {
      expect(/shell:\s*true/.test(src)).toBe(false);
      // A bare `exec(` matches on false positives like Docker's /exec endpoint
      // string. Only fail on an actual child_process.exec import path.
      expect(/from\s+'node:child_process'[\s\S]{0,120}exec/.test(src)).toBe(false);
    }
  });
});

/**
 * Cross-copy parity — DAEMON half.
 *
 * Same invariant list as `server/src/shared/middleware/agent-machine-meta.test.ts`
 * asserts on the server's vendored copies. A drift on either side ⇒ red test.
 */
/**
 * Surface #6 preventive guards — DAEMON half.
 *
 * The server-side twin at
 * `server/src/shared/middleware/command-execution-meta.test.ts` runs the
 * SAME shape checks over `server/src/**`. Both green ⇒ the argv-only / no-
 * exec / host-key-pinned invariants hold end-to-end on both copies.
 */
describe('agent-security-meta: argv-only spawn + host-key pin (daemon-wide)', () => {
  it('no daemon spawn() sets `shell: true` anywhere in agent/src', () => {
    const offenders: string[] = [];
    for (const file of AGENT_TS) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (/\bshell\s*:\s*true\b/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('no `child_process.exec` / `execSync` / `execFile` in agent/src', () => {
    const offenders: string[] = [];
    for (const file of AGENT_TS) {
      const src = readFileSync(file, 'utf8');
      const importMatch = src.match(/import\s+\{([^}]+)\}\s+from\s+['"]node:child_process['"]/);
      if (!importMatch) continue;
      if (/\b(exec|execSync|execFile|execFileSync)\b/.test(importMatch[1]!)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('never emits `StrictHostKeyChecking=no` / `=accept-new` (code, not comments)', () => {
    const codePattern = /(['"])StrictHostKeyChecking=(no|accept-new)\1/i;
    const offenders: string[] = [];
    for (const file of AGENT_TS) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (codePattern.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('agent-security-meta: cross-copy parity (daemon half)', () => {
  it('restic-runner spawns argv-only, password via env, host key pinned', () => {
    expect(/from\s+'node:child_process'/.test(RESTIC)).toBe(true);
    expect(/SpawnImpl/.test(RESTIC)).toBe(true);
    expect(/shell:\s*true/.test(RESTIC)).toBe(false);
    // Only fail on child_process.exec import — a local `exec(argv)` helper
    // inside the runner is fine (that's the argv-only wrapper the file uses).
    expect(/from\s+'node:child_process'[^;]*\bexec\b/.test(RESTIC)).toBe(false);
    expect(/RESTIC_PASSWORD/.test(RESTIC)).toBe(true);
    expect(/StrictHostKeyChecking=yes/.test(RESTIC)).toBe(true);
  });

  it('docker-client routes through the socket-proxy (no /var/run/docker.sock, no dockerode)', () => {
    expect(/\/var\/run\/docker\.sock/.test(DOCKER)).toBe(false);
    expect(/from\s+'dockerode'/.test(DOCKER)).toBe(false);
    expect(/parseDockerHost/.test(DOCKER)).toBe(true);
  });
});
