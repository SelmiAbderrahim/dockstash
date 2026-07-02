import { z } from 'zod';

/**
 * Agent runtime configuration — env vars only. These live on the user's VPS
 * (docker-compose.agent.yml), not in the main stack's root .env.
 */
export const agentEnvSchema = z.object({
  /** Base URL of the Dockstash server, e.g. https://dockstash.com */
  DOCKSTASH_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, '')),
  /** Composite token minted at registration: dsa_<agentId>.<secret> */
  DOCKSTASH_AGENT_TOKEN: z
    .string()
    .regex(/^dsa_[a-f0-9]{24}\.[a-f0-9]{48}$/, 'malformed agent token'),
  DOCKSTASH_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(10_000),
  DOCKSTASH_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(30_000),
  /** Docker Engine endpoint — the bundled least-privilege socket proxy. */
  DOCKER_HOST: z.string().default('tcp://docker-socket-proxy:2375'),
  RESTIC_BINARY: z.string().default('restic'),
  RESTIC_CACHE_DIR: z.string().default('/tmp/restic-cache'),
  HEALTH_PORT: z.coerce.number().int().positive().default(9924),
});

export type AgentConfig = z.infer<typeof agentEnvSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AgentConfig {
  return agentEnvSchema.parse(source);
}
