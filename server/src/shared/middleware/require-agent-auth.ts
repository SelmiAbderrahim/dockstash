import type { RequestHandler } from 'express';
import { Agent } from '../../modules/agents/agents.model.js';
import { hashApiSecret, verifyApiSecret } from '../crypto/index.js';
import { HttpError } from '../utils/http-error.js';
import { asyncHandler } from '../utils/async-handler.js';

/** Principal attached to `req.agent` on the /api/agent machine surface. */
export interface AgentPrincipal {
  id: string;
  owner: string;
  name: string;
}

/**
 * Composite agent token: `dsa_<24-hex agentId>.<48-hex secret>`.
 * Embedding the id makes verification an indexed `findById` + HMAC compare —
 * the hash itself is keyed per master-key version and non-lookupable.
 */
const TOKEN_RE = /^dsa_([0-9a-f]{24})\.([0-9a-f]{48})$/;

// Compared against when the agent id is unknown, so both the found and
// not-found paths pay the same HMAC cost (flattens the timing signal).
// Lazy: the key registry derives from env on first use, not at import time.
let dummyRecord: ReturnType<typeof hashApiSecret> | null = null;
function getDummyRecord(): ReturnType<typeof hashApiSecret> {
  dummyRecord ??= hashApiSecret('dockstash-dummy-agent-secret');
  return dummyRecord;
}

/**
 * Machine auth for the `/api/agent` surface. On success attaches
 * `req.agent = { id, owner, name }`. Always fails with ONE generic 401 —
 * never distinguishes unknown-id from bad-secret.
 */
export const requireAgentAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const match = TOKEN_RE.exec(token);
  if (!match) {
    throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
  }
  const agentId = match[1] as string;
  const secret = match[2] as string;
  const agent = await Agent.findById(agentId);
  if (!agent) {
    verifyApiSecret(secret, getDummyRecord());
    throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
  }
  if (!verifyApiSecret(secret, agent.apiKeyHash)) {
    throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
  }
  req.agent = {
    id: String(agent._id),
    owner: agent.owner.toString(),
    name: agent.name,
  };
  next();
});
