// Vendored from server/src/modules/backups/backups.restic-runner.ts — keep in sync manually.
// Changes: no config/env import (binary/cacheDir are required constructor options);
// ResticRunnerExt is declared locally; snapshotsDetailed retained for `restic stats`.
import { spawn as nodeSpawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Readable } from 'node:stream';

export interface ResticRunnerExt {
  init(): Promise<void>;
  backup(args: string[], options?: { stdin?: Readable }): Promise<void>;
  snapshots(): Promise<Array<{ id: string; time: string }>>;
  snapshotsDetailed(): Promise<ResticSnapshotDetail[]>;
  stats(): Promise<ResticStats>;
  check(args: string[]): Promise<void>;
  restore(args: string[]): Promise<void>;
  unlock(): Promise<void>;
  forget(args: string[]): Promise<void>;
}

/** Narrow child-process surface so tests can inject an EventEmitter stub. */
export interface SpawnedChild {
  stdin: NodeJS.WritableStream | null;
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: 'close', listener: (code: number | null) => void): void;
}

export type SpawnImpl = (
  binary: string,
  argv: string[],
  options: { env: NodeJS.ProcessEnv; stdio: Array<'pipe' | 'ignore'> },
) => SpawnedChild;

/**
 * Materializes decrypted SSH key material as a short-lived 0600 file (tmpfs in
 * the container) and removes it in `finally`. Injectable so unit tests never
 * touch the filesystem.
 */
export interface KeyMaterializer {
  withKeyFiles<T>(
    material: { privateKey: string; hostKeyLine: string },
    run: (paths: { keyPath: string; knownHostsPath: string }) => Promise<T>,
  ): Promise<T>;
}

/**
 * Normalize a pasted SSH private key so OpenSSH/libcrypto can load it: strip
 * CRLF line endings and guarantee one trailing newline. Without this, keys
 * pasted through the dashboard textarea fail with
 * `Load key "...": error in libcrypto`. Kept in sync with
 * server/src/shared/utils/ssh-key.ts.
 */
export function normalizePrivateKey(privateKey: string): string {
  const body = privateKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  return `${body}\n`;
}

export class TmpfsKeyMaterializer implements KeyMaterializer {
  constructor(private readonly baseDir: string = os.tmpdir()) {}

