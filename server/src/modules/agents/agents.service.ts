import { randomBytes } from 'node:crypto';
import { HttpError } from '../../shared/utils/http-error.js';
import { encryptSecret } from '../../shared/crypto/index.js';
import { translate, DEFAULT_LOCALE } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import { Agent, type AgentHydrated } from './agents.model.js';
import type { RegisterAgentInput } from './agents.schema.js';

type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface RegisterAgentResult {
  agent: AgentHydrated;
  /** Plaintext API key — returned ONCE at registration, never stored in the clear. */
  apiKey: string;
}

/** Register a backup agent (a VPS host). Generates + encrypts its API key. */
export async function registerAgent(
  userId: string,
  input: RegisterAgentInput,
): Promise<RegisterAgentResult> {
  const apiKey = randomBytes(24).toString('hex');
  const agent = await Agent.create({
    owner: userId,
    name: input.name,
    host: input.host,
    port: input.port ?? 22,
    apiKeyEnc: encryptSecret(apiKey),
    status: 'offline',
  });
  return { agent, apiKey };
}

export async function listAgentsForUser(userId: string): Promise<AgentHydrated[]> {
  return Agent.find({ owner: userId }).sort({ createdAt: 1 });
}

export async function loadOwnedAgent(
  agentId: string,
  userId: string,
  deps: { t?: Translator } = {},
): Promise<AgentHydrated> {
  const t = deps.t ?? identityT;
  const agent = await Agent.findById(agentId);
  if (!agent) throw HttpError.notFound(t('agents.error.notFound'));
  if (agent.owner.toString() !== userId) {
    throw HttpError.forbidden(t('agents.error.notOwner'));
  }
  return agent;
}

/** Mark an agent as seen (heartbeat) — sets status online + lastSeenAt. */
export async function heartbeatAgent(
  agentId: string,
  userId: string,
  deps: { t?: Translator; now?: Date } = {},
): Promise<AgentHydrated> {
  const agent = await loadOwnedAgent(agentId, userId, deps);
  agent.status = 'online';
  agent.lastSeenAt = deps.now ?? new Date();
  await agent.save();
  return agent;
}

export interface AgentFleetEntry {
  id: string;
  name: string;
  host: string;
  status: string;
  lastSeenAt: string | null;
  projectCount: number;
  totalBytes: number;
  snapshotCount: number;
}

/** Fleet rollup: every agent + the project/storage totals assigned to it. */
export async function computeFleet(userId: string): Promise<AgentFleetEntry[]> {
  const agents = await listAgentsForUser(userId);
  const projects = await Project.find({ owner: userId })
    .select('agent totalRepoBytes snapshotCount')
    .lean();
  return agents.map((a) => {
    const mine = projects.filter((p) => String(p.agent) === String(a._id));
    return {
      id: String(a._id),
      name: a.name,
      host: a.host,
      status: a.status,
      lastSeenAt: a.lastSeenAt ? new Date(a.lastSeenAt).toISOString() : null,
      projectCount: mine.length,
      totalBytes: mine.reduce((sum, p) => sum + p.totalRepoBytes, 0),
      snapshotCount: mine.reduce((sum, p) => sum + p.snapshotCount, 0),
    };
  });
}
