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
    expect(wf).toMatch(/image:\s*node:20/);
  });
});
