import * as os from 'node:os';
import type { Server } from 'node:http';
import { loadConfig, type AgentConfig } from './config.js';
import { makeLogger } from './logging.js';
import { AgentApiClient } from './api-client.js';
import { HttpDockerClient } from './docker-client.js';
import { collectDiscovery, type AgentDiscoverySnapshot } from './discovery.js';
import { ProcessResticRunner } from './restic-runner.js';
import { executeJob } from './executor.js';
import { Poller, type PollerLogger } from './poller.js';
import { startHealthServer } from './health.js';
import type { ClaimedJob, JobResult } from './types.js';

export const AGENT_VERSION = '0.1.0';

export interface RunAgentDeps {
  env?: NodeJS.ProcessEnv;
  logger?: PollerLogger;
  hostname?: string;
  /** Injectable executor for tests; production builds runners per job. */
  execute?(job: ClaimedJob, pushLog: (line: string) => void, config: AgentConfig): Promise<JobResult>;
  startHealth?: typeof startHealthServer;
  /** Injectable discovery collector for tests; production reads the real host. */
  collectDiscovery?(): Promise<AgentDiscoverySnapshot>;
}

/** Production per-job executor: fresh restic runner bound to the claim payload. */
export async function productionExecute(
  job: ClaimedJob,
  pushLog: (line: string) => void,
  config: AgentConfig,
): Promise<JobResult> {
  const restic = new ProcessResticRunner({
    repoUrl: job.repo.url,
    password: job.repo.password,
    ssh: { privateKey: job.ssh.privateKey, hostKeyLine: job.ssh.hostKeyLine },
    binary: config.RESTIC_BINARY,
    cacheDir: config.RESTIC_CACHE_DIR,
  });
  const docker = new HttpDockerClient({ dockerHost: config.DOCKER_HOST });
  return executeJob(job, { restic, docker, log: pushLog });
}

export interface RunningAgent {
  poller: Poller;
  health: Server;
  shutdown(): Promise<void>;
}

/** Boot the daemon: config → health server → poller. SIGTERM drains the job. */
export async function runAgent(deps: RunAgentDeps = {}): Promise<RunningAgent> {
  const config = loadConfig(deps.env ?? process.env);
  const log = deps.logger ?? makeLogger();
  const api = new AgentApiClient({
    baseUrl: config.DOCKSTASH_URL,
    token: config.DOCKSTASH_AGENT_TOKEN,
  });
  const execute = deps.execute ?? productionExecute;

  // A read-only Docker client for discovery, reused across heartbeats (job
  // execution builds its own per-job client in productionExecute).
  let collect = deps.collectDiscovery;
  if (!collect) {
    const discoveryDocker = new HttpDockerClient({ dockerHost: config.DOCKER_HOST });
    collect = () => collectDiscovery({ dockerClient: discoveryDocker, log });
  }

  const poller = new Poller({
    api,
    log,
    version: AGENT_VERSION,
    hostname: deps.hostname ?? os.hostname(),
    pollIntervalMs: config.DOCKSTASH_POLL_INTERVAL_MS,
    heartbeatIntervalMs: config.DOCKSTASH_HEARTBEAT_INTERVAL_MS,
    execute: (job, pushLog) => execute(job, pushLog, config),
    collectDiscovery: collect,
  });

  const health = (deps.startHealth ?? startHealthServer)(config.HEALTH_PORT, () =>
    poller.status(),
  );

  poller.start();
  log.info(
    { url: config.DOCKSTASH_URL, healthPort: config.HEALTH_PORT },
    'dockstash-agent started',
  );

  return {
    poller,
    health,
    async shutdown() {
      log.info({}, 'dockstash-agent draining');
      await poller.stop();
      await new Promise<void>((resolve) => {
        health.close(() => resolve());
      });
    },
  };
}
