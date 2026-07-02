import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { hashPassword } from '../auth/index.js';
import { ROLE_SUPERADMIN, User } from '../users/index.js';

export type SeedSuperadminResult = {
  status: 'skipped' | 'exists' | 'created';
  email?: string;
};

export interface SeedSuperadminCreds {
  email?: string;
  password?: string;
}

/**
 * Idempotent superadmin bootstrap, run from the Docker entrypoint before the
 * server starts. Strictly create-once: an existing account with the same
 * email is NEVER touched (no password rotation, no role promotion) — changing
 * the env credentials later does nothing until the account is removed.
 *
 * The injectable `creds` param (defaulting to env) is the test seam so tests
 * never mutate `process.env` after `env.ts` has parsed it.
 */
export async function seedSuperadmin(
  creds: SeedSuperadminCreds = {
    email: env.SUPERADMIN_EMAIL,
    password: env.SUPERADMIN_PASSWORD,
  },
): Promise<SeedSuperadminResult> {
  if (!creds.email || !creds.password) {
    logger.warn('superadmin seed skipped: SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD not set');
    return { status: 'skipped' };
  }
  const email = creds.email.toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    logger.info({ email }, 'superadmin seed: account already exists, leaving untouched');
    return { status: 'exists', email };
  }
  await User.create({
    email,
    password: await hashPassword(creds.password),
    role: ROLE_SUPERADMIN,
    emailVerified: true,
    profile: { firstName: 'Super', lastName: 'Admin' },
  });
  logger.info({ email }, 'superadmin seed: account created');
  return { status: 'created', email };
}
