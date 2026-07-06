import os from 'node:os';
import path from 'node:path';
import { mkdtemp, mkdir, writeFile, symlink } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import {
  defaultComposeProbe,
  defaultFolderReader,
  discoverContainers,
  discoverFolders,
  groupByComposeProject,
  makeDiscoveryDockerClient,
  type FolderEntry,
} from './backups.discover.js';
import type { DockerClient, DockerContainerSummary } from './backups.boundaries.js';

function entry(over: Partial<FolderEntry> & { name: string }): FolderEntry {
  return {
    path: path.posix.join('/var/www/', over.name),
    isDirectory: true,
    isSymbolicLink: false,
    ...over,
  };
}

describe('discoverFolders', () => {
  it('keeps allowlisted subdirectories, flags compose, and sorts by name', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => [
      entry({ name: 'zeta' }),
      entry({ name: 'alpha' }),
      entry({ name: 'readme.txt', isDirectory: false }),
      entry({ name: 'linked', isDirectory: true, isSymbolicLink: true }),
    ];
    const composeProbe = async (dirPath: string): Promise<string | null> =>
      dirPath === '/var/www/alpha' ? 'docker-compose.yml' : null;

    const folders = await discoverFolders({ folderReader, composeProbe });
    expect(folders.map((f) => f.name)).toEqual(['alpha', 'zeta']);
    expect(folders[0]).toEqual({
      name: 'alpha',
      path: '/var/www/alpha',
      hasCompose: true,
      composeFile: 'docker-compose.yml',
    });
    expect(folders[1]).toMatchObject({ hasCompose: false, composeFile: null });
  });

  it('drops entries whose resolved path escapes the allowlist', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => [
      { name: '..', path: '/var/www/..', isDirectory: true, isSymbolicLink: false },
    ];
    const folders = await discoverFolders({
      folderReader,
      composeProbe: async () => null,
    });
    expect(folders).toEqual([]);
  });

  it('maps a reader failure to a localized 400', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => {
      throw new Error('EACCES');
    };
    await expect(
      discoverFolders({ folderReader, t: (k) => k }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('surfaces a non-Error rejection reason', async () => {
    const folderReader = async (): Promise<FolderEntry[]> => {
      throw 'weird';
    };
    await expect(discoverFolders({ folderReader })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('default folder reader + compose probe (real fs)', () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'discover-'));
    await mkdir(path.join(root, 'child'));
    await writeFile(path.join(root, 'file.txt'), 'x');
    await mkdir(path.join(root, 'composed'));
    await writeFile(path.join(root, 'composed', 'compose.yaml'), 'services: {}');
  });

  it('defaultFolderReader reports directory/file/symlink flags', async () => {
    const entries = await defaultFolderReader(root);
    const byName = Object.fromEntries(entries.map((e) => [e.name, e]));
    expect(byName['child']?.isDirectory).toBe(true);
    expect(byName['file.txt']?.isDirectory).toBe(false);
  });

  it('defaultComposeProbe finds a compose variant or returns null', async () => {
    await expect(defaultComposeProbe(path.join(root, 'composed'))).resolves.toBe(
      'compose.yaml',
    );
    await expect(defaultComposeProbe(path.join(root, 'child'))).resolves.toBeNull();
  });

  it('defaultFolderReader flags symlinks', async () => {
    const linkRoot = await mkdtemp(path.join(os.tmpdir(), 'discover-link-'));
    await mkdir(path.join(linkRoot, 'real'));
    await symlink(path.join(linkRoot, 'real'), path.join(linkRoot, 'link'));
    const entries = await defaultFolderReader(linkRoot);
    const link = entries.find((e) => e.name === 'link');
    expect(link?.isSymbolicLink).toBe(true);
  });
});

function container(over: Partial<DockerContainerSummary>): DockerContainerSummary {
  return { id: 'id', names: [], image: '', state: 'running', labels: {}, ...over };
}

describe('groupByComposeProject', () => {
  it('groups compose containers and marks /var/www working dirs addable', () => {
    const groups = groupByComposeProject([
      container({
        id: 'a1',
        names: ['/shop_db_1'],
        labels: {
          'com.docker.compose.project': 'shop',
          'com.docker.compose.project.working_dir': '/var/www/shop',
          'com.docker.compose.config_files': '/var/www/shop/compose.yml',
          'com.docker.compose.service': 'db',
        },
      }),
      container({
        id: 'a2',
        names: ['/shop_web_1'],
        labels: {
          'com.docker.compose.project': 'shop',
          'com.docker.compose.project.working_dir': '/var/www/shop',
          'com.docker.compose.service': 'web',
        },
      }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      project: 'shop',
      workingDir: '/var/www/shop',
      services: ['db', 'web'],
      containerNames: ['shop_db_1', 'shop_web_1'],
      configFiles: ['/var/www/shop/compose.yml'],
      addable: true,
      standalone: false,
    });
  });

  it('marks a compose project outside /var/www as not addable', () => {
    const [group] = groupByComposeProject([
      container({
        labels: {
          'com.docker.compose.project': 'infra',
          'com.docker.compose.project.working_dir': '/opt/infra',
        },
      }),
    ]);
    expect(group).toMatchObject({ addable: false, workingDir: '/opt/infra', services: [] });
  });

  it('handles a compose project with no working_dir label', () => {
    const [group] = groupByComposeProject([
      container({ labels: { 'com.docker.compose.project': 'orphan' } }),
    ]);
    expect(group).toMatchObject({ workingDir: null, addable: false });
  });

  it('surfaces standalone containers by name, falling back to id', () => {
    const groups = groupByComposeProject([
      container({ id: 'lonely', names: [] }),
      container({ id: 'x', names: ['/named-one'] }),
    ]);
    expect(groups.map((g) => g.project)).toEqual(['lonely', 'named-one']);
    expect(groups.every((g) => g.standalone && !g.addable)).toBe(true);
  });

  it('ignores blank config-file segments', () => {
    const [group] = groupByComposeProject([
      container({
        labels: {
          'com.docker.compose.project': 'p',
          'com.docker.compose.config_files': '/var/www/p/a.yml,, ,/var/www/p/b.yml',
        },
      }),
    ]);
    expect(group?.configFiles).toEqual(['/var/www/p/a.yml', '/var/www/p/b.yml']);
  });
});

describe('discoverContainers', () => {
  function fakeDocker(list: DockerContainerSummary[] | Error): DockerClient {
    return {
      exec: async () => {
        throw new Error('unused');
      },
      execCollect: async () => {
        throw new Error('unused');
      },
      execWithStdin: async () => {
        throw new Error('unused');
      },
      restart: async () => {
        throw new Error('unused');
      },
      inspect: async () => ({ id: '', running: false, env: [], image: '' }),
      listContainers: async () => {
        if (list instanceof Error) throw list;
        return list;
      },
    };
  }

  it('returns dockerAvailable:false when no client is configured', async () => {
    await expect(discoverContainers({ dockerClient: null })).resolves.toEqual({
      containers: [],
      dockerAvailable: false,
    });
  });

  it('lists grouped containers when a client is present', async () => {
    const res = await discoverContainers({
      dockerClient: fakeDocker([
        container({
          labels: {
            'com.docker.compose.project': 'blog',
            'com.docker.compose.project.working_dir': '/var/www/blog',
          },
        }),
      ]),
    });
    expect(res.dockerAvailable).toBe(true);
    expect(res.containers[0]?.project).toBe('blog');
  });

  it('maps a listContainers failure to a localized 400', async () => {
    await expect(
      discoverContainers({ dockerClient: fakeDocker(new Error('boom')), t: (k) => k }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('surfaces a non-Error listContainers rejection', async () => {
    const docker: DockerClient = {
      exec: async () => {
        throw new Error('unused');
      },
      execCollect: async () => {
        throw new Error('unused');
      },
      execWithStdin: async () => {
        throw new Error('unused');
      },
      restart: async () => {
        throw new Error('unused');
      },
      inspect: async () => ({ id: '', running: false, env: [], image: '' }),
      listContainers: async () => {
        throw 'nope';
      },
    };
    await expect(discoverContainers({ dockerClient: docker })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('makeDiscoveryDockerClient', () => {
  const original = env.DOCKER_HOST;
  afterEach(() => {
    env.DOCKER_HOST = original;
  });

  it('returns null when DOCKER_HOST is unset', () => {
    env.DOCKER_HOST = undefined;
    expect(makeDiscoveryDockerClient()).toBeNull();
  });

  it('returns a client when DOCKER_HOST is set', () => {
    env.DOCKER_HOST = 'tcp://docker-socket-proxy:2375';
    expect(makeDiscoveryDockerClient()).not.toBeNull();
  });
});

describe('discovery routes', () => {
  const app = createApp();
  const original = env.DOCKER_HOST;

  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());
  afterEach(() => {
    env.DOCKER_HOST = original;
  });

  async function seedUser(): Promise<string> {
    const u = await User.create({
      email: 'discover@test.com',
      password: 'irrelevant-hashed',
      profile: { firstName: 'D', lastName: 'I' },
      emailVerified: true,
    });
    return jwt.sign({ _id: u._id.toString(), id: u._id.toString() }, env.JWT_SECRET, {
      expiresIn: '1h',
    });
  }

  it('rejects unauthenticated discovery requests', async () => {
    expect((await request(app).get('/api/backups/discover/folders')).status).toBe(401);
    expect((await request(app).get('/api/backups/discover/containers')).status).toBe(401);
  });

  it('GET /discover/folders returns a folders array', async () => {
    const token = await seedUser();
    const res = await request(app)
      .get('/api/backups/discover/folders')
      .set('Authorization', `JWT ${token}`);
    // /var/www may or may not exist in the test host; either a 200 list or a
    // 400 discover failure is acceptable — both prove the route is wired.
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) expect(Array.isArray(res.body.folders)).toBe(true);
  });

  it('GET /discover/containers reports docker unavailable when unconfigured', async () => {
    env.DOCKER_HOST = undefined;
    const token = await seedUser();
    const res = await request(app)
      .get('/api/backups/discover/containers')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ containers: [], dockerAvailable: false });
  });
});
