import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/users.model.js';
import { getCurrentKeyVersion, getKey } from '../../shared/crypto/keyRegistry.js';
import {
  enableRecoveryEscrow,
  recoverMasterKeyBytes,
} from './recovery.escrow.js';

async function seedUser(email = 'escrow@example.com') {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'E', lastName: 'S' },
    emailVerified: true,
  });
  return String(u._id);
}

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
beforeEach(async () => {
  await clearCollections();
});

describe('recovery escrow (opt-in)', () => {
  it('enables escrow, persists the wrapped key, and returns codes once', async () => {
    const userId = await seedUser();
    const result = await enableRecoveryEscrow(userId, { count: 8, threshold: 4 });
    expect(result.enabled).toBe(true);
    expect(result.codes).toHaveLength(8);
    expect(result.threshold).toBe(4);
    expect(result.shareCount).toBe(8);

    const user = await User.findById(userId).lean();
    expect(user?.recoveryEscrow?.enabled).toBe(true);
    // The wrapped key is stored; the codes are NOT.
    expect(user?.recoveryEscrow?.wrappedKey?.ciphertext).toBeTruthy();
    expect(JSON.stringify(user?.recoveryEscrow)).not.toContain(result.codes[0]);
  });

  it('recovers the master key from stored escrow using threshold codes', async () => {
    const userId = await seedUser();
    const { codes } = await enableRecoveryEscrow(userId, { count: 8, threshold: 4 });
    const recovered = await recoverMasterKeyBytes(userId, codes.slice(0, 4));
    expect(recovered).toEqual(getKey(getCurrentKeyVersion()));
  });

  it('returns null when escrow is not enabled', async () => {
    const userId = await seedUser();
    expect(await recoverMasterKeyBytes(userId, ['01-00'])).toBeNull();
  });

  it('returns null for wrong codes even when escrow is enabled', async () => {
    const userId = await seedUser();
    await enableRecoveryEscrow(userId, { count: 8, threshold: 4 });
    // Fabricated codes cannot unwrap.
    const bogus = [
      `01-${'00'.repeat(32)}`,
      `02-${'00'.repeat(32)}`,
      `03-${'00'.repeat(32)}`,
      `04-${'00'.repeat(32)}`,
    ];
    expect(await recoverMasterKeyBytes(userId, bogus)).toBeNull();
  });

  it('throws when the user does not exist (with and without a translator)', async () => {
    await expect(
      enableRecoveryEscrow('507f1f77bcf86cd799439011'),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      enableRecoveryEscrow('507f1f77bcf86cd799439011', {
        t: (key) => `translated:${key}`,
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: 'translated:recovery.error.userNotFound',
    });
  });
});
