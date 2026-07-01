import cron, { type ScheduledTask } from 'node-cron';
import { logger } from '../../config/logger.js';
import type { SchedulerCron } from './scheduler.boundaries.js';

/**
 * `SchedulerCron` implementation backed by `node-cron`. `register` is
 * idempotent: registering the same id twice replaces the prior task in place
 * (so `reconcileCron` can call it every boot without stacking tasks).
 */
export class NodeCronScheduler implements SchedulerCron {
  private readonly tasks = new Map<string, ScheduledTask>();

  register(id: string, cronExpr: string, run: () => Promise<void>): void {
    const existing = this.tasks.get(id);
    if (existing) {
      existing.stop();
      this.tasks.delete(id);
    }
    const task = cron.schedule(cronExpr, async () => {
      try {
        await run();
      } catch (err) {
        logger.error({ err, id }, 'scheduler.cron: run failed');
      }
    });
    this.tasks.set(id, task);
  }

  unregister(id: string): void {
    const task = this.tasks.get(id);
    if (!task) return;
    task.stop();
    this.tasks.delete(id);
  }

  list(): string[] {
    return Array.from(this.tasks.keys());
  }

  clear(): void {
    for (const task of this.tasks.values()) task.stop();
    this.tasks.clear();
  }
}
