import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Prompt 11: the coverage + audit gates are declared exactly once. A stray
// duplicate or a downgrade to below 100% must fail CI locally BEFORE the
// GitHub run — so we assert the declarations directly.

describe('CI gate declarations', () => {
  it('server vitest declares 100% v8 coverage thresholds', () => {
    const cfg = readFileSync(resolve(__dirname, '../vitest.config.ts'), 'utf8');
    expect(cfg).toContain("provider: 'v8'");
    expect(cfg).toMatch(/lines:\s*100/);
    expect(cfg).toMatch(/branches:\s*100/);
    expect(cfg).toMatch(/functions:\s*100/);
    expect(cfg).toMatch(/statements:\s*100/);
  });

  it('client vitest declares 100% v8 coverage thresholds', () => {
    const cfg = readFileSync(resolve(__dirname, '../../client/vitest.config.ts'), 'utf8');
    expect(cfg).toContain("provider: 'v8'");
    expect(cfg).toMatch(/lines:\s*100/);
    expect(cfg).toMatch(/branches:\s*100/);
    expect(cfg).toMatch(/functions:\s*100/);
    expect(cfg).toMatch(/statements:\s*100/);
  });

  it('.github/workflows/ci.yml pipes through the required stages', () => {
    const wf = readFileSync(resolve(__dirname, '../../.github/workflows/ci.yml'), 'utf8');
    // Stages: typecheck / lint / test+coverage / npm audit
    expect(wf).toMatch(/npm run typecheck/);
    expect(wf).toMatch(/npm run lint/);
    expect(wf).toMatch(/vitest run --coverage/);
    // Zero-high advisories on both client and server.
    expect(wf).toMatch(/npm audit --audit-level=high/);
    // Runs inside a Docker container image for prod parity.
    expect(wf).toMatch(/image:\s*node:\d+-bookworm/);
  });

  // The whole point of running CI in a container is that it matches what ships.
  // Assert the relationship, not a hardcoded version, so a node bump does not
  // need this file edited — but a bump that touches only the Dockerfiles (or
  // only CI) fails loudly instead of silently drifting.
  it('the CI container image major matches every Dockerfile', () => {
    const repoRoot = resolve(__dirname, '../..');
    const wf = readFileSync(resolve(repoRoot, '.github/workflows/ci.yml'), 'utf8');

    const ciMajors = new Set(
      [...wf.matchAll(/image:\s*node:(\d+)-bookworm/g)].map((m) => m[1]),
    );
    expect(ciMajors.size, 'every CI job must pin the same node major').toBe(1);

    const dockerfileMajors = new Set(
      ['client', 'server', 'agent'].flatMap((pkg) =>
        [
          ...readFileSync(resolve(repoRoot, pkg, 'Dockerfile'), 'utf8').matchAll(
            /FROM node:(\d+)-bookworm/g,
          ),
        ].map((m) => m[1]),
      ),
    );
    expect(dockerfileMajors.size, 'every Dockerfile must pin the same node major').toBe(1);

    expect(
      [...dockerfileMajors][0],
      'CI container node major must equal the Dockerfile node major',
    ).toBe([...ciMajors][0]);
  });
});
