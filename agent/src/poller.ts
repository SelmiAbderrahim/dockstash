import type { AgentApiClient } from './api-client.js';
import type { AgentDiscoverySnapshot } from './discovery.js';
import type { ClaimedJob, JobResult } from './types.js';

export interface PollerLogger {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

/**
 * Batches job log lines toward the server: flushes every `flushMs` or when
 * `maxLines` accumulate, whichever comes first. Post failures are swallowed —
 * logs are best-effort; the result post is what matters.
 */
export class LogBatcher {
  private buffer: string[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly api: Pick<AgentApiClient, 'postLogs'>,
    private readonly jobId: string,
    private readonly opts: { flushMs?: number; maxLines?: number } = {},
  ) {}

  start(): void {
    this.timer = setInterval(() => {
      void this.flush();
    }, this.opts.flushMs ?? 2000);
  }

  push(line: string): void {
    this.buffer.push(line);
    if (this.buffer.length >= (this.opts.maxLines ?? 50)) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const lines = this.buffer.splice(0, this.buffer.length);
    try {
      await this.api.postLogs(this.jobId, lines);
    } catch {
      // best-effort — dropped log lines never fail the job
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    await this.flush();
  }
}

export interface PollerOptions {
  api: AgentApiClient;
  log: PollerLogger;
  version: string;
  hostname: string;
  pollIntervalMs: number;
  heartbeatIntervalMs: number;
  /** Executes one claimed job to a final result. */
  execute(job: ClaimedJob, pushLog: (line: string) => void): Promise<JobResult>;
  /** ±20% timer jitter source, injectable for tests. */
  jitter?(): number;
  /**
   * Builds this host's discovery snapshot (folders + running containers). When
   * provided, the poller attaches a throttled snapshot to each heartbeat.
   */
  collectDiscovery?(): Promise<AgentDiscoverySnapshot>;
  /** Minimum gap between snapshot recomputes; between gaps the cache is reused. */
  discoveryIntervalMs?: number;
  /** Monotonic clock (ms), injectable for tests. */
  now?(): number;
}

/**
 * The daemon's main loop: a heartbeat timer and a claim-when-idle timer.
 * Strictly ONE job at a time. Network/auth failures log and back off to the
 * next tick — the poller never crashes the process.
 */
export class Poller {
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private currentJobId: string | null = null;
  private lastHeartbeatAt: Date | null = null;
  private cachedSnapshot: AgentDiscoverySnapshot | null = null;
  private lastDiscoveryAt = 0;
  private warnedOutdated = false;

  constructor(private readonly opts: PollerOptions) {}

  private snapshotIsDegraded(snapshot: AgentDiscoverySnapshot): boolean {
    return !snapshot.dockerAvailable || snapshot.errors.length > 0;
  }

  /**
   * Return a snapshot for the heartbeat, recomputing at most once per
   * `discoveryIntervalMs` and reusing the cache in between. Never throws — a
   * collect failure keeps the last good snapshot (or none). `force` bypasses
   * the throttle window — used right after the server signals `refreshDiscovery`.
   */
  private async snapshotForHeartbeat(force = false): Promise<AgentDiscoverySnapshot | undefined> {
    if (!this.opts.collectDiscovery) return undefined;
    const now = (this.opts.now ?? (() => Date.now()))();
    const intervalMs = this.opts.discoveryIntervalMs ?? 120_000;
    const cachedSnapshotIsDegraded =
      this.cachedSnapshot !== null && this.snapshotIsDegraded(this.cachedSnapshot);
    if (
      force ||
      this.cachedSnapshot === null ||
      cachedSnapshotIsDegraded ||
      now - this.lastDiscoveryAt >= intervalMs
    ) {
      try {
        this.cachedSnapshot = await this.opts.collectDiscovery();
        this.lastDiscoveryAt = now;
        this.opts.log.info(
          {
            folders: this.cachedSnapshot.folders.length,
            containers: this.cachedSnapshot.containers.length,
            dockerAvailable: this.cachedSnapshot.dockerAvailable,
          },
          'discovery snapshot collected',
        );
      } catch (err) {
        this.opts.log.warn({ err }, 'discovery collect failed');
      }
    }
    return this.cachedSnapshot ?? undefined;
  }

  /** ±20% of the base interval, so a fleet never thunders in lockstep. */
  private jittered(base: number): number {
    const jitter = this.opts.jitter ?? (() => Math.random() * 0.4 - 0.2);
    return Math.max(250, Math.round(base * (1 + jitter())));
  }

  status(): { runningJobId: string | null; lastHeartbeatAt: Date | null } {
    return { runningJobId: this.currentJobId, lastHeartbeatAt: this.lastHeartbeatAt };
  }

  async heartbeatOnce(force = false): Promise<void> {
    try {
      const discovery = await this.snapshotForHeartbeat(force);
      const response = await this.opts.api.heartbeat({
        version: this.opts.version,
        hostname: this.opts.hostname,
        ...(discovery ? { discovery } : {}),
      });
      this.lastHeartbeatAt = new Date();
      // Warn ONCE per process when the server expects a newer daemon — the
      // operator sees it in `docker logs` next to the install runbook.
      if (
        !this.warnedOutdated &&
        response?.latestVersion &&
        response.latestVersion !== this.opts.version
      ) {
        this.warnedOutdated = true;
        this.opts.log.warn(
          { running: this.opts.version, latest: response.latestVersion },
          'agent is outdated — rerun: docker compose -f docker-compose.agent.yml pull && docker compose -f docker-compose.agent.yml up -d --force-recreate',
        );
      }
      // The server consumes the refresh request atomically (once), so this
      // can only fire once per operator request — safe to recurse.
      if (response?.refreshDiscovery && !force) {
        await this.heartbeatOnce(true);
      }
    } catch (err) {
      // 401 may just mean a rotated key being re-provisioned — keep retrying.
      this.opts.log.warn({ err }, 'heartbeat failed');
    }
  }

  async pollOnce(): Promise<void> {
    if (this.currentJobId) return; // strictly one job at a time
    let job: ClaimedJob | null;
    try {
      job = await this.opts.api.claimJob();
    } catch (err) {
      this.opts.log.warn({ err }, 'job claim failed');
      return;
    }
    if (!job) return;
    this.currentJobId = job.id;
    const batcher = new LogBatcher(this.opts.api, job.id);
    batcher.start();
    try {
      const result = await this.opts.execute(job, (line) => batcher.push(line));
      await batcher.stop();
      await this.opts.api.postResult(job.id, result);
      this.opts.log.info({ jobId: job.id, ok: result.ok }, 'job finished');
    } catch (err) {
      await batcher.stop();
      // Executor never throws (it returns ok:false); this guards the result
      // post itself. The server's lease expiry will fail the job loudly.
      this.opts.log.error({ err, jobId: job.id }, 'job result post failed');
    } finally {
      this.currentJobId = null;
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.heartbeatOnce();
    this.heartbeatTimer = setInterval(() => {
      void this.heartbeatOnce();
    }, this.jittered(this.opts.heartbeatIntervalMs));
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, this.jittered(this.opts.pollIntervalMs));
  }

  /** Stop timers; resolves once any in-flight job has drained. */
  async stop(pollMs = 250): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.heartbeatTimer = null;
    this.pollTimer = null;
    this.running = false;
    while (this.currentJobId) {
      await new Promise((resolve) => {
        setTimeout(resolve, pollMs);
      });
    }
  }
}
