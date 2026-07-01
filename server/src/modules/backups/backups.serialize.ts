import type { ProjectHydrated } from './backups.model.js';

/**
 * Public JSON shape for a project. `repoPasswordEnc` MUST never appear here —
 * neither the ciphertext nor the decrypted value leaves the server.
 */
export interface PublicProject {
  id: string;
  owner: string;
  name: string;
  path: string;
  plan: {
    paths: string[];
    databases: Array<{ service: string; type: string; container: string; enabled: boolean }>;
    configs: string[];
  };
  lastStatus: string;
  lastError: string;
  lastRunAt: string | null;
  lastCheckAt: string | null;
  lastCheckStatus: 'pass' | 'fail' | null;
  lastCheckDetail: string;
  lastDrillAt: string | null;
  lastDrillStatus: 'pass' | 'fail' | null;
  lastDrillDetail: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeProject(project: ProjectHydrated): PublicProject {
  return {
    id: project._id.toString(),
    owner: project.owner.toString(),
    name: project.name,
    path: project.path,
    plan: {
      paths: [...project.plan.paths],
      databases: project.plan.databases.map((d) => ({
        service: d.service,
        type: d.type,
        container: d.container,
        enabled: d.enabled,
      })),
      configs: [...project.plan.configs],
    },
    lastStatus: project.lastStatus,
    lastError: project.lastError,
    lastRunAt: project.lastRunAt ? new Date(project.lastRunAt).toISOString() : null,
    lastCheckAt: project.lastCheckAt ? new Date(project.lastCheckAt).toISOString() : null,
    lastCheckStatus: (project.lastCheckStatus ?? null) as 'pass' | 'fail' | null,
    lastCheckDetail: project.lastCheckDetail ?? '',
    lastDrillAt: project.lastDrillAt ? new Date(project.lastDrillAt).toISOString() : null,
    lastDrillStatus: (project.lastDrillStatus ?? null) as 'pass' | 'fail' | null,
    lastDrillDetail: project.lastDrillDetail ?? '',
    createdAt: new Date((project as unknown as { createdAt: Date }).createdAt).toISOString(),
    updatedAt: new Date((project as unknown as { updatedAt: Date }).updatedAt).toISOString(),
  };
}
