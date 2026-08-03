import { Redis } from 'ioredis';
import { RedisStore } from 'rate-limit-redis';
import type { Store } from 'express-rate-limit';
import type { RedisStoreFactory } from './rate-limit.js';

/**
 * Real ioredis-backed Redis store for `express-rate-limit`. Wired at server
 * boot (`server.ts`) so multi-instance deployments share one bucket per
 * limiter (see S1-02). Kept in its own module so unit tests never load the
 * ioredis socket. The `c8 ignore` block mirrors the pattern used in
 * `modules/health/health.service.ts` for the same reason.
 */
/* c8 ignore start -- real ioredis socket + rate-limit-redis client; exercised
   in production and by the health-probe path, mocked in unit tests. */
export const productionRedisStoreFactory: RedisStoreFactory = (redisUrl: string): Store | null => {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 1000,
    enableOfflineQueue: true,
  });
  // `sendCommand` returns rate-limit-redis's `RedisReply` — an opaque
  // downstream type. ioredis's `.call()` resolves to `unknown`; cast at the
  // boundary rather than dragging that type into the shared signature.
  return new RedisStore({
    prefix: 'rl:',
    sendCommand: ((...args: string[]) =>
      client.call(args[0]!, ...args.slice(1))) as unknown as (
      ...args: string[]
    ) => Promise<never>,
  });
};
/* c8 ignore stop */
