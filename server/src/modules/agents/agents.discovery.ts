// Transforms a stored raw discovery snapshot (folders + running containers a
// fleet agent reported on heartbeat) into the browse view the Add-Project flow
// consumes: Compose groups + a backup plan DERIVED FROM THE LIVE CONTAINERS
// (image → adapter), so the server never needs to read the agent's compose file.
import {
  groupByComposeProject,
  type DiscoveredContainerGroup,
} from '../backups/backups.discover.js';
import type { DockerContainerSummary } from '../backups/backups.boundaries.js';
import { matchAdapter } from '../backups/backups.adapters.js';
import type { BackupPlan, DatabasePlan } from '../backups/backups.scan.js';

const LABEL_PROJECT = 'com.docker.compose.project';
const LABEL_SERVICE = 'com.docker.compose.service';

export interface SnapshotFolder {
  name: string;
  path: string;
  hasCompose: boolean;
  composeFile: string | null;
}

export interface StoredSnapshot {
  folders: SnapshotFolder[];
  containers: DockerContainerSummary[];
  dockerAvailable: boolean;
  snapshotAt: Date | null;
  /**
   * Human-readable causes for an empty/degraded snapshot (older stored docs
   * may lack this). Named `discoveryErrors` on the stored document — `errors`
   * is a reserved Mongoose Document pathname (see agents.model.ts).
   */
  discoveryErrors?: string[];
}

export interface AgentFolderView extends SnapshotFolder {
  /** A files-only plan — a plain remote folder has no DB layers to detect. */
  plan: BackupPlan;
}

export interface AgentContainerView extends DiscoveredContainerGroup {
  /** Derived from the running containers; null when the group is not addable. */
  plan: BackupPlan | null;
}

export interface AgentDiscoveryView {
  folders: AgentFolderView[];
  containers: AgentContainerView[];
  dockerAvailable: boolean;
  snapshotAt: string | null;
  /** True once the agent has ever sent a heartbeat; false means "never reported". */
  reported: boolean;
  /** Reasons the snapshot came back empty/degraded (e.g. unreadable /var/www, Docker unreachable). */
  errors: string[];
}

const EMPTY_VIEW: AgentDiscoveryView = {
  folders: [],
  containers: [],
  dockerAvailable: false,
  snapshotAt: null,
  reported: false,
  errors: [],
};

function containerName(c: DockerContainerSummary): string {
  return (c.names[0] ?? c.id).replace(/^\//, '');
}

/** Build a backup plan for one Compose project from its live containers. */
function planForProject(
  project: string,
  workingDir: string,
  raw: DockerContainerSummary[],
): BackupPlan {
  const databases: DatabasePlan[] = [];
  const configs = new Set<string>();
  for (const c of raw) {
    if (c.labels[LABEL_PROJECT] !== project) continue;
    const service = c.labels[LABEL_SERVICE] ?? c.image;
    const adapter = matchAdapter(c.image);
    if (adapter) {
      databases.push({ service, type: adapter.type, container: containerName(c), enabled: true });
    }
    if (/traefik/i.test(c.image)) configs.add('/etc/traefik');
    if (/nginx/i.test(c.image)) configs.add('/etc/nginx');
  }
  return { paths: [workingDir], databases, configs: Array.from(configs) };
}

/**
 * Shape a stored snapshot (or `null` when the agent never reported) into the
 * browse view. Addable Compose groups carry a derived plan; plain folders get a
 * files-only plan.
 */
export function buildAgentDiscoveryView(snapshot: StoredSnapshot | null): AgentDiscoveryView {
  if (!snapshot) return EMPTY_VIEW;

  const containers: AgentContainerView[] = groupByComposeProject(snapshot.containers).map(
    (group) => ({
      ...group,
      plan:
        group.addable && group.workingDir !== null
          ? planForProject(group.project, group.workingDir, snapshot.containers)
          : null,
    }),
  );

  const folders: AgentFolderView[] = snapshot.folders.map((f) => ({
    ...f,
    plan: { paths: [f.path], databases: [], configs: [] },
  }));

  return {
    folders,
    containers,
    dockerAvailable: snapshot.dockerAvailable,
    snapshotAt: snapshot.snapshotAt ? new Date(snapshot.snapshotAt).toISOString() : null,
    reported: true,
    errors: snapshot.discoveryErrors ?? [],
  };
}
