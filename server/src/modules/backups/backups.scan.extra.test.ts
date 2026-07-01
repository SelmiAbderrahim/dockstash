import { describe, expect, it } from 'vitest';
import { detectProxyConfigs, scanProject } from './backups.scan.js';

/**
 * Branch-coverage companions for backups.scan.ts — the defensive fall-throughs
 * that the primary fixtures in backups.test.ts don't exercise.
 */
describe('backups.scan: defensive branches', () => {
  it('detectProxyConfigs tolerates a service with no image field', () => {
    // Exercises `svc.image ?? ''` when image is absent.
    expect(detectProxyConfigs({ services: { web: {} } })).toEqual([]);
  });

  it('scanProject tolerates a compose file with no services key', async () => {
    // Exercises `compose.services ?? {}` when the mapping omits `services`.
    const reader = async () => "version: '3.9'\n";
    const plan = await scanProject('/var/www/noservices', { readFile: reader });
    expect(plan.databases).toEqual([]);
    expect(plan.configs).toEqual([]);
    expect(plan.paths).toEqual(['/var/www/noservices']);
  });

  it('scanProject skips non-object service entries (empty and scalar strings)', async () => {
    // `a: ""` → falsy `!svc` branch; `b: "x"` → `typeof svc !== 'object'` branch.
    // Both stay strings so detectProxyConfigs (which reads `.image`) does not throw.
    const reader = async () => 'services:\n  a: ""\n  b: "x"\n';
    const plan = await scanProject('/var/www/scalarsvc', { readFile: reader });
    expect(plan.databases).toEqual([]);
  });
});
