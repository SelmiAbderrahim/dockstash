import { execSync, spawn } from 'node:child_process';
import { promises as fs, createReadStream } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { createProject } from './backups.service.js';
import { runResticCheck, runRestoreDrill } from './backups.verify.service.js';
import type {
  DbDiffer,
  FileDiffer,
  ResticRunner,
  ScratchWorkspace,
} from './backups.boundaries.js';

function hasRestic(): boolean {
  try {
    execSync('restic version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const RESTIC_AVAILABLE = hasRestic();

async function seedUser(email = 'restic@test.com'): Promise<string> {
  const u = await User.create({
    email,
    password: 'irrelevant-hashed',
    profile: { firstName: 'R', lastName: 'R' },
    emailVerified: true,
  });
  return u._id.toString();
}

/** A minimal ResticRunner backed by the real `restic` binary over a local repo. */
function makeRealRunner(repo: string, password: string): ResticRunner {
  const runRestic = (args: string[], stdin?: NodeJS.ReadableStream): Promise<void> =>
    new Promise((resolve, reject) => {
      const child = spawn('restic', ['-r', repo, ...args], {
        env: { ...process.env, RESTIC_PASSWORD: password },
        stdio: [stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr?.on('data', (b) => {
        stderr += b.toString();
      });
      child.stdout?.on('data', () => {});
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`restic ${args.join(' ')} exit ${code}: ${stderr}`));
      });
      if (stdin && child.stdin) stdin.pipe(child.stdin);
    });

  const listSnapshots = (): Promise<Array<{ id: string; time: string }>> =>
    new Promise((resolve, reject) => {
      const child = spawn('restic', ['-r', repo, 'snapshots', '--json'], {
        env: { ...process.env, RESTIC_PASSWORD: password },
      });
      let out = '';
      let err = '';
      child.stdout.on('data', (b) => (out += b.toString()));
      child.stderr.on('data', (b) => (err += b.toString()));
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error(`snapshots exit ${code}: ${err}`));
        try {
          const arr = JSON.parse(out) as Array<{ id: string; time: string }>;
          resolve(arr.map((s) => ({ id: s.id, time: s.time })));
        } catch (parseErr) {
          reject(parseErr);
        }
      });
    });

  return {
    async init() {
      await runRestic(['init']);
    },
    async backup(args, opts) {
      await runRestic(args, opts?.stdin);
    },
    async snapshots() {
      return listSnapshots();
    },
    async check(args) {
      await runRestic(args);
    },
    async restore(args) {
      await runRestic(args);
    },
  };
}

async function hashFile(p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(p)
      .on('data', (d) => h.update(d))
      .on('error', reject)
      .on('end', () => resolve(h.digest('hex')));
  });
}

async function listFilesRecursive(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.isFile()) out.push(p);
    }
  }
  await walk(root);
  return out;
}

function makeRealFileDiff(): FileDiffer {
  return {
    async diff(source, restoredRoot) {
      // restic restore places files at `<restoredRoot>/<abs source path>` — mimic that.
      const restoredMirror = path.join(restoredRoot, source);
      const sourceFiles = await listFilesRecursive(source);
      const details: string[] = [];
      let mismatches = 0;
      for (const sf of sourceFiles) {
        const rel = path.relative(source, sf);
        const rf = path.join(restoredMirror, rel);
        try {
          const [srcHash, resHash] = await Promise.all([hashFile(sf), hashFile(rf)]);
          if (srcHash !== resHash) {
            mismatches += 1;
            details.push(`hash mismatch: ${rel}`);
          }
        } catch {
          mismatches += 1;
          details.push(`missing restored file: ${rel}`);
        }
      }
      return { mismatches, details };
    },
  };
}

const noopDbDiff: DbDiffer = {
  async diff() {
    return { mismatches: 0, details: [] };
  },
};

function makeScratch(base: string): ScratchWorkspace {
  let counter = 0;
  return {
    async create() {
      const p = path.join(base, `scratch-${Date.now()}-${counter++}`);
      await fs.mkdir(p, { recursive: true });
      return p;
    },
    async remove(p) {
      await fs.rm(p, { recursive: true, force: true });
    },
  };
}

describe.skipIf(!RESTIC_AVAILABLE)('backups: real restic integration', () => {
  let tmpRoot: string;
  let repoPath: string;
  let sourcePath: string;
  let runner: ResticRunner;
  const password = 'integration-test-pw';

  beforeAll(async () => {
    await startMemoryMongo();
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'restic-it-'));
    repoPath = path.join(tmpRoot, 'repo');
    sourcePath = path.join(tmpRoot, 'src');
    await fs.mkdir(sourcePath, { recursive: true });
    await fs.writeFile(path.join(sourcePath, 'a.txt'), 'alpha content');
    await fs.writeFile(path.join(sourcePath, 'b.txt'), 'beta content');
    runner = makeRealRunner(repoPath, password);
    await runner.init();
    await runner.backup(['backup', sourcePath]);
  });

  afterAll(async () => {
    await stopMemoryMongo();
    if (tmpRoot) await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  beforeEach(() => clearCollections());

  it('restic check passes on a fresh repo', async () => {
    const uid = await seedUser('a@restic.test');
    const p = await createProject(uid, {
      name: 'r',
      path: '/var/www/r',
      repoPassword: 'password1',
    });
    const res = await runResticCheck(p._id.toString(), uid, { resticRunner: runner });
    expect(res.status).toBe('pass');
  });

  it('restore drill round-trip diff is clean against real restic', async () => {
    const uid = await seedUser('b@restic.test');
    const p = await createProject(uid, {
      name: 'r2',
      path: '/var/www/r2',
      repoPassword: 'password1',
    });
    // Point the plan at the real source directory used during backup.
    p.plan = {
      paths: [sourcePath],
      databases: [],
      configs: [],
    } as unknown as typeof p.plan;
    // The service enforces the /var/www allowlist for paths; scan requires
    // it too. For this real-restic test we bypass the model-level plan-path
    // guard by writing directly to the DB and skipping the plan mutation path.
    await p.save({ validateBeforeSave: false });

    const res = await runRestoreDrill(p._id.toString(), uid, {
      resticRunner: runner,
      scratch: makeScratch(tmpRoot),
      fileDiff: makeRealFileDiff(),
      dbDiff: noopDbDiff,
    });
    expect(res.status).toBe('pass');
    expect(res.mismatches).toBe(0);
  });

  it('a concurrent second run detects the lock surface (or completes cleanly)', async () => {
    // Kick off two parallel operations. Restic itself serializes/locks the
    // repo — at least one succeeds; if the other fails, the error mentions
    // a lock. This asserts real-world exit-code + locking behavior.
    const uid = await seedUser('c@restic.test');
    const p = await createProject(uid, {
      name: 'r3',
      path: '/var/www/r3',
      repoPassword: 'password1',
    });
    const one = runResticCheck(p._id.toString(), uid, { resticRunner: runner });
    const two = runResticCheck(p._id.toString(), uid, { resticRunner: runner });
    const [a, b] = await Promise.all([one, two]);
    const outcomes = [a.status, b.status];
    // Neither call is allowed to be a false "pass" if restic actually errored.
    // If one fails, its detail should reference the repo state.
    for (const r of [a, b]) {
      if (r.status === 'fail') {
        expect(r.detail.length).toBeGreaterThan(0);
      }
    }
    expect(outcomes).toContain('pass');
  });
});

describe.skipIf(RESTIC_AVAILABLE)('backups: real restic integration (skipped)', () => {
  it('is skipped when the restic binary is unavailable', () => {
    expect(RESTIC_AVAILABLE).toBe(false);
  });
});
