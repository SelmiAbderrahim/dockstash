import { describe, expect, it, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, type EncryptedSecret } from './index.js';
import { rotateStore, type RotationTarget, type RotationStore } from './rotate.js';
import { __resetKeyRegistryForTests, __restoreKeyRegistryForTests } from './keyRegistry.js';

const KEY_V1 = Buffer.alloc(32, 1);
const KEY_V2 = Buffer.alloc(32, 2);

afterEach(() => __restoreKeyRegistryForTests());

function seedTwoKeys(): void {
  __resetKeyRegistryForTests({
    keys: [
      { version: 1, key: KEY_V1 },
      { version: 2, key: KEY_V2 },
    ],
    currentVersion: 1,
  });
}

describe('rotateStore', () => {
  it('re-encrypts every record under the target key and reports counts', async () => {
    seedTwoKeys();
    const raw = [encryptSecret('alpha'), encryptSecret('beta')];
    const swapped: Record<string, EncryptedSecret> = {};
    const store: RotationStore = {
      list: async () => raw.map((r, i): RotationTarget => ({ id: String(i), record: r })),
      swap: async (id, next) => {
        swapped[id] = next;
      },
    };
    const result = await rotateStore(store, 2);
    expect(result.rotated).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.failedAt).toBeUndefined();
    const zero = swapped['0'];
    const one = swapped['1'];
    if (!zero || !one) throw new Error('records missing after rotation');
    expect(zero.keyVersion).toBe(2);
    expect(one.keyVersion).toBe(2);
    // Round-trip: rotated ciphertext still decrypts to the original plaintext.
    expect(decryptSecret(zero)).toBe('alpha');
    expect(decryptSecret(one)).toBe('beta');
  });

  it('skips records already at the target key', async () => {
    seedTwoKeys();
    const store: RotationStore = {
      list: async () => [
        { id: 'a', record: { ...encryptSecret('x'), keyVersion: 2 } },
      ],
      swap: async () => {
        throw new Error('should not swap');
      },
    };
    const result = await rotateStore(store, 2);
    expect(result.rotated).toBe(0);
    expect(result.skipped).toBe(1);
  });

  it('stops on the first failure and reports failedAt (rollback signal)', async () => {
    seedTwoKeys();
    const targets = [
      { id: 'good', record: encryptSecret('one') },
      { id: 'bad', record: encryptSecret('two') },
    ];
    const store: RotationStore = {
      list: async () => targets,
      swap: async (id) => {
        if (id === 'bad') throw new Error('db down');
      },
    };
    const result = await rotateStore(store, 2);
    expect(result.rotated).toBe(1);
    expect(result.failedAt).toBe('bad');
  });
});
