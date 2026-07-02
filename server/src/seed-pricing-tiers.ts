/**
 * CLI entrypoint for the pricing-tier seeder. Runs from docker-entrypoint.sh
 * before the server process starts so tier product IDs reconcile from env on
 * every deploy. Thin seam over `seedPricingTiers` — coverage-excluded like
 * `src/server.ts` / `src/seed-superadmin.ts`; the seed logic itself is tested
 * in `modules/billing`.
 */
import { connectDb, disconnectDb } from './config/db.js';
import { logger } from './config/logger.js';
import { seedPricingTiers } from './modules/billing/pricing-tier.seed.js';

async function main(): Promise<void> {
  // connectDb retries with backoff, which doubles as the "wait for Mongo".
  await connectDb();
  await seedPricingTiers();
  logger.info('pricing-tier seed done');
  await disconnectDb();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, 'pricing-tier seed failed');
    process.exit(1);
  });
