import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guards for threat surface #6 (command execution / SSRF /
 * input validation) — SERVER half.
 *
 * The AGENT-side twin lives at `agent/src/security-meta.test.ts` (also owns
 * daemon-side argv-only + host-key + no-exec parity). Both halves green ⇒
 * the surface-#6 invariants hold end-to-end.
 *
 * Static checks that fail loudly on regression:
 *   - No `spawn(..., { shell: true })` anywhere in `server/src/**`.
 *   - No `child_process.exec` in `server/src/modules/backups/**`.
 *   - No `StrictHostKeyChecking=no` / `=accept-new` in `server/src/**`.
 *   - Positive control: server + agent restic-runner set
 *     `StrictHostKeyChecking=yes`.
 *   - `alerting/alert.service.ts` routes every outbound fetch through
 *     `safeFetch` — no bare `fetch(` for HTTP.
 *   - `docker-compose.yml` (when present in the mount) bind-mounts
 *     `/var/run/docker.sock` ONLY into `docker-socket-proxy`, and the api
 *     sets `DOCKER_HOST=tcp://docker-socket-proxy:2375`.
 *
 * Cross-referenced from
 *   - `prompts/dockstash-security/06-command-execution-ssrf-input-validation-opus-4.7.md`
 *   - `.claude/rules/argv-only-spawn-and-ssrf.md`
 *   - `docs/security-model.en.md` § "Command execution & SSRF"
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(HERE, '../../');

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

const SERVER_TS = walk(SERVER_SRC).filter((p) => !p.includes('.test.'));

function readServer(rel: string): string {
  return readFileSync(path.resolve(SERVER_SRC, rel), 'utf8');
}

describe('command-execution-meta: argv-only spawn (server)', () => {
  it('no server-side spawn() call sets `shell: true`', () => {
    const offenders: string[] = [];
    for (const file of SERVER_TS) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (/\bshell\s*:\s*true\b/.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('no `child_process.exec` / `execSync` / `execFile` in modules/backups', () => {
    const offenders: string[] = [];
    for (const file of SERVER_TS.filter((p) => p.includes('modules/backups/'))) {
      const src = readFileSync(file, 'utf8');
      // A named import `{ exec, ... }` / `{ execSync, ... }` /
      // `{ execFile, ... }` from `node:child_process`. A locally-defined
      // `exec()` helper inside the runner that wraps `spawn` is fine and
      // does not trip this check.
      const importMatch = src.match(/import\s+\{([^}]+)\}\s+from\s+['"]node:child_process['"]/);
      if (!importMatch) continue;
      const names = importMatch[1]!;
      if (/\b(exec|execSync|execFile|execFileSync)\b/.test(names)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe('command-execution-meta: SSH host-key pinning (server)', () => {
  it('never emits `StrictHostKeyChecking=no` / `=accept-new` in server code', () => {
    // Ignore block/line comments — the ssh-transport and boundaries prose
    // references the anti-pattern as a reminder ("Never `=no`"). Only code
    // matters.
    const codePattern = /(['"])StrictHostKeyChecking=(no|accept-new)\1/i;
    const offenders: string[] = [];
    for (const file of SERVER_TS) {
      const src = stripComments(readFileSync(file, 'utf8'));
      if (codePattern.test(src)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('backups.restic-runner + settings.ssh-probe set StrictHostKeyChecking=yes', () => {
    const runner = readServer('modules/backups/backups.restic-runner.ts');
    const probe = readServer('modules/settings/settings.ssh-probe.ts');
    expect(/StrictHostKeyChecking=yes/.test(runner)).toBe(true);
    expect(/StrictHostKeyChecking=yes/.test(probe)).toBe(true);
  });
});

describe('command-execution-meta: SSRF guard on user-URL fetches', () => {
  it('alerting/alert.service.ts routes every outbound fetch through safeFetch', () => {
    const alertSvc = readServer('modules/alerting/alert.service.ts');
    // No bare `await fetch(` — surface #6 finding S6-01 was exactly that.
    expect(/\bawait fetch\(/.test(alertSvc)).toBe(false);
    expect(/\bsafeFetch\(/.test(alertSvc)).toBe(true);
    expect(
      /from\s+['"][^'"]*shared\/net\/safe-fetch(\.js)?['"]/.test(alertSvc),
    ).toBe(true);
  });

  it('safeFetch enforces scheme allowlist AND private-IP blocklist AND redirect re-validation', () => {
    const src = readServer('shared/net/safe-fetch.ts');
    // Scheme allowlist.
    expect(/protocol\s*!==\s*['"]http:['"][\s\S]*?protocol\s*!==\s*['"]https:['"]/.test(src)).toBe(
      true,
    );
    // Manual redirect follow.
    expect(/redirect:\s*['"]manual['"]/.test(src)).toBe(true);
    // Re-validation on every hop — assertPublicUrl called inside the redirect loop.
    const loopStart = src.indexOf('for (let hop');
    expect(loopStart).toBeGreaterThan(-1);
    const loopBody = src.slice(loopStart);
    expect(/assertPublicUrl\(/.test(loopBody)).toBe(true);
    // IP blocklist: at minimum loopback, private, link-local, metadata IP.
    expect(/127\.0\.0\.0\/8/.test(src)).toBe(true);
    expect(/10\.0\.0\.0\/8/.test(src)).toBe(true);
    expect(/169\.254\.0\.0\/16/.test(src)).toBe(true);
    expect(/172\.16\.0\.0\/12/.test(src)).toBe(true);
    expect(/192\.168\.0\.0\/16/.test(src)).toBe(true);
    expect(/fc00\b|fc\b/.test(src)).toBe(true); // IPv6 unique-local
    expect(/fe80/.test(src)).toBe(true); // IPv6 link-local
  });
});

describe('command-execution-meta: docker-compose socket-proxy invariants', () => {
  const composePath = path.resolve(SERVER_SRC, '../../docker-compose.yml');
  const compose = existsSync(composePath) ? readFileSync(composePath, 'utf8') : null;

  it.skipIf(!compose)('only `docker-socket-proxy` bind-mounts /var/run/docker.sock', () => {
    const lines = compose!.split('\n');
    // Ignore YAML comment lines (they may name the path in prose).
    const sockLines = lines
      .map((line, i) => ({ line, i }))
      .filter(({ line }) => /\/var\/run\/docker\.sock/.test(line) && !/^\s*#/.test(line));
    expect(sockLines.length).toBe(1);
    const idx = sockLines[0]!.i;
    let owner = '';
    for (let i = idx; i >= 0; i--) {
      const m = /^\s{2}([a-z][a-z0-9-]*):\s*$/.exec(lines[i] ?? '');
      if (m) {
        owner = m[1]!;
        break;
      }
    }
    expect(owner).toBe('docker-socket-proxy');
  });

  it.skipIf(!compose)('the api service sets DOCKER_HOST to the proxy', () => {
    expect(/DOCKER_HOST:\s*tcp:\/\/docker-socket-proxy:2375/.test(compose!)).toBe(true);
  });

  it.skipIf(!compose)('docker-socket-proxy runs with cap_drop: ALL + no-new-privileges', () => {
    expect(/no-new-privileges:true/.test(compose!)).toBe(true);
    expect(/cap_drop:\s*\n\s*-\s*ALL/.test(compose!)).toBe(true);
  });
});
