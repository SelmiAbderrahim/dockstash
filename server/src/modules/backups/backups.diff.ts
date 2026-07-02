import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type {
  DbDiffer,
  DiskSpaceProbe,
  FileDiffer,
  ScratchWorkspace,
} from './backups.boundaries.js';

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
  async function walk(dir: string): Promise<void> {
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

/**
 * SHA-256 diff of a restored tree against its source root. restic restores to
 * `<restoredRoot>/<abs source path>` — the differ mirrors that layout.
 */
export function makeHashFileDiff(): FileDiffer {
  return {
    async diff(source, restoredRoot) {
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

/**
 * v1 DB differ: restore drills assert the dump artifact exists and is
 * non-empty. A structural row-diff against the live database lands with the
 * per-engine restore adapters.
 */
export function makeArtifactDbDiff(): DbDiffer {
  return {
    async diff({ restoredDumpPath, service }) {
      try {
        const stat = await fs.stat(restoredDumpPath);
        if (stat.size === 0) {
          return { mismatches: 1, details: [`empty restored dump for ${service}`] };
        }
        return { mismatches: 0, details: [] };
      } catch {
        return { mismatches: 1, details: [`missing restored dump for ${service}`] };
      }
    },
  };
}

/** Scratch workspaces under the (tmpfs) tmp dir; `remove` tolerates absence. */
export function makeTmpScratch(base: string = os.tmpdir()): ScratchWorkspace {
  return {
    async create() {
      return fs.mkdtemp(path.join(base, 'dockstash-drill-'));
    },
    async remove(p) {
      await fs.rm(p, { recursive: true, force: true });
    },
  };
}

/** Free-space probe over statfs of the scratch volume. */
export function makeStatfsDiskProbe(target: string = os.tmpdir()): DiskSpaceProbe {
  return {
    async freeBytes() {
      const s = await fs.statfs(target);
      return Number(s.bavail) * Number(s.bsize);
    },
  };
}
