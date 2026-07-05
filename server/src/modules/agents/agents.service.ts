import { randomBytes } from 'node:crypto';
import { HttpError } from '../../shared/utils/http-error.js';
import { hashApiSecret } from '../../shared/crypto/index.js';
import { translate, DEFAULT_LOCALE } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { Project } from '../backups/backups.model.js';
import { DEFAULT_AGENT_ROOTS } from '../backups/backups.paths.js';
import { Agent, type AgentHydrated } from './agents.model.js';
import { AgentJob } from './agent-jobs.model.js';
import type { RegisterAgentInput } from './agents.schema.js';
import type { AgentDiscoveryInput } from './agent-api.schema.js';

type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/** Composite token prefix — secret-scanner-friendly, embeds the agent id. */
const TOKEN_PREFIX = 'dsa_';

/**
 * The daemon version the published image ships — mirrors AGENT_VERSION in
 * agent/src/main.ts (bump both together). Returned on every heartbeat so a
 * stale daemon warns in its own logs, and surfaced as `outdated` on the fleet
 * API so the UI can tell the operator to rerun setup.
 */
export const EXPECTED_AGENT_VERSION = '0.2.2';

/**
 * The allowlist for an agent-assigned project: the roots the agent reported on
 * its last discovery heartbeat (already sanitized by the heartbeat schema), or
 * the legacy /var/www default for agents that never reported roots.
 */
export function allowedRootsForAgent(
  agent: Pick<AgentHydrated, 'discovery'>,
): string[] {
  const roots = agent.discovery?.roots ?? [];
  return roots.length > 0 ? [...roots] : [...DEFAULT_AGENT_ROOTS];
}

/** True when the daemon self-reported a version older than the published one. */
export function isAgentOutdated(agent: Pick<AgentHydrated, 'agentVersion'>): boolean {
  return agent.agentVersion !== '' && agent.agentVersion !== EXPECTED_AGENT_VERSION;
}

function mintSecret(): string {
  return randomBytes(24).toString('hex');
}

function composeToken(agentId: string, secret: string): string {
  return `${TOKEN_PREFIX}${agentId}.${secret}`;
}

export interface RegisterAgentResult {
  agent: AgentHydrated;
  /** Composite token `dsa_<agentId>.<secret>` — returned ONCE, never stored. */
  token: string;
}

