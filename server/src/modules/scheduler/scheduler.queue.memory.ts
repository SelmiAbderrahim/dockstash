import type { Job, JobData, SchedulerQueue } from './scheduler.boundaries.js';

export type MemoryQueueProcessor = (job: Job) => Promise<void>;

/**
 * In-memory queue with strict per-project serialization. Different projects
 * run in parallel; a given project runs one job at a time.
 *
 * The BullMQ backend (see `scheduler.queue.bullmq.ts`) provides the same
 * semantics in production via per-project queues + a `Worker` with
 * concurrency 1. Tests exercise this in-memory backend directly.
 */
export class MemoryQueue implements SchedulerQueue {
  private processor: MemoryQueueProcessor | null = null;
  private nextId = 0;
  private readonly perRepoTail = new Map<string, Promise<void>>();
  private readonly activeCounts = new Map<string, number>();
  private readonly allPromises = new Set<Promise<void>>();
  private closed = false;

  setProcessor(fn: MemoryQueueProcessor): void {
    this.processor = fn;
  }

  async add(data: JobData): Promise<Job> {
    if (this.closed) throw new Error('MemoryQueue: closed');
    if (!this.processor) throw new Error('MemoryQueue: processor not set');
    const id = String(++this.nextId);
    const job: Job = { id, data, attempts: 0 };
    const processor = this.processor;

    const prev = this.perRepoTail.get(data.projectId) ?? Promise.resolve();
    const chained = prev.then(async () => {
      this.activeCounts.set(
        data.projectId,
        (this.activeCounts.get(data.projectId) ?? 0) + 1,
      );
      try {
        await processor(job);
      } finally {
        /* c8 ignore next -- the count is always set just above; `?? 1` is defensive */
        const now = this.activeCounts.get(data.projectId) ?? 1;
        this.activeCounts.set(data.projectId, Math.max(0, now - 1));
      }
    });
    const swallowed = chained.catch(() => {
      // per-repo chain must not break on job failure — errors are surfaced
      // through the processor's own event/log path.
    });
    this.perRepoTail.set(data.projectId, swallowed);
    this.allPromises.add(swallowed);
    swallowed.finally(() => this.allPromises.delete(swallowed));
    return job;
  }

  async activeCountForProject(projectId: string): Promise<number> {
    return this.activeCounts.get(projectId) ?? 0;
  }

  async waitIdle(): Promise<void> {
    while (this.allPromises.size > 0) {
      await Promise.all(Array.from(this.allPromises));
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await this.waitIdle();
  }
}
