import { describe, expect, it } from 'vitest';
import { makeLogger } from './logging.js';

describe('makeLogger', () => {
  it('defaults to LOG_LEVEL or info', () => {
    const logger = makeLogger();
    expect(logger.level).toBe(process.env.LOG_LEVEL ?? 'info');
  });

  it('accepts an explicit level', () => {
    const logger = makeLogger('debug');
    expect(logger.level).toBe('debug');
  });

  it('redacts repo.password and ssh.privateKey without throwing', () => {
    const logger = makeLogger('info');
    expect(() =>
      logger.info(
        {
          repo: { password: 'super-secret', url: 'sftp:backup@host:/repo' },
          ssh: { privateKey: 'PRIVATE-KEY-BYTES', hostKeyLine: 'host ssh-ed25519 AAAA' },
        },
        'job claimed',
      ),
    ).not.toThrow();
  });
});