/** Register a backup agent (a VPS host). Mints + hashes its API secret. */
export async function registerAgent(
  userId: string,
  input: RegisterAgentInput,
  deps: { t?: Translator } = {},
): Promise<RegisterAgentResult> {
  const t = deps.t ?? identityT;
  // A host is registered once per account. Pre-check for a friendly 409; the
  // unique (owner, host) index is the race-proof backstop for concurrent POSTs.
  const existing = await Agent.findOne({ owner: userId, host: input.host });
  if (existing) throw HttpError.conflict(t('agents.error.duplicateHost'));
  const secret = mintSecret();
  const agent = await Agent.create({
    owner: userId,
    name: input.name,
    host: input.host,
    port: input.port ?? 22,
    apiKeyHash: hashApiSecret(secret),
    status: 'offline',
  });
  return { agent, token: composeToken(String(agent._id), secret) };
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

/** Mint a fresh secret for an agent; the old token stops working immediately. */
export async function rotateAgentKey(
  agentId: string,
  userId: string,
  deps: { t?: Translator } = {},
): Promise<RegisterAgentResult> {
  const agent = await loadOwnedAgent(agentId, userId, deps);
  const secret = mintSecret();
  agent.apiKeyHash = hashApiSecret(secret);
  await agent.save();
  return { agent, token: composeToken(String(agent._id), secret) };
}

/**
 * Delete an agent: unassign its projects (they fall back to local execution)
 * and fail any queued/leased jobs so nothing dangles.
 */
export async function deleteAgent(
  agentId: string,
  userId: string,
  deps: { t?: Translator; now?: Date } = {},
): Promise<void> {
  const agent = await loadOwnedAgent(agentId, userId, deps);
  await Project.updateMany({ agent: agent._id }, { agent: null });
  await AgentJob.updateMany(
    { agent: agent._id, status: { $in: ['pending', 'leased'] } },
    { status: 'failed', error: 'agent deleted', finishedAt: deps.now ?? new Date() },
  );
  await agent.deleteOne();
}

export interface AgentHeartbeatInfo {
  version?: string;
  hostname?: string;
  discovery?: AgentDiscoveryInput;
}

/** Mark an agent as seen — sets status online + lastSeenAt + self-reported info. */
export async function touchAgentHeartbeat(
  agentId: string,
  info: AgentHeartbeatInfo = {},
  deps: { now?: Date } = {},
): Promise<AgentHydrated | null> {
  const now = deps.now ?? new Date();
  if (info.discovery) {
    logger.debug(
      {
        agentId,
        folders: info.discovery.folders.length,
        containers: info.discovery.containers.length,
        dockerAvailable: info.discovery.dockerAvailable,
      },
      'agent discovery snapshot stored',
    );
  }
  return Agent.findByIdAndUpdate(
    agentId,
    {
      status: 'online',
      lastSeenAt: now,
      ...(info.version !== undefined ? { agentVersion: info.version } : {}),
      ...(info.hostname !== undefined ? { hostname: info.hostname } : {}),
      ...(info.discovery !== undefined
        ? {
            // Stored as `discoveryErrors` — `errors` is a reserved Mongoose
            // Document pathname (see agents.model.ts).
            discovery: (({ errors, ...rest }) => ({
              ...rest,
              discoveryErrors: errors,
              snapshotAt: now,
            }))(info.discovery),
          }
        : {}),
    },
    { new: true },
  );
}

/**
 * Record that the operator wants a fresh discovery snapshot. The server can't
 * reach the agent directly (outbound-only), so this just sets a flag the next
 * machine heartbeat picks up (see `consumeDiscoveryRefreshRequest`).
 */
export async function requestDiscoveryRefresh(
  agentId: string,
  userId: string,
  deps: { t?: Translator; now?: Date } = {},
): Promise<void> {
  const agent = await loadOwnedAgent(agentId, userId, deps);
  agent.discoveryRequestedAt = deps.now ?? new Date();
  await agent.save();
}

/**
 * Atomically clear a pending discovery-refresh request, reporting whether one
 * was pending. Called once per heartbeat so the flag is consumed exactly once.
 */
export async function consumeDiscoveryRefreshRequest(agentId: string): Promise<boolean> {
  const agent = await Agent.findOneAndUpdate(
    { _id: agentId, discoveryRequestedAt: { $ne: null } },
    { discoveryRequestedAt: null },
  );
  return !!agent;
}

/**
 * Effective liveness, computed at read time: `online` only when the stored
 * status says so AND the last heartbeat is fresh. The persisting sweep runs
 * every 5 minutes, so without this an agent could show online for minutes
 * after dying.
 */
export function effectiveAgentStatus(
  agent: Pick<AgentHydrated, 'status' | 'lastSeenAt'>,
  now: Date = new Date(),
): 'online' | 'offline' {
  if (agent.status !== 'online' || !agent.lastSeenAt) return 'offline';
  const cutoff = now.getTime() - env.AGENT_OFFLINE_AFTER_SECONDS * 1000;
  return new Date(agent.lastSeenAt).getTime() >= cutoff ? 'online' : 'offline';
}

/** Persisting offline sweep — flips stale `online` rows so lists stay honest. */
export async function sweepOfflineAgents(now: Date = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - env.AGENT_OFFLINE_AFTER_SECONDS * 1000);
  await Agent.updateMany(
    { status: 'online', lastSeenAt: { $lt: cutoff } },
    { status: 'offline' },
  );
}

export interface AgentFleetEntry {
  id: string;
  name: string;
  host: string;
  status: string;
  lastSeenAt: string | null;
  agentVersion: string;
  /** Daemon self-reported a version behind EXPECTED_AGENT_VERSION — rerun setup. */
  outdated: boolean;
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
  const now = new Date();
  return agents.map((a) => {
    const mine = projects.filter((p) => String(p.agent) === String(a._id));
    return {
      id: String(a._id),
      name: a.name,
      host: a.host,
      status: effectiveAgentStatus(a, now),
      lastSeenAt: a.lastSeenAt ? new Date(a.lastSeenAt).toISOString() : null,
      agentVersion: a.agentVersion,
      outdated: isAgentOutdated(a),
      projectCount: mine.length,
      totalBytes: mine.reduce((sum, p) => sum + p.totalRepoBytes, 0),
      snapshotCount: mine.reduce((sum, p) => sum + p.snapshotCount, 0),
    };
  });
}
