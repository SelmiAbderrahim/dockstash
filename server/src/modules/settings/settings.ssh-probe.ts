import { spawn as nodeSpawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { SpawnedChild, SpawnImpl } from '../backups/backups.restic-runner.js';
import type { SshProbe } from './settings.service.js';

const FINGERPRINT_LINE = /SHA256:([A-Za-z0-9+/=]+)/;

function run(
  spawnImpl: SpawnImpl,
  binary: string,
  argv: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child: SpawnedChild = spawnImpl(binary, argv, {
      env: process.env as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (b: Buffer) => {
      stdout += b.toString();
    });
    child.stderr?.on('data', (b: Buffer) => {
      stderr += b.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

export interface ProductionSshProbeOptions {
  spawnImpl?: SpawnImpl;
  baseDir?: string;
  /** ssh-keyscan connect timeout, seconds. */
  scanTimeoutSec?: number;
  /** ssh auth-check connect timeout, seconds. */
  connectTimeoutSec?: number;
}

/**
 * Production `SshProbe`: scans the host key (trust-on-first-use), derives its
 * sha256 fingerprint, then verifies the supplied private key can actually
 * authenticate — against that same scanned key, never
 * `StrictHostKeyChecking=no`. Shells out to `ssh-keyscan`/`ssh-keygen`/`ssh`
 * (openssh-client, already installed for the restic sftp backend).
 */
export function makeProductionSshProbe(opts: ProductionSshProbeOptions = {}): SshProbe {
  const spawnImpl = opts.spawnImpl ?? (nodeSpawn as unknown as SpawnImpl);
  const baseDir = opts.baseDir ?? os.tmpdir();
  const scanTimeoutSec = opts.scanTimeoutSec ?? 5;
  const connectTimeoutSec = opts.connectTimeoutSec ?? 10;

  return {
    async connect({ host, user, port, privateKey }) {
      const dir = await fs.mkdtemp(path.join(baseDir, 'dockstash-probe-'));
      try {
        const keyPath = path.join(dir, 'id_key');
        const knownHostsPath = path.join(dir, 'known_hosts');
        await fs.writeFile(keyPath, privateKey, { mode: 0o600 });

        const scan = await run(spawnImpl, 'ssh-keyscan', [
          '-p',
          String(port),
          '-T',
          String(scanTimeoutSec),
          host,
        ]);
        const hostKeyLine = scan.stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) => line.length > 0 && !line.startsWith('#'));
        if (!hostKeyLine) {
          throw new Error(`ssh-keyscan found no host key for ${host}:${port}`);
        }
        await fs.writeFile(knownHostsPath, `${hostKeyLine}\n`, { mode: 0o600 });

        const keygen = await run(spawnImpl, 'ssh-keygen', ['-E', 'sha256', '-lf', knownHostsPath]);
        const match = FINGERPRINT_LINE.exec(keygen.stdout);
        if (keygen.code !== 0 || !match) {
          throw new Error(`ssh-keygen could not derive a fingerprint: ${keygen.stderr.trim()}`);
        }
        const fingerprint = `sha256:${match[1]}`;

        const authCheck = await run(spawnImpl, 'ssh', [
          '-i',
          keyPath,
          '-o',
          'StrictHostKeyChecking=yes',
          '-o',
          `UserKnownHostsFile=${knownHostsPath}`,
          '-o',
          'BatchMode=yes',
          '-o',
          `ConnectTimeout=${connectTimeoutSec}`,
          '-p',
          String(port),
          `${user}@${host}`,
          'exit',
        ]);
        if (authCheck.code !== 0) {
          throw new Error(`ssh auth check failed: ${authCheck.stderr.trim()}`);
        }

        return { fingerprint, hostKeyLine };
      } finally {
        await fs.rm(dir, { recursive: true, force: true });
      }
    },
  };
}
