import { describe, expect, it } from 'vitest';
import { AGENT_WIRE_VERSION } from './types.js';
import type { AgentJobKind, ClaimedJob, HeartbeatResponse, JobResult } from './types.js';

describe('types', () => {
  it('exposes the runtime wire-version marker', () => {
    expect(AGENT_WIRE_VERSION).toBe(1);
  });

  it('describes the /api/agent wire shapes (compile-time check only)', () => {
    const kind: AgentJobKind = 'backup';
    const job: ClaimedJob = {
      id: 'job-1',
      kind,
      projectId: 'proj-1',
      leaseSeconds: 60,
      attempt: 1,
      maxAttempts: 3,
      plan: { paths: [], configs: [], databases: [] },
      retention: null,
      restore: null,
      repo: { url: 'sftp:backup@host:/repo', password: 'pw' },
      ssh: { privateKey: 'key', hostKeyLine: 'host ssh-ed25519 AAAA' },
    };
    const heartbeat: HeartbeatResponse = {
      agent: { id: 'a1', name: 'agent-1', status: 'online' },
      pollIntervalMs: 10_000,
      heartbeatIntervalMs: 30_000,
    };
    const result: JobResult = { ok: true, stats: { snapshotCount: 1 } };

    expect(job.kind).toBe('backup');
    expect(heartbeat.agent.status).toBe('online');
    expect(result.ok).toBe(true);
  });
});
