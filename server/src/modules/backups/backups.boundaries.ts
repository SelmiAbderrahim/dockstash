import type { Readable } from 'node:stream';

export interface ResticBackupOptions {
  stdin?: Readable;
}

export interface ResticRunner {
  init(): Promise<void>;
  backup(args: string[], options?: ResticBackupOptions): Promise<void>;
  snapshots(): Promise<Array<{ id: string; time: string }>>;
  /** Structure integrity via `restic check`; passes `--read-data-subset` when provided. */
  check(args: string[]): Promise<void>;
  /** Restore a snapshot to disk. Argv-only; never a shell string. */
  restore(args: string[]): Promise<void>;
}

/** Isolated scratch workspace used by restore drills. `remove` MUST tolerate a missing path. */
export interface ScratchWorkspace {
  create(): Promise<string>;
  remove(path: string): Promise<void>;
}

export interface FileDiffResult {
  mismatches: number;
  details: string[];
}

/** Byte/hash-diff a restored file tree against its source root. */
export interface FileDiffer {
  diff(sourceRoot: string, restoredRoot: string): Promise<FileDiffResult>;
}

export interface DbDiffInput {
  container: string;
  service: string;
  restoredDumpPath: string;
}

export interface DbDiffResult {
  mismatches: number;
  details: string[];
}

/** Row-diff a restored dump against the live source DB (or parse the dump). */
export interface DbDiffer {
  diff(input: DbDiffInput): Promise<DbDiffResult>;
}

/**
 * A running container as surfaced by `GET /containers/json`. Only the fields the
 * discovery grouping needs are carried forward; `labels` bears the compose
 * metadata (`com.docker.compose.*`) used to reconstruct project groupings.
 */
export interface DockerContainerSummary {
  id: string;
  names: string[];
  image: string;
  state: string;
  labels: Record<string, string>;
}

export interface DockerClient {
  exec(container: string, argv: string[]): Promise<Readable>;
  inspect(container: string): Promise<{ id: string; running: boolean }>;
  /** List running containers (read-only) for local Compose-project discovery. */
  listContainers(): Promise<DockerContainerSummary[]>;
}

/**
 * Storage-VPS SSH transport. Every implementation MUST pin the host key —
 * `verifyHostKey` is called at connection setup and rejects any mismatch
 * against the stored `sha256:BASE64` fingerprint. No `StrictHostKeyChecking=no`,
 * no first-connect auto-accept. See docs/security-model.en.md.
 */
export interface SshTransport {
  repoUrl(project: { id: string; owner: string }): string;
  /**
   * Assert the peer host key matches the pinned fingerprint.
   * Throws `HttpError.internal` (with a localized message) on mismatch.
   */
  verifyHostKey(observed: { fingerprint: string }): void;
}

export interface DiskSpaceProbe {
  freeBytes(): Promise<number>;
}

/**
 * The minimum free space (bytes) required before starting a backup run.
 * Tuned high enough to cover a modest dump; overridden in tests.
 */
export const MIN_FREE_BYTES_DEFAULT = 100 * 1024 * 1024;
