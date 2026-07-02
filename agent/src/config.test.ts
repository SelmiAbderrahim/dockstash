import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const VALID_TOKEN = `dsa_${'a'.repeat(24)}.${'b'.repeat(48)}`;

describe('loadConfig', () => {
  it('parses a fully specified environment', () => {
    const config = loadConfig({
      DOCKSTASH_URL: 'https://dockstash.com/',
      DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      DOCKSTASH_POLL_INTERVAL_MS: '5000',
      DOCKSTASH_HEARTBEAT_INTERVAL_MS: '15000',
      DOCKER_HOST: 'tcp://custom-proxy:1234',
      RESTIC_BINARY: '/usr/bin/restic',
      RESTIC_CACHE_DIR: '/data/restic-cache',
      HEALTH_PORT: '8080',
    });
    expect(config).toEqual({
      DOCKSTASH_URL: 'https://dockstash.com',
      DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      DOCKSTASH_POLL_INTERVAL_MS: 5000,
      DOCKSTASH_HEARTBEAT_INTERVAL_MS: 15000,
      DOCKER_HOST: 'tcp://custom-proxy:1234',
      RESTIC_BINARY: '/usr/bin/restic',
      RESTIC_CACHE_DIR: '/data/restic-cache',
      HEALTH_PORT: 8080,
    });
    // Integer coercions: string env vars become real numbers.
    expect(typeof config.DOCKSTASH_POLL_INTERVAL_MS).toBe('number');
    expect(typeof config.HEALTH_PORT).toBe('number');
  });

  it('applies defaults for optional fields on a minimal environment', () => {
    const config = loadConfig({
      DOCKSTASH_URL: 'https://dockstash.com',
      DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
    });
    expect(config.DOCKSTASH_POLL_INTERVAL_MS).toBe(10_000);
    expect(config.DOCKSTASH_HEARTBEAT_INTERVAL_MS).toBe(30_000);
    expect(config.DOCKER_HOST).toBe('tcp://docker-socket-proxy:2375');
    expect(config.RESTIC_BINARY).toBe('restic');
    expect(config.RESTIC_CACHE_DIR).toBe('/tmp/restic-cache');
    expect(config.HEALTH_PORT).toBe(9924);
  });

  it('strips trailing slashes from DOCKSTASH_URL', () => {
    const config = loadConfig({
      DOCKSTASH_URL: 'https://dockstash.com///',
      DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
    });
    expect(config.DOCKSTASH_URL).toBe('https://dockstash.com');
  });

  it('throws on a malformed agent token', () => {
    expect(() =>
      loadConfig({
        DOCKSTASH_URL: 'https://dockstash.com',
        DOCKSTASH_AGENT_TOKEN: 'not-a-token',
      }),
    ).toThrow(/malformed agent token/);
  });

  it('throws on an invalid DOCKSTASH_URL', () => {
    expect(() =>
      loadConfig({
        DOCKSTASH_URL: 'not-a-url',
        DOCKSTASH_AGENT_TOKEN: VALID_TOKEN,
      }),
    ).toThrow();
  });
});
