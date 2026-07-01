import { describe, expect, it } from 'vitest';
import { getCurrentKeyVersion, getKey } from '../../shared/crypto/keyRegistry.js';
import {
  combineShares,
  decodeShare,
  encodeShare,
  generateRecoveryCodes,
  splitSecret,
  unwrapWithRecoveryCodes,
} from './recovery-codes.js';

describe('Shamir split/combine over GF(256)', () => {
  it('any threshold subset reconstructs the secret; fewer does not', () => {
    const secret = Buffer.from('0123456789abcdef0123456789abcdef', 'hex');
    const shares = splitSecret(secret, 5, 3);
    expect(shares).toHaveLength(5);
    // exactly-threshold subsets (different combinations) all reconstruct
    expect(combineShares([shares[0]!, shares[1]!, shares[2]!])).toEqual(secret);
    expect(combineShares([shares[4]!, shares[1]!, shares[3]!])).toEqual(secret);
    // more than threshold also works
    expect(combineShares(shares)).toEqual(secret);
    // fewer than threshold reconstructs the WRONG value
    expect(combineShares([shares[0]!, shares[1]!])).not.toEqual(secret);
  });

  it('rejects invalid parameters', () => {
    const s = Buffer.alloc(32);
    expect(() => splitSecret(s, 3, 1)).toThrow(/invalid Shamir/);
    expect(() => splitSecret(s, 3, 4)).toThrow(/invalid Shamir/);
    expect(() => splitSecret(s, 256, 2)).toThrow(/invalid Shamir/);
  });
});

describe('recovery-code encode/decode', () => {
  it('round-trips a share', () => {
    const share = { x: 10, y: Buffer.alloc(32, 0xab) };
    const code = encodeShare(share);
    expect(code).toMatch(/^0a-(ab){32}$/);
    const back = decodeShare(` ${code} `); // tolerant of surrounding whitespace
    expect(back.x).toBe(10);
    expect(back.y).toEqual(share.y);
  });

  it('rejects malformed / invalid codes', () => {
    expect(() => decodeShare('not-a-code')).toThrow(/malformed/);
    expect(() => decodeShare('zz-aabb')).toThrow(/malformed/);
    // x = 0 is reserved for the secret
    expect(() => decodeShare(`00-${'ab'.repeat(32)}`)).toThrow(/invalid/);
    // wrong y length
    expect(() => decodeShare('01-aabb')).toThrow(/invalid/);
  });
});

describe('escrow wrap / unwrap', () => {
  it('recovers the master key from exactly threshold codes', () => {
    const { codes, wrapped } = generateRecoveryCodes(10, 6);
    expect(codes).toHaveLength(10);
    expect(wrapped.threshold).toBe(6);
    expect(wrapped.shareCount).toBe(10);
    expect(wrapped.keyVersion).toBe(getCurrentKeyVersion());

    const recovered = unwrapWithRecoveryCodes(wrapped, codes.slice(0, 6));
    expect(recovered).not.toBeNull();
    expect(recovered).toEqual(getKey(getCurrentKeyVersion()));
  });

  it('recovers with more than threshold codes', () => {
    const { codes, wrapped } = generateRecoveryCodes(6, 3);
    const recovered = unwrapWithRecoveryCodes(wrapped, codes);
    expect(recovered).toEqual(getKey(getCurrentKeyVersion()));
  });

  it('returns null with fewer than threshold codes', () => {
    const { codes, wrapped } = generateRecoveryCodes(10, 6);
    expect(unwrapWithRecoveryCodes(wrapped, codes.slice(0, 5))).toBeNull();
  });

  it('returns null when the codes are wrong (GCM auth fails)', () => {
    const { wrapped } = generateRecoveryCodes(10, 3);
    const bogus = Array.from({ length: 3 }, (_, i) =>
      encodeShare({ x: i + 1, y: Buffer.alloc(32, 0x00) }),
    );
    expect(unwrapWithRecoveryCodes(wrapped, bogus)).toBeNull();
  });

  it('returns null when a supplied code is malformed', () => {
    const { codes, wrapped } = generateRecoveryCodes(10, 3);
    const withBad = [codes[0]!, 'garbage', codes[2]!];
    expect(unwrapWithRecoveryCodes(wrapped, withBad)).toBeNull();
  });
});
