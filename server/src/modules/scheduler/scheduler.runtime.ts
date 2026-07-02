import type { Server as IoServer } from 'socket.io';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';
import { allowAllEntitlements } from './scheduler.entitlements.js';
import { MemoryQueue } from './scheduler.queue.memory.js';
import { NodeCronScheduler } from './scheduler.cron.node.js';
import { attachLogStream } from './scheduler.logstream.js';
import { configureSchedulerController } from './scheduler.controller.js';
import { processJob } from './scheduler.dispatcher.js';
import { runHeartbeatSweep } from '../alerting/index.js';
import type {
  AlertHook,
  EntitlementChecker,
  ResticRunnerExt,
  SchedulerCron,
  SchedulerQueue,
} from './scheduler.boundaries.js';
import { reconcileCron } from './scheduler.cron.js';
import { Schedule } from './scheduler.model.js';
import type { DispatchDeps } from './scheduler.dispatcher.js';
import {
  configureAgentJobEvents,
  expireStaleAgentJobs,
  makeAgentAwareQueue,
  ownerOfAgentJob,
  sweepOfflineAgents,
} from '../agents/index.js';

export interface SchedulerRuntime {
  queue: SchedulerQueue;
  cron: SchedulerCron;
  shutdown(): Promise<void>;
}

export interface StartSchedulerOptions {
  io: IoServer;
  resticRunnerFor(projectId: string, owner: string): ResticRunnerExt;
  dispatchDepsFor?(projectId: string, owner: string): Omit<DispatchDeps, 'resticRunner'>;
  entitlements?: EntitlementChecker;
  alert?: AlertHook;
  maxAttempts?: number;
  baseBackoffMs?: number;
  useBullmq?: boolean;
}

/**
 * Boot the scheduler: attach the log-stream namespace to the retained `io`,
 * build the queue + worker, register a cron per enabled `Schedule`, and wire
 * the controller. Returns a `shutdown()` that closes them all in order.
 */
export async function startScheduler(
  opts: StartSchedulerOptions,
): Promise<SchedulerRuntime> {
  const entitlements = opts.entitlements ?? allowAllEntitlements;
  const localQueue = new MemoryQueue();
  // Jobs for projects assigned to a remote agent are persisted for the agent
  // to claim; everything else runs on the local in-process worker.
  const queue = makeAgentAwareQueue(localQueue);

  const jobOwnerIndex = new Map<string, string>();

  const logs = attachLogStream({
    io: opts.io,
    ownership: {
      async ownerOf(jobId) {
        // Local jobs live in the in-memory index; agent jobs are persistent.
        return jobOwnerIndex.get(jobId) ?? (await ownerOfAgentJob(jobId));
      },
    },
  });

  configureAgentJobEvents({ logs });

  localQueue.setProcessor(async (job) => {
    jobOwnerIndex.set(job.id, job.data.owner);
    const restic = opts.resticRunnerFor(job.data.projectId, job.data.owner);
    const extra = opts.dispatchDepsFor?.(job.data.projectId, job.data.owner) ?? {};
    await processJob(job, {
      ...extra,
      resticRunner: restic,
      queue,
      logs,
      alert: opts.alert,
      maxAttempts: opts.maxAttempts,
      baseBackoffMs: opts.baseBackoffMs,
    });
  });

  const cron = new NodeCronScheduler();
  await reconcileCron({ cron, queue, entitlements });

  // Dead-man's-switch heartbeat — hourly sweep. Idempotent: registering the
  // same id twice replaces the prior task in place.
  cron.register('__heartbeat__', '0 * * * *', async () => {
    try {
      await runHeartbeatSweep();
    } catch (err) {
      logger.error({ err }, 'scheduler: heartbeat sweep failed');
    }
  });

  // Fleet maintenance — every 5 minutes: fail leased agent jobs whose lease
  // expired (agent died mid-run) and flip stale `online` agents to offline.
  cron.register('__agent_leases__', '*/5 * * * *', async () => {
    try {
      await expireStaleAgentJobs();
      await sweepOfflineAgents();
    } catch (err) {
      logger.error({ err }, 'scheduler: agent maintenance sweep failed');
    }
  });

  configureSchedulerController({ queue, entitlements });

  logger.info(
    {
      cronCount: cron.list().length,
      backend: opts.useBullmq ? 'bullmq' : 'memory',
      redisUrl: env.REDIS_URL ? 'configured' : 'unset',
    },
    'scheduler: started',
  );

  return {
    queue,
    cron,
    async shutdown() {
      cron.clear();
      await queue.close();
    },
  };
}

export { Schedule };
