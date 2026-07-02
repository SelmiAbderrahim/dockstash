/**
 * CLI entrypoint for the superadmin seeder. Runs from docker-entrypoint.sh
 * before the server process starts. Thin seam over `seedSuperadmin` —
 * coverage-excluded like `src/server.ts`; the seed logic itself is fully
 * tested in `modules/superadmin/superadmin.seed.test.ts`.
 */
import { connectDb, disconnectDb } from './config/db.js';
import { logger } from './config/logger.js';
import { seedSuperadmin } from './modules/superadmin/superadmin.seed.js';

async function main(): Promise<void> {
  // connectDb retries with backoff, which doubles as the "wait for Mongo".
  await connectDb();
  const result = await seedSuperadmin();
  logger.info({ result }, 'superadmin seed done');
  await disconnectDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'superadmin seed failed');
    process.exit(1);
  });
