import { describe, expect, it, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, type EncryptedSecret } from './index.js';
import { rotateStore, type RotationTarget, type RotationStore } from './rotate.js';
import {
  __resetKeyRegistryForTests,
  __restoreKeyRegistryForTests,
  getCurrentKeyVersion,
  getKey,
  registerKey,
  setCurrentKeyVersion,
} from './keyRegistry.js';

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

  it('registers keys and moves the current version, rejecting bad input', () => {
    __resetKeyRegistryForTests({ keys: [{ version: 1, key: KEY_V1 }], currentVersion: 1 });
    expect(getCurrentKeyVersion()).toBe(1);
    expect(getKey(1).equals(KEY_V1)).toBe(true);
    expect(() => getKey(9)).toThrow(/No key registered/);

    expect(() => registerKey(2, Buffer.alloc(4))).toThrow(/must be/);
    registerKey(2, KEY_V2);
    expect(() => setCurrentKeyVersion(3)).toThrow(/not registered/);
    setCurrentKeyVersion(2);
    expect(getCurrentKeyVersion()).toBe(2);
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

  it('is idempotent — a second run with the same target is a full no-op', async () => {
    seedTwoKeys();
    let listCallCount = 0;
    const raw = [encryptSecret('one'), encryptSecret('two')];
    const swapped = new Map<string, EncryptedSecret>();
    const store: RotationStore = {
      list: async (): Promise<RotationTarget[]> => {
        listCallCount += 1;
        return Array.from(swapped.entries()).length === 0
          ? raw.map((record, i) => ({ id: String(i), record }))
          : Array.from(swapped.entries()).map(([id, record]) => ({ id, record }));
      },
      swap: async (id, next) => {
        swapped.set(id, next);
      },
    };
    const first = await rotateStore(store, 2);
    expect(first.rotated).toBe(2);
    expect(first.skipped).toBe(0);
    // Every record now sits at v2 — a second run at v2 is idempotent.
    const second = await rotateStore(store, 2);
    expect(second.rotated).toBe(0);
    expect(second.skipped).toBe(2);
    expect(second.failedAt).toBeUndefined();
    // The swap map was NOT rewritten on the idempotent pass.
    expect(listCallCount).toBe(2);
  });

  it('leaves already-swapped records intact on a mid-run failure (rollback discipline)', async () => {
    seedTwoKeys();
    // Store starts with two v1 records.
    const swapped = new Map<string, EncryptedSecret>();
    swapped.set('good', encryptSecret('one'));
    swapped.set('bad', encryptSecret('two'));
    const store: RotationStore = {
      list: async () =>
        Array.from(swapped.entries()).map(([id, record]) => ({ id, record })),
      swap: async (id, next) => {
        if (id === 'bad') throw new Error('mid-rotation blast');
        swapped.set(id, next);
      },
    };
    const result = await rotateStore(store, 2);
    expect(result.failedAt).toBe('bad');
    expect(result.rotated).toBe(1);
    // 'good' is at v2; 'bad' is untouched at v1 — no partial-state disaster,
    // and both still decrypt because both keys stay registered.
    const good = swapped.get('good');
    const bad = swapped.get('bad');
    if (!good || !bad) throw new Error('missing swapped records');
    expect(good.keyVersion).toBe(2);
    expect(bad.keyVersion).toBe(1);
    expect(decryptSecret(good)).toBe('one');
    expect(decryptSecret(bad)).toBe('two');
  });

  it('never logs plaintext during rotation', async () => {
    seedTwoKeys();
    const { logger } = await import('../../config/logger.js');
    const { vi } = await import('vitest');
    const spies = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'].map((level) =>
      vi.spyOn(logger, level as 'info').mockImplementation(() => logger as never),
    );
    const store: RotationStore = {
      list: async () => [{ id: 'x', record: encryptSecret('SECRET-VALUE') }],
      swap: async () => {},
    };
    await rotateStore(store, 2);
    for (const spy of spies) {
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    }
  });
});
