import type { AgentApiClient } from './api-client.js';
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

  constructor(private readonly opts: PollerOptions) {}

  /** ±20% of the base interval, so a fleet never thunders in lockstep. */
  private jittered(base: number): number {
    const jitter = this.opts.jitter ?? (() => Math.random() * 0.4 - 0.2);
    return Math.max(250, Math.round(base * (1 + jitter())));
  }

  status(): { runningJobId: string | null; lastHeartbeatAt: Date | null } {
    return { runningJobId: this.currentJobId, lastHeartbeatAt: this.lastHeartbeatAt };
  }

  async heartbeatOnce(): Promise<void> {
    try {
      await this.opts.api.heartbeat({
        version: this.opts.version,
        hostname: this.opts.hostname,
      });
      this.lastHeartbeatAt = new Date();
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
