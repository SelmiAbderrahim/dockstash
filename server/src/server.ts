import { Server as IoServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler, type SchedulerRuntime } from './modules/scheduler/index.js';
import type { ResticRunnerExt } from './modules/scheduler/index.js';

/**
 * Placeholder restic runner. The concrete child_process wrapper lands with the
 * live-log spawn work in a follow-up prompt; until then, a job that actually
 * fires will fail through the retry+alert path, which is the correct behaviour
 * — we do NOT silently succeed backup requests without restic wired.
 */
function placeholderResticRunner(): ResticRunnerExt {
  const notWired = async (): Promise<never> => {
    throw new Error('restic runner not wired');
  };
  return {
    init: notWired,
    backup: notWired,
    snapshots: notWired,
    check: notWired,
    restore: notWired,
    unlock: notWired,
    forget: notWired,
  };
}

function main(): void {
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server up');
  });

  const io = new IoServer(server, {
    cors: { origin: env.CLIENT_URL, credentials: true },
  });

  connectDb().catch((err) => {
    logger.error({ err }, 'mongo connection unavailable');
  });

  let scheduler: SchedulerRuntime | null = null;
  startScheduler({
    io,
    resticRunnerFor: () => placeholderResticRunner(),
  })
    .then((rt) => {
      scheduler = rt;
    })
    .catch((err) => {
      logger.error({ err }, 'scheduler start failed');
    });

  const shutdown = (signal: NodeJS.Signals): void => {
    logger.info({ signal }, 'shutting down');
    const closeScheduler = scheduler ? scheduler.shutdown() : Promise.resolve();
    void closeScheduler.finally(() => {
      io.close();
      server.close(() => {
        void disconnectDb().finally(() => process.exit(0));
      });
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main();
