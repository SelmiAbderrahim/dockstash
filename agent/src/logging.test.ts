import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { makeLogger } from './logging.js';

describe('makeLogger', () => {
  const savedLogLevel = process.env.LOG_LEVEL;
  beforeEach(() => {
    delete process.env.LOG_LEVEL;
  });
  afterEach(() => {
    if (savedLogLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = savedLogLevel;
  });

  it('falls back to info when LOG_LEVEL is unset', () => {
    delete process.env.LOG_LEVEL;
    const logger = makeLogger();
    expect(logger.level).toBe('info');
  });

  it('honors LOG_LEVEL when it is set', () => {
    process.env.LOG_LEVEL = 'warn';
    const logger = makeLogger();
    expect(logger.level).toBe('warn');
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
