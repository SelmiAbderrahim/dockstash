import { z } from 'zod';
import { DEFAULT_PROJECT_ROOT, parseProjectRoots } from './paths.js';

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
  /**
   * Comma-separated absolute directories this agent may discover, back up, and
   * restore into. Each must also be bind-mounted in docker-compose.agent.yml.
   * Invalid entries (relative, traversal, `/`, system prefixes) fail startup
   * loudly — a silently narrowed allowlist would look like "no projects found".
   */
  DOCKSTASH_PROJECT_ROOTS: z
    .string()
    .default(DEFAULT_PROJECT_ROOT)
    .transform((raw, ctx) => {
      const { roots, invalid } = parseProjectRoots(raw);
      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `invalid project root(s): ${invalid.join(', ')} — each must be an absolute path outside /, /proc, /sys, /dev, /etc, /boot, /run`,
        });
        return z.NEVER;
      }
      if (roots.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DOCKSTASH_PROJECT_ROOTS must list at least one directory',
        });
        return z.NEVER;
      }
      return roots;
    }),
  RESTIC_BINARY: z.string().default('restic'),
  RESTIC_CACHE_DIR: z.string().default('/tmp/restic-cache'),
  HEALTH_PORT: z.coerce.number().int().positive().default(9924),
});

export type AgentConfig = z.infer<typeof agentEnvSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AgentConfig {
  return agentEnvSchema.parse(source);
}
