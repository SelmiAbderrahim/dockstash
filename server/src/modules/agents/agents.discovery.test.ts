import { describe, expect, it } from 'vitest';
import { buildAgentDiscoveryView, type StoredSnapshot } from './agents.discovery.js';
import type { DockerContainerSummary } from '../backups/backups.boundaries.js';

function container(over: Partial<DockerContainerSummary>): DockerContainerSummary {
  return { id: 'id', names: [], image: '', state: 'running', labels: {}, ...over };
}

const composeLabels = (project: string, workingDir: string, service?: string) => ({
  'com.docker.compose.project': project,
  'com.docker.compose.project.working_dir': workingDir,
  ...(service ? { 'com.docker.compose.service': service } : {}),
});

describe('buildAgentDiscoveryView', () => {
  it('returns an empty, not-reported view for a null snapshot', () => {
    expect(buildAgentDiscoveryView(null)).toEqual({
      folders: [],
      containers: [],
      dockerAvailable: false,
      roots: ['/var/www'],
      snapshotAt: null,
      reported: false,
      errors: [],
    });
  });

  it('gives folders a files-only plan, stamps snapshotAt, and marks reported', () => {
    const snap: StoredSnapshot = {
      folders: [{ name: 'app', path: '/var/www/app', hasCompose: false, composeFile: null }],
      containers: [],
      dockerAvailable: true,
      snapshotAt: new Date('2026-07-03T00:00:00.000Z'),
    };
    const view = buildAgentDiscoveryView(snap);
    expect(view.folders[0]).toEqual({
      name: 'app',
      path: '/var/www/app',
      hasCompose: false,
      composeFile: null,
      plan: { paths: ['/var/www/app'], databases: [], configs: [] },
    });
    expect(view.snapshotAt).toBe('2026-07-03T00:00:00.000Z');
    expect(view.dockerAvailable).toBe(true);
    expect(view.reported).toBe(true);
    expect(view.errors).toEqual([]);
  });

  it('passes discoveryErrors through as the view errors array, reported even when empty', () => {
    const snap: StoredSnapshot = {
      folders: [],
      containers: [],
      dockerAvailable: false,
      snapshotAt: new Date('2026-07-03T00:00:00.000Z'),
      discoveryErrors: [
        '/var/www is not readable from the agent container — check that it is mounted.',
      ],
    };
    const view = buildAgentDiscoveryView(snap);
    expect(view.reported).toBe(true);
    expect(view.errors).toEqual([
      '/var/www is not readable from the agent container — check that it is mounted.',
    ]);
  });

  it('derives a plan from live containers for addable Compose projects', () => {
    const snap: StoredSnapshot = {
      folders: [],
      dockerAvailable: true,
      snapshotAt: null,
      containers: [
        container({
          names: ['/shop_db_1'],
          image: 'postgres:16',
          labels: composeLabels('shop', '/var/www/shop', 'db'),
        }),
        container({
          names: ['/shop_proxy_1'],
          image: 'traefik:v3',
          labels: composeLabels('shop', '/var/www/shop', 'proxy'),
        }),
        // No service label → the image stands in as the service name.
        container({
          names: ['/shop_extra'],
          image: 'mysql:8',
          labels: composeLabels('shop', '/var/www/shop'),
        }),
        // Empty names → container name falls back to the id.
        container({
          id: 'shop_id_only',
          names: [],
          image: 'mongo:7',
          labels: composeLabels('shop', '/var/www/shop', 'mo'),
        }),
        // Outside /var/www → not addable → no plan.
        container({
          names: ['/infra_1'],
          image: 'redis:7',
          labels: composeLabels('infra', '/opt/infra', 'cache'),
        }),
        // No project label → standalone → no plan.
        container({ names: ['/lonely'], image: 'nginx', labels: {} }),
      ],
    };

    const view = buildAgentDiscoveryView(snap);
    const shop = view.containers.find((c) => c.project === 'shop')!;
    expect(shop.addable).toBe(true);
    expect(shop.plan).toEqual({
      paths: ['/var/www/shop'],
      databases: [
        { service: 'db', type: 'postgres', container: 'shop_db_1', enabled: true },
        { service: 'mysql:8', type: 'mysql', container: 'shop_extra', enabled: true },
        { service: 'mo', type: 'mongo', container: 'shop_id_only', enabled: true },
      ],
      // /etc/traefik is detected but dropped: it is outside the agent's
      // mounted roots, so the agent could never read it.
      configs: [],
    });

    const infra = view.containers.find((c) => c.project === 'infra')!;
    expect(infra.addable).toBe(false);
    expect(infra.plan).toBeNull();

    const lonely = view.containers.find((c) => c.project === 'lonely')!;
    expect(lonely.standalone).toBe(true);
    expect(lonely.plan).toBeNull();
  });

  it('drops derived nginx/traefik config dirs that sit outside the agent roots', () => {
    const snap: StoredSnapshot = {
      folders: [],
      dockerAvailable: true,
      snapshotAt: null,
      containers: [
        container({
          names: ['/web_edge_1'],
          image: 'nginx:1.27',
          labels: composeLabels('web', '/var/www/web', 'edge'),
        }),
      ],
    };
    const web = buildAgentDiscoveryView(snap).containers[0]!;
    expect(web.plan?.configs).toEqual([]);
    expect(web.plan?.databases).toEqual([]);
  });

  it('marks groups addable against the agent-reported roots, not the static default', () => {
    const snap: StoredSnapshot = {
      folders: [],
      dockerAvailable: true,
      snapshotAt: null,
      roots: ['/opt'],
      containers: [
        container({
          names: ['/infra_1'],
          image: 'redis:7',
          labels: composeLabels('infra', '/opt/infra', 'cache'),
        }),
        container({
          names: ['/legacy_1'],
          image: 'postgres:16',
          labels: composeLabels('legacy', '/var/www/legacy', 'db'),
        }),
      ],
    };
    const view = buildAgentDiscoveryView(snap);
    expect(view.roots).toEqual(['/opt']);
    const infra = view.containers.find((c) => c.project === 'infra')!;
    expect(infra.addable).toBe(true);
    expect(infra.plan?.paths).toEqual(['/opt/infra']);
    const legacy = view.containers.find((c) => c.project === 'legacy')!;
    expect(legacy.addable).toBe(false);
    expect(legacy.plan).toBeNull();
  });

  it('falls back to the /var/www default for legacy snapshots without roots', () => {
    const snap: StoredSnapshot = {
      folders: [],
      dockerAvailable: true,
      snapshotAt: null,
      roots: [],
      containers: [
        container({
          names: ['/shop_db_1'],
          image: 'postgres:16',
          labels: composeLabels('shop', '/var/www/shop', 'db'),
        }),
      ],
    };
    const view = buildAgentDiscoveryView(snap);
    expect(view.roots).toEqual(['/var/www']);
    expect(view.containers[0]!.addable).toBe(true);
  });
});
