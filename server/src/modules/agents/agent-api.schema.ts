import { z } from 'zod';

// Discovery snapshot the daemon ships on heartbeat. Machine-supplied — validated
// with hard caps so a rogue/buggy agent can never bloat the Agent doc.
const discoveredFolderInput = z.object({
  name: z.string().max(255),
  path: z.string().max(1024),
  hasCompose: z.boolean(),
  composeFile: z.string().max(64).nullable(),
});

const containerSummaryInput = z.object({
  id: z.string().max(128),
  names: z.array(z.string().max(255)).max(20),
  image: z.string().max(512),
  state: z.string().max(32),
  labels: z
    .record(z.string().max(512))
    .refine((l) => Object.keys(l).length <= 50, { message: 'too many labels' }),
});

export const agentDiscoveryInput = z.object({
  folders: z.array(discoveredFolderInput).max(200),
  containers: z.array(containerSummaryInput).max(500),
  dockerAvailable: z.boolean(),
});
export type AgentDiscoveryInput = z.infer<typeof agentDiscoveryInput>;

export const agentHeartbeatSchema = z.object({
  version: z.string().max(40).optional(),
  hostname: z.string().max(255).optional(),
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