  async withKeyFiles<T>(
    material: { privateKey: string; hostKeyLine: string },
    run: (paths: { keyPath: string; knownHostsPath: string }) => Promise<T>,
  ): Promise<T> {
    const dir = await fs.mkdtemp(path.join(this.baseDir, 'dockstash-ssh-'));
    const keyPath = path.join(dir, 'id_key');
    const knownHostsPath = path.join(dir, 'known_hosts');
    try {
      await fs.writeFile(keyPath, normalizePrivateKey(material.privateKey), { mode: 0o600 });
      await fs.writeFile(knownHostsPath, `${material.hostKeyLine}\n`, { mode: 0o600 });
      return await run({ keyPath, knownHostsPath });
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
}

export interface ProcessResticRunnerOptions {
  repoUrl: string;
  password: string;
  /** Present for SFTP repos; local repos (tests) omit it. */
  ssh?: { privateKey: string; hostKeyLine: string };
  binary: string;
  cacheDir: string;
  spawnImpl?: SpawnImpl;
  keyMaterializer?: KeyMaterializer;
}

export interface ResticSnapshotDetail {
  id: string;
  short_id: string;
  time: string;
  hostname?: string;
  tags?: string[];
  paths?: string[];
  summary?: { total_bytes_processed?: number };
}

/** `restic stats --json` payload — feeds the job resultStats metering. */
export interface ResticStats {
  total_size?: number;
  total_file_count?: number;
  snapshots_count?: number;
}

const INIT_ALREADY = /config file already exists|repository master key and config already initialized/i;

/**
 * The concrete restic runner: spawns the pinned binary argv-only (never a
 * shell), passes the repo password via env, and — for SFTP repos — forces
 * `StrictHostKeyChecking=yes` against a known_hosts file generated from the
 * pinned host-key line. A changed host key fails loudly; no auto-accept path.
 */
export class ProcessResticRunner implements ResticRunnerExt {
  private readonly repoUrl: string;
  private readonly password: string;
  private readonly ssh?: { privateKey: string; hostKeyLine: string };
  private readonly binary: string;
  private readonly cacheDir: string;
  private readonly spawnImpl: SpawnImpl;
  private readonly keys: KeyMaterializer;

  constructor(opts: ProcessResticRunnerOptions) {
    this.repoUrl = opts.repoUrl;
    this.password = opts.password;
    this.ssh = opts.ssh;
    this.binary = opts.binary;
    this.cacheDir = opts.cacheDir;
    this.spawnImpl = opts.spawnImpl ?? (nodeSpawn as unknown as SpawnImpl);
    this.keys = opts.keyMaterializer ?? new TmpfsKeyMaterializer();
  }

  private async run(
    args: string[],
    opts: { stdin?: Readable; collectStdout?: boolean } = {},
  ): Promise<string> {
    const exec = (sshArgs: string[]): Promise<string> =>
      new Promise((resolve, reject) => {
        const argv = ['-r', this.repoUrl, '--cache-dir', this.cacheDir, ...sshArgs, ...args];
        const child = this.spawnImpl(this.binary, argv, {
          env: {
            ...process.env,
            RESTIC_PASSWORD: this.password,
          },
          stdio: [opts.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (b: Buffer) => {
          if (opts.collectStdout) stdout += b.toString();
        });
        child.stderr?.on('data', (b: Buffer) => {
          stderr += b.toString();
        });
        child.on('error', reject);
        child.on('close', (code) => {
          if (code === 0) resolve(stdout);
          else reject(new Error(`restic ${args[0] ?? ''} exit ${code}: ${stderr.trim()}`));
        });
        if (opts.stdin && child.stdin) opts.stdin.pipe(child.stdin);
      });

    if (!this.ssh) return exec([]);
    return this.keys.withKeyFiles(this.ssh, ({ keyPath, knownHostsPath }) =>
      exec([
        '-o',
        // sftp.args (NOT sftp.command): restic keeps building the ssh argv —
        // `ssh <host> -l <user> [-p <port>] <these args> -s sftp` — and injects
        // ours. sftp.command would be used VERBATIM, dropping the destination
        // from the repo URL, and ssh then dies with "You must specify a
        // subsystem to invoke." StrictHostKeyChecking=yes is the whole point:
        // the known_hosts file holds exactly the pinned line, so any other key
        // is rejected. BatchMode=yes makes an auth failure fail fast instead
        // of hanging the job on an interactive prompt.
        `sftp.args=-i ${keyPath} -o StrictHostKeyChecking=yes -o UserKnownHostsFile=${knownHostsPath} -o BatchMode=yes`,
      ]),
    );
  }

  async init(): Promise<void> {
    // run() only ever rejects with Error instances.
    await this.run(['init']).catch((err: Error) => {
      if (INIT_ALREADY.test(err.message)) return;
      throw err;
    });
  }

  async backup(args: string[], options?: { stdin?: Readable }): Promise<void> {
    await this.run(args, { stdin: options?.stdin });
  }

  async snapshots(): Promise<Array<{ id: string; time: string }>> {
    const detailed = await this.snapshotsDetailed();
    return detailed.map((s) => ({ id: s.id, time: s.time }));
  }

  /** Full snapshot records (`restic snapshots --json`). */
  async snapshotsDetailed(): Promise<ResticSnapshotDetail[]> {
    const out = await this.run(['snapshots', '--json'], { collectStdout: true });
    let parsed: unknown;
    try {
      parsed = JSON.parse(out || '[]');
    } catch {
      throw new Error('restic snapshots returned malformed JSON');
    }
    if (!Array.isArray(parsed)) {
      throw new Error('restic snapshots returned a non-array payload');
    }
    return parsed as ResticSnapshotDetail[];
  }

  /** Repo-wide `restic stats --json` — feeds resultStats metering. */
  async stats(): Promise<ResticStats> {
    const out = await this.run(['stats', '--json'], { collectStdout: true });
    try {
      return JSON.parse(out || '{}') as ResticStats;
    } catch {
      throw new Error('restic stats returned malformed JSON');
    }
  }

  async check(args: string[]): Promise<void> {
    await this.run(args);
  }

  async restore(args: string[]): Promise<void> {
    await this.run(args);
  }

  async unlock(): Promise<void> {
    await this.run(['unlock']);
  }

  async forget(args: string[]): Promise<void> {
    await this.run(args);
  }
}
