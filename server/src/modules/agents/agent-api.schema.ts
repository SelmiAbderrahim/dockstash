import { z } from 'zod';

// Discovery snapshot the daemon ships on heartbeat. Machine-supplied, so we still
// enforce hard caps to keep a rogue/buggy agent from bloating the Agent doc — but
// the caps SALVAGE (truncate/slice) instead of REJECT. A single over-long label or
// an extra container must never make the whole snapshot fail validation, because
// that would blank the operator's project picker (folders included) with no signal.
// Genuinely malformed structure (wrong types) still fails safeParse in the handler,
// which drops only `discovery` and keeps the heartbeat/liveness intact.
const truncate = (max: number) => (s: string): string => s.slice(0, max);

const MAX_LABELS = 50;
const MAX_NAMES = 20;
const MAX_FOLDERS = 200;
const MAX_CONTAINERS = 500;

const discoveredFolderInput = z.object({
  name: z.string().transform(truncate(255)),
  path: z.string().transform(truncate(1024)),
  hasCompose: z.boolean(),
  composeFile: z.string().transform(truncate(64)).nullable(),
});

const containerSummaryInput = z.object({
  id: z.string().transform(truncate(128)),
  names: z.array(z.string().transform(truncate(255))).transform((a) => a.slice(0, MAX_NAMES)),
  image: z.string().transform(truncate(512)),
  state: z.string().transform(truncate(32)),
  // Keep the first MAX_LABELS entries, truncating each value — never reject.
  labels: z.record(z.string()).transform((l) =>
    Object.fromEntries(
      Object.entries(l)
        .slice(0, MAX_LABELS)
        .map(([k, v]) => [k, v.slice(0, 512)]),
    ),
  ),
});

export const agentDiscoveryInput = z.object({
  folders: z.array(discoveredFolderInput).transform((a) => a.slice(0, MAX_FOLDERS)),
  containers: z.array(containerSummaryInput).transform((a) => a.slice(0, MAX_CONTAINERS)),
  dockerAvailable: z.boolean(),
});
export type AgentDiscoveryInput = z.infer<typeof agentDiscoveryInput>;

// Core liveness fields — always parsed for every heartbeat. `discovery` is parsed
// SEPARATELY in the handler so a bad snapshot can't reject the liveness update.
export const agentHeartbeatCoreSchema = z.object({
  version: z.string().max(40).optional(),
  hostname: z.string().max(255).optional(),
});

export const agentHeartbeatSchema = agentHeartbeatCoreSchema.extend({
  discovery: agentDiscoveryInput.optional(),
});
export type AgentHeartbeatInput = z.infer<typeof agentHeartbeatSchema>;

export const agentJobIdParamsSchema = z.object({
  jobId: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid job id'),
});

export const agentJobLogsSchema = z.object({
  lines: z.array(z.string().max(2048)).min(1).max(100),
});
export type AgentJobLogsInput = z.infer<typeof agentJobLogsSchema>;

export const agentJobResultSchema = z.object({
  ok: z.boolean(),
  error: z.string().max(4096).optional(),
  stats: z
    .object({
      snapshotCount: z.number().int().min(0).optional(),
      totalRepoBytes: z.number().int().min(0).optional(),
      lastBackupBytes: z.number().int().min(0).optional(),
    })
    .optional(),
});
export type AgentJobResultInputBody = z.infer<typeof agentJobResultSchema>;
