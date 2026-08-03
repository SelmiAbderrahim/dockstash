import { Server as IoServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from './config/db.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { startScheduler, type SchedulerRuntime } from './modules/scheduler/index.js';
import {
  configureSnapshotsController,
  makeDispatchDepsFor,
  makeProductionSnapshotLister,
  makeResticRunnerFor,
  placeholderResticRunner,
} from './modules/backups/index.js';
import { configureSettingsController, makeProductionSshProbe } from './modules/settings/index.js';
import { wireRecoveryController } from './boot/recovery.js';
import { setRedisStoreFactory } from './shared/middleware/rate-limit.js';
import { productionRedisStoreFactory } from './shared/middleware/rate-limit-redis-store.js';

function main(): void {
  // Redis-backed rate-limit store (S1-02). Wired BEFORE `createApp()` so every
  // limiter constructed at mount time picks up the shared bucket. No-op when
  // REDIS_URL is unset or NODE_ENV === 'test' (the factory itself is only ever
  // invoked from `buildStore()` inside rate-limit.ts and short-circuits there).
  setRedisStoreFactory(productionRedisStoreFactory);
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

  // `RESTIC_RUNNER=process` (set by compose) spawns the real restic binary;
  // the default keeps the loud placeholder so nothing silently "succeeds".
  const useRealRunner = env.RESTIC_RUNNER === 'process';
  if (useRealRunner) {
    configureSnapshotsController(makeProductionSnapshotLister());
    wireRecoveryController();
    configureSettingsController({ probe: makeProductionSshProbe() });
  }
  let scheduler: SchedulerRuntime | null = null;
  startScheduler({
    io,
    resticRunnerFor: useRealRunner
      ? makeResticRunnerFor
      : () => placeholderResticRunner(),
    ...(useRealRunner ? { dispatchDepsFor: () => makeDispatchDepsFor() } : {}),
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
