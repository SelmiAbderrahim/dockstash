export interface Snapshot {
  id: string;
  projectId: string;
  time: string;
  sizeBytes: number;
  hostname?: string;
  tags?: string[];
}

export interface RestoreOptions {
  snapshotId: string;
  projectId: string;
  overwrite: boolean;
  targetPath?: string;
}
