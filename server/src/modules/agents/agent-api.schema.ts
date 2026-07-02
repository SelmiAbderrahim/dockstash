import { z } from 'zod';

export const agentHeartbeatSchema = z.object({
  version: z.string().max(40).optional(),
  hostname: z.string().max(255).optional(),
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
