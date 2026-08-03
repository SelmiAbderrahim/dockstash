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
import { DEFAULT_AGENT_ROOTS, isPathUnderRoots } from '../backups/backups.paths.js';
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
  /** Agent-reported DOCKSTASH_PROJECT_ROOTS; absent/empty on pre-0.2.0 agents. */
  roots?: string[];
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
  /** The allowlist this agent scans — shown so out-of-roots groups are explainable. */
  roots: string[];
  snapshotAt: string | null;
  /** True once the agent has ever sent a heartbeat; false means "never reported". */
  reported: boolean;
  /** Reasons the snapshot came back empty/degraded (e.g. unreadable root, Docker unreachable). */
  errors: string[];
}

const EMPTY_VIEW: AgentDiscoveryView = {
  folders: [],
  containers: [],
  dockerAvailable: false,
  roots: [...DEFAULT_AGENT_ROOTS],
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
  roots: readonly string[],
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
  return {
    paths: [workingDir],
    databases,
    // The agent can only read (and restic only back up) paths under its
    // mounted roots — drop derived config dirs the agent could never reach,
    // instead of shipping a plan that fails `path not allowed` at run time.
    configs: Array.from(configs).filter((c) => isPathUnderRoots(c, roots)),
  };
}

/**
 * Shape a stored snapshot (or `null` when the agent never reported) into the
 * browse view. Addable Compose groups carry a derived plan; plain folders get a
 * files-only plan.
 */
export function buildAgentDiscoveryView(snapshot: StoredSnapshot | null): AgentDiscoveryView {
  if (!snapshot) return EMPTY_VIEW;

  const roots =
    snapshot.roots && snapshot.roots.length > 0 ? snapshot.roots : [...DEFAULT_AGENT_ROOTS];

  // `addable` from grouping validates against the static local allowlist —
  // re-derive it here against THIS agent's roots so a project under e.g.
  // /srv/apps is addable when the agent mounts /srv/apps.
  const containers: AgentContainerView[] = groupByComposeProject(snapshot.containers).map(
    (group) => {
      const addable =
        !group.standalone &&
        group.workingDir !== null &&
        isPathUnderRoots(group.workingDir, roots);
      return {
        ...group,
        addable,
        plan:
          addable && group.workingDir !== null
            ? planForProject(group.project, group.workingDir, snapshot.containers, roots)
            : null,
      };
    },
  );

  // Map fields explicitly — `snapshot.folders` may be Mongoose subdocuments,
  // whose data lives behind prototype getters. A `{...f}` spread would copy
  // internal state (`__parentArray`, `_doc`) instead of `name`/`path` and ship
  // it to the client as garbage folder entries.
  const folders: AgentFolderView[] = snapshot.folders.map((f) => ({
    name: f.name,
    path: f.path,
    hasCompose: f.hasCompose,
    composeFile: f.composeFile,
    plan: { paths: [f.path], databases: [], configs: [] },
  }));

  return {
    folders,
    containers,
    dockerAvailable: snapshot.dockerAvailable,
    roots,
    snapshotAt: snapshot.snapshotAt ? new Date(snapshot.snapshotAt).toISOString() : null,
    reported: true,
    errors: snapshot.discoveryErrors ?? [],
  };
}
