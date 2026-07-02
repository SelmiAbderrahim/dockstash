import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { env } from '../../config/env.js';
import { verifyPassword } from '../auth/index.js';
import { ROLE_MEMBER, ROLE_SUPERADMIN, User } from '../users/index.js';
import { seedSuperadmin } from './superadmin.seed.js';

const EMAIL = 'root@dockstash.test';
const PASSWORD = 'correct-horse-battery';

describe('seedSuperadmin', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('skips when the email is missing', async () => {
    const result = await seedSuperadmin({ password: PASSWORD });
    expect(result).toEqual({ status: 'skipped' });
    expect(await User.countDocuments()).toBe(0);
  });

  it('skips when the password is missing', async () => {
    const result = await seedSuperadmin({ email: EMAIL });
    expect(result).toEqual({ status: 'skipped' });
    expect(await User.countDocuments()).toBe(0);
  });

  it('skips when both credentials are missing', async () => {
    const result = await seedSuperadmin({});
    expect(result).toEqual({ status: 'skipped' });
  });

  it('creates a verified Superadmin with a bcrypt-checkable password and lowercased email', async () => {
    const result = await seedSuperadmin({ email: 'Root@Dockstash.Test', password: PASSWORD });
    expect(result).toEqual({ status: 'created', email: EMAIL });
    const user = await User.findOne({ email: EMAIL });
    expect(user).not.toBeNull();
    expect(user?.role).toBe(ROLE_SUPERADMIN);
    expect(user?.emailVerified).toBe(true);
    expect(user?.profile?.firstName).toBe('Super');
    expect(await verifyPassword(PASSWORD, user?.password ?? '')).toBe(true);
  });

  it('never overrides an existing account — role and password stay byte-identical', async () => {
    await seedSuperadmin({ email: EMAIL, password: PASSWORD });
    const before = await User.findOne({ email: EMAIL });

    const existing = await User.create({
      email: 'member@dockstash.test',
      password: 'some-prehashed-value',
      role: ROLE_MEMBER,
    });

    // Re-run against the already-seeded superadmin email with NEW credentials.
    const again = await seedSuperadmin({ email: EMAIL, password: 'a-different-password' });
    expect(again).toEqual({ status: 'exists', email: EMAIL });
    const after = await User.findOne({ email: EMAIL });
    expect(after?.password).toBe(before?.password);
    expect(after?.role).toBe(ROLE_SUPERADMIN);

    // Run against a plain member account: also untouched.
    const memberRun = await seedSuperadmin({
      email: 'member@dockstash.test',
      password: 'whatever-long-pass',
    });
    expect(memberRun).toEqual({ status: 'exists', email: 'member@dockstash.test' });
    const member = await User.findById(existing._id);
    expect(member?.role).toBe(ROLE_MEMBER);
    expect(member?.password).toBe('some-prehashed-value');
  });

  describe('default credentials from env', () => {
    const savedEmail = env.SUPERADMIN_EMAIL;
    const savedPassword = env.SUPERADMIN_PASSWORD;

    afterEach(() => {
      env.SUPERADMIN_EMAIL = savedEmail;
      env.SUPERADMIN_PASSWORD = savedPassword;
    });

    it('reads SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD when called with no args', async () => {
      env.SUPERADMIN_EMAIL = EMAIL;
      env.SUPERADMIN_PASSWORD = PASSWORD;
      const result = await seedSuperadmin();
      expect(result).toEqual({ status: 'created', email: EMAIL });
    });
  });
});
