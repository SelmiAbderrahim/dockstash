export { backupsRouter } from './backups.routes.js';
export {
  Project,
  DATABASE_TYPES,
  BACKUP_STATUSES,
  VERIFY_STATUSES,
  type DatabaseType,
  type BackupStatus,
  type VerifyStatus,
  type ProjectDocument,
  type ProjectHydrated,
} from './backups.model.js';
export {
  scanProject,
  resolveContainerName,
  detectProxyConfigs,
  type BackupPlan,
  type DatabasePlan,
  type ScanOptions,
  type FileReader,
} from './backups.scan.js';
export {
  ADAPTER_REGISTRY,
  matchAdapter,
  postgresAdapter,
  mysqlAdapter,
  mariadbAdapter,
  mongoAdapter,
  readServiceEnv,
  type Adapter,
  type ComposeService,
} from './backups.adapters.js';
export {
  ALLOWED_PATH_ROOT,
  isAllowedProjectPath,
} from './backups.paths.js';
export { PinnedSshTransport, type SshTransportOptions } from './backups.ssh-transport.js';
export type {
  DockerClient,
  ResticRunner,
  ResticBackupOptions,
  SshTransport,
  DiskSpaceProbe,
  ScratchWorkspace,
  FileDiffer,
  FileDiffResult,
  DbDiffer,
  DbDiffInput,
  DbDiffResult,
} from './backups.boundaries.js';
export { MIN_FREE_BYTES_DEFAULT } from './backups.boundaries.js';
export {
  createProject,
  listProjectsForUser,
  loadOwnedProject,
  scanProjectPath,
  updateProjectPlan,
  runBackup,
  type CreateProjectDeps,
  type LoadOwnedProjectDeps,
  type RunBackupDeps,
  type RunBackupResult,
  type ScanServiceDeps,
  type UpdatePlanDeps,
  type Translator,
} from './backups.service.js';
export { serializeProject, type PublicProject } from './backups.serialize.js';
export {
  runResticCheck,
  runRestoreDrill,
  runScheduledChecks,
  runScheduledDrills,
  type RunCheckDeps,
  type RunCheckResult,
  type RunDrillDeps,
  type RunDrillResult,
  type ScheduleRunDeps,
  type ScheduleDrillDeps,
  type ScheduleResult,
} from './backups.verify.service.js';
export {
  configureVerifyController,
  resetVerifyController,
  type VerifyControllerDeps,
} from './backups.verify.controller.js';
export {
  ProcessResticRunner,
  TmpfsKeyMaterializer,
  type KeyMaterializer,
  type ProcessResticRunnerOptions,
  type ResticSnapshotDetail,
  type SpawnImpl,
  type SpawnedChild,
} from './backups.restic-runner.js';
export {
  HttpDockerClient,
  demuxDockerStream,
  parseDockerHost,
  type DockerRequestFn,
  type DockerStreamRequestFn,
  type HttpDockerClientOptions,
} from './backups.docker-client.js';
export {
  makeArtifactDbDiff,
  makeHashFileDiff,
  makeStatfsDiskProbe,
  makeTmpScratch,
} from './backups.diff.js';
export {
  makeDispatchDepsFor,
  makeResticRunnerFor,
  placeholderResticRunner,
  resolveProjectRunner,
  type DispatchDepsOverrides,
  type RunnerBuilder,
} from './backups.runner-factory.js';
export {
  configureSnapshotsController,
  resetSnapshotsController,
  makeProductionSnapshotLister,
  listProjectSnapshots,
  type SnapshotsControllerDeps,
} from './backups.snapshots.controller.js';
export { serializeSnapshot, type PublicSnapshot } from './backups.serialize.js';
export {
  runRestore,
  type RestoreOptions,
  type RunRestoreDeps,
  type RunRestoreResult,
} from './backups.restore.service.js';
