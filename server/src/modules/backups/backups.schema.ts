import { z } from 'zod';
import { isSafeAbsolutePath } from './backups.paths.js';
import { DATABASE_TYPES } from './backups.model.js';

// Structural validation only (absolute, no traversal/NUL, not `/`). WHICH
// allowlist a path must live under depends on the project's execution target —
// the local server's /var/www or the assigned agent's reported roots — so that
// check lives in the service layer (assertAllowedPath / allowedRootsForAgent),
// where the agent document is available. Every schema consumer below has a
// matching service-layer assert; never rely on this refine alone.
const projectPath = z
  .string()
  .min(1)
  .refine(isSafeAbsolutePath, { message: 'Invalid project path' });

const databaseLayerInput = z.object({
  service: z.string().min(1),
  type: z.enum(DATABASE_TYPES),
  container: z.string().min(1),
  enabled: z.boolean().optional(),
});

const planInput = z.object({
  paths: z.array(projectPath).default([]),
  databases: z.array(databaseLayerInput).default([]),
  // `configs` are backed up via the same restic argv as `paths`, so they MUST
  // pass the same allowlist (asserted in the service layer) — otherwise an
  // absolute path like /root/.ssh would be dumped into the tenant's repo
  // (arbitrary file read).
  configs: z.array(projectPath).default([]),
});

export const scanProjectSchema = z.object({
  path: projectPath,
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(120),
  path: projectPath,
  repoPassword: z.string().min(8),
  plan: planInput.optional(),
  // Assign the new project to a fleet agent at creation (Business-tier). Omitted
  // or null → runs on the local server.
  agentId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, 'invalid agent id')
    .nullable()
    .optional(),
});

export const projectIdParamsSchema = z.object({
  projectId: z.string().min(1),
});

export const updatePlanSchema = z.object({
  plan: planInput,
});

export const runCheckSchema = z.object({
  readDataSubset: z.number().int().min(1).max(100).optional(),
});

export const runDrillSchema = z.object({}).default({});

/** Assign the project to a fleet agent; null = run on the local server. */
export const assignAgentSchema = z.object({
  agentId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, 'invalid agent id')
    .nullable(),
});
export type AssignAgentInput = z.infer<typeof assignAgentSchema>;

export type ScanProjectInput = z.infer<typeof scanProjectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type RunCheckInput = z.infer<typeof runCheckSchema>;
export type RunDrillInput = z.infer<typeof runDrillSchema>;
