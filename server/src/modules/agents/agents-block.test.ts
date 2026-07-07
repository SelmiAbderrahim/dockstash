import { describe, expect, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { startMemoryMongo, stopMemoryMongo, clearCollections } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { Agent } from './agents.model.js';
import { AgentJob } from './agent-jobs.model.js';
import { claimNextJob } from './agent-jobs.service.js';
import type { AgentPrincipal } from '../../shared/middleware/require-agent-auth.js';

beforeAll(() => startMemoryMongo());
afterAll(() => stopMemoryMongo());
beforeEach(() => clearCollections());

async function seed(blockedByBilling: boolean) {
  const user = await User.create({
    email: 'a@example.com',
    password: 'x'.repeat(60),
    profile: { firstName: 'A', lastName: 'J' },
    emailVerified: true,
  });
  const agent = await Agent.create({
    owner: user._id,
    name: 'vps',
    host: 'h1',
    apiKeyHash: { hash: 'h', keyVersion: 1 },
    blockedByBilling,
  });
  const project = await Project.create({
    owner: user._id,
    name: 'p',
    path: '/var/www/p',
    plan: { paths: [], databases: [], configs: [] },
    repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
    agent: agent._id,
  });
  await AgentJob.create({
    owner: user._id,
    agent: agent._id,
    project: project._id,
    kind: 'backup',
    status: 'pending',
  });
  const principal: AgentPrincipal = {
    id: String(agent._id),
    owner: String(user._id),
    name: agent.name,
  };
  return { agent, principal };
}

describe('claimNextJob — F6 billing block', () => {
  it('a blocked agent leases NO job (never deletes it, never touches the pending job)', async () => {
    const { principal } = await seed(true);
    expect(await claimNextJob(principal)).toBeNull();
    // The pending job is untouched — a re-enable can still run it.
    expect(await AgentJob.countDocuments({ status: 'pending' })).toBe(1);
  });

  it('tolerates a vanished agent record (no lease, no throw)', async () => {
    const { agent, principal } = await seed(false);
    await Agent.deleteOne({ _id: agent._id });
    await AgentJob.deleteMany({});
    expect(await claimNextJob(principal)).toBeNull();
  });
});
