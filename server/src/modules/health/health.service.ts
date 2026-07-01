import mongoose from 'mongoose';
import { env } from '../../config/env.js';

export interface HealthCheckResult {
  status: 'ok' | 'degraded';
  db: boolean;
  redis: boolean;
  redisConfigured: boolean;
  timestamp: string;
}

export interface HealthDeps {
  probeDb?: () => boolean;
  probeRedis?: () => Promise<boolean>;
  now?: () => Date;
}

function defaultProbeDb(): boolean {
  return mongoose.connection.readyState === 1;
}

async function defaultProbeRedis(): Promise<boolean> {
  if (!env.REDIS_URL) return true; // not configured = not required
  return true; // stub: real client wiring lands with the BullMQ workers
}

export async function runHealthCheck(
  deps: HealthDeps = {},
): Promise<HealthCheckResult> {
  const db = (deps.probeDb ?? defaultProbeDb)();
  const redis = await (deps.probeRedis ?? defaultProbeRedis)();
  const now = deps.now ? deps.now() : new Date();
  return {
    status: db && redis ? 'ok' : 'degraded',
    db,
    redis,
    redisConfigured: Boolean(env.REDIS_URL),
    timestamp: now.toISOString(),
  };
}
