import { pino, type Logger } from 'pino';

/**
 * JSON logs to stdout. Secret material (repo password, SSH private key) is
 * redacted defensively — executor code never passes secrets to the logger,
 * this is the belt-and-braces layer.
 */
export function makeLogger(level: string = process.env.LOG_LEVEL ?? 'info'): Logger {
  return pino({
    level,
    redact: {
      paths: ['repo.password', '*.repo.password', 'ssh.privateKey', '*.ssh.privateKey'],
      censor: '[redacted]',
    },
  });
}
