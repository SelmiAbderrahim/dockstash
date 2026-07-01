import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import type { Job, JobData, SchedulerQueue } from './scheduler.boundaries.js';
import type { MemoryQueueProcessor } from './scheduler.queue.memory.js';

/**
 * BullMQ backend — one *queue+worker pair per project* so a repo runs
 * strictly one job at a time while different repos run in parallel. This is
 * the production strategy on top of Redis.
 *
 * We keep the surface minimal: `SchedulerQueue.add()` lazily creates the
 * per-project queue+worker on first use, `close()` tears everything down.
 */
export class BullmqQueueBackend implements SchedulerQueue {
  private processor: MemoryQueueProcessor | null = null;
  private nextId = 0;
  private readonly queues = new Map<string, Queue>();
  private readonly workers = new Map<string, Worker>();
  private readonly active = new Map<string, number>();
  private readonly connection: ConnectionOptions;
  private readonly namePrefix: string;

  constructor(connection: ConnectionOptions, namePrefix = 'scheduler-repo') {
    this.connection = connection;
    this.namePrefix = namePrefix;
  }

  setProcessor(fn: MemoryQueueProcessor): void {
    this.processor = fn;
  }

  private ensurePair(projectId: string): Queue {
    let queue = this.queues.get(projectId);
    if (queue) return queue;
    const name = `${this.namePrefix}:${projectId}`;
    queue = new Queue(name, { connection: this.connection });
    this.queues.set(projectId, queue);

    const worker = new Worker(
      name,
      async (bullJob) => {
        if (!this.processor) throw new Error('BullmqQueueBackend: processor not set');
        this.active.set(projectId, (this.active.get(projectId) ?? 0) + 1);
        try {
          const job: Job = {
            id: String(bullJob.id ?? ++this.nextId),
            data: bullJob.data as JobData,
            attempts: bullJob.attemptsMade + 1,
          };
          await this.processor(job);
        } finally {
          const now = this.active.get(projectId) ?? 1;
          this.active.set(projectId, Math.max(0, now - 1));
        }
      },
      { connection: this.connection, concurrency: 1 },
    );
    this.workers.set(projectId, worker);
    return queue;
  }

  async add(data: JobData): Promise<Job> {
    const queue = this.ensurePair(data.projectId);
    const bullJob = await queue.add(data.kind, data, {
      attempts: 1,
      removeOnComplete: 100,
      removeOnFail: 100,
    });
    return { id: String(bullJob.id ?? ++this.nextId), data, attempts: 0 };
  }

  async activeCountForProject(projectId: string): Promise<number> {
    return this.active.get(projectId) ?? 0;
  }

  async waitIdle(): Promise<void> {
    /* c8 ignore next -- production drain path */
    return;
  }

  async close(): Promise<void> {
    await Promise.all(
      Array.from(this.workers.values()).map((w) => w.close().catch(() => undefined)),
    );
    await Promise.all(
      Array.from(this.queues.values()).map((q) => q.close().catch(() => undefined)),
    );
    this.workers.clear();
    this.queues.clear();
  }
}
