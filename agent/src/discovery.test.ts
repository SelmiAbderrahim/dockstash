import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import {
  collectDiscovery,
  defaultComposeProbe,
  defaultFolderReader,
  type FolderEntry,
} from './discovery.js';
import type { DockerContainerSummary } from './docker-client.js';

function entry(over: Partial<FolderEntry> & { name: string }): FolderEntry {
  return {
    path: path.posix.join('/var/www/', over.name),
    isDirectory: true,
    isSymbolicLink: false,
    ...over,
  };
}

const noDocker = { listContainers: async (): Promise<DockerContainerSummary[]> => [] };

describe('collectDiscovery — folders', () => {
  it('keeps allowlisted dirs, flags compose, skips files/symlinks, sorts', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => [
      entry({ name: 'zeta' }),
      entry({ name: 'alpha' }),
      entry({ name: 'file.txt', isDirectory: false }),
      entry({ name: 'linked', isSymbolicLink: true }),
      { name: '..', path: '/var/www/..', isDirectory: true, isSymbolicLink: false },
    ];
    const composeProbe = async (dir: string): Promise<string | null> =>
      dir === '/var/www/alpha' ? 'docker-compose.yml' : null;

    const snap = await collectDiscovery({ folderReader, composeProbe, dockerClient: noDocker });
    expect(snap.folders.map((f) => f.name)).toEqual(['alpha', 'zeta']);
    expect(snap.folders[0]).toEqual({
      name: 'alpha',
      path: '/var/www/alpha',
      hasCompose: true,
      composeFile: 'docker-compose.yml',
    });
    expect(snap.folders[1]).toMatchObject({ hasCompose: false, composeFile: null });
  });

  it('returns an empty folder list and records a reason when the reader throws', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => {
      throw new Error('ENOENT');
    };
    const snap = await collectDiscovery({
      folderReader,
      composeProbe: async () => null,
      dockerClient: noDocker,
    });
    expect(snap.folders).toEqual([]);
    expect(snap.errors).toEqual([
      expect.stringContaining('is not readable from the agent container'),
    ]);
  });

  it('caps the folder list', async () => {
    const folderReader = async (): Promise<FolderEntry[]> =>
      Array.from({ length: 250 }, (_, i) => entry({ name: `p${String(i).padStart(3, '0')}` }));
    const snap = await collectDiscovery({
      folderReader,
      composeProbe: async () => null,
      dockerClient: noDocker,
    });
    expect(snap.folders).toHaveLength(200);
  });
});

describe('collectDiscovery — containers', () => {
  it('ships raw container summaries when docker is available, with no errors', async () => {
    const containers: DockerContainerSummary[] = [
      { id: 'a', names: ['/x'], image: 'redis:7', state: 'running', labels: {} },
    ];
    const snap = await collectDiscovery({
      folderReader: async () => [],
      composeProbe: async () => null,
      dockerClient: { listContainers: async () => containers },
    });
    expect(snap.dockerAvailable).toBe(true);
    expect(snap.containers).toEqual(containers);
    expect(snap.errors).toEqual([]);
  });

  it('degrades to dockerAvailable:false, logs, and records a reason when listContainers throws', async () => {
    const warn = vi.fn();
    const snap = await collectDiscovery({
      folderReader: async () => [],
      composeProbe: async () => null,
      log: { warn },
      dockerClient: {
        listContainers: async () => {
          throw new Error('docker down (403)');
        },
      },
    });
    expect(snap).toMatchObject({ dockerAvailable: false, containers: [] });
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.stringContaining('403') }),
      expect.stringContaining('Docker unreachable'),
    );
    expect(snap.errors).toEqual([
      expect.stringContaining('Docker socket is unreachable'),
    ]);
  });

  it('collects both a folder error and a docker error in the same snapshot', async () => {
    const snap = await collectDiscovery({
      folderReader: async () => {
        throw new Error('EACCES');
      },
      composeProbe: async () => null,
      dockerClient: {
        listContainers: async () => {
          throw new Error('ECONNREFUSED');
        },
      },
    });
    expect(snap.errors).toHaveLength(2);
  });

  it('caps the container list', async () => {
    const many: DockerContainerSummary[] = Array.from({ length: 600 }, (_, i) => ({
      id: `c${i}`,
      names: [],
      image: '',
      state: 'running',
      labels: {},
    }));
    const snap = await collectDiscovery({
      folderReader: async () => [],
      composeProbe: async () => null,
      dockerClient: { listContainers: async () => many },
    });
    expect(snap.containers).toHaveLength(500);
  });
});

describe('default reader + compose probe (real fs)', () => {
  it('reads dir/file flags and probes compose variants', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agent-discover-'));
    await mkdir(path.join(root, 'child'));
    await writeFile(path.join(root, 'file.txt'), 'x');
    await mkdir(path.join(root, 'composed'));
    await writeFile(path.join(root, 'composed', 'compose.yaml'), 'services: {}');
    await symlink(path.join(root, 'child'), path.join(root, 'link'));

    const entries = await defaultFolderReader(root);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    expect(byName['child']?.isDirectory).toBe(true);
    expect(byName['file.txt']?.isDirectory).toBe(false);
    expect(byName['link']?.isSymbolicLink).toBe(true);

    await expect(defaultComposeProbe(path.join(root, 'composed'))).resolves.toBe('compose.yaml');
    await expect(defaultComposeProbe(path.join(root, 'child'))).resolves.toBeNull();
  });
});
