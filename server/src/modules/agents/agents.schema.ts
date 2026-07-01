import { z } from 'zod';

export const registerAgentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  host: z.string().trim().min(1).max(255),
  port: z.number().int().min(1).max(65535).optional(),
});
export type RegisterAgentInput = z.infer<typeof registerAgentSchema>;

export const agentIdParamsSchema = z.object({
  agentId: z.string().regex(/^[a-f0-9]{24}$/i, 'invalid agent id'),
});
