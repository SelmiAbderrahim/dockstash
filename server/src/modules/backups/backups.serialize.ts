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
  /** Fleet agent this project runs on; null = the local/default server. */
  agentId: string | null;
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
  lastRestoreAt: string | null;
  lastRestoreStatus: 'pass' | 'fail' | null;
  lastRestoreDetail: string;
  /** Per-project outbound alert webhook (Pro+); '' = unset. */
  alertWebhookUrl: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeProject(project: ProjectHydrated): PublicProject {
  return {
    id: project._id.toString(),
    owner: project.owner.toString(),
    name: project.name,
    path: project.path,
    agentId: project.agent ? project.agent.toString() : null,
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
    lastRestoreAt: project.lastRestoreAt
      ? new Date(project.lastRestoreAt).toISOString()
      : null,
    lastRestoreStatus: (project.lastRestoreStatus ?? null) as 'pass' | 'fail' | null,
    lastRestoreDetail: project.lastRestoreDetail ?? '',
    alertWebhookUrl: project.alertWebhookUrl ?? '',
    createdAt: new Date((project as unknown as { createdAt: Date }).createdAt).toISOString(),
    updatedAt: new Date((project as unknown as { updatedAt: Date }).updatedAt).toISOString(),
  };
}

import type { ResticSnapshotDetail } from './backups.restic-runner.js';

/** Public JSON shape for a restic snapshot, matching the client contract. */
export interface PublicSnapshot {
  id: string;
  projectId: string;
  time: string;
  sizeBytes: number;
  hostname?: string;
  tags?: string[];
}

export function serializeSnapshot(
  snap: ResticSnapshotDetail,
  projectId: string,
): PublicSnapshot {
  const out: PublicSnapshot = {
    // Short ids are stable restore identifiers and friendlier in the UI.
    id: snap.short_id || snap.id,
    projectId,
    time: snap.time,
    sizeBytes: snap.summary?.total_bytes_processed ?? 0,
  };
  if (snap.hostname) out.hostname = snap.hostname;
  if (snap.tags && snap.tags.length > 0) out.tags = snap.tags;
  return out;
}
