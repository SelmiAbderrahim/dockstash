import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';
import { getCurrentKeyVersion, getKey } from '../../shared/crypto/keyRegistry.js';

/**
 * Opt-in recovery-code escrow.
 *
 * The default crypto posture is deliberately zero-knowledge: lose
 * `MASTER_ENCRYPTION_KEY` and every secret is unrecoverable (see
 * `shared/crypto/README.md`). This module adds an EXPLICIT, opt-in escrow so a
 * user who chooses it can recover from master-key loss using recovery codes
 * they saved out-of-band.
 *
 * Mechanism:
 *  1. Generate a random 32-byte escrow key (EK).
 *  2. Wrap the current master key under EK with AES-256-GCM (`WrappedMasterKey`,
 *     stored in the DB — never the plaintext master key, never the codes).
 *  3. Split EK into N Shamir shares with threshold M (GF(256)). Each share is
 *     encoded as one recovery code, shown to the user once and never stored.
 *
 * Recovery: the user supplies ≥ M codes → Shamir-combine → EK → unwrap the
 * master key. Fewer than M codes, or wrong codes, cannot recover EK.
 *
 * Threat model delta vs. the default: an attacker who steals the DB AND ≥ M of
 * the user's recovery codes can recover the master key — so recovery codes must
 * be treated as sensitively as the master key itself. A user who declines
 * escrow is exactly as before (no wrapped key stored).
 */

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;

// ── GF(256) arithmetic (AES field, generator 0x03) ────────────────────────
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    // multiply by 3 (0x03) in GF(256): x*2 ^ x, reducing with 0x11b
    let next = x << 1;
    if (next & 0x100) next ^= 0x11b;
    next ^= x;
    x = next & 0xff;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

function gfDiv(a: number, b: number): number {
  // b !== 0 guaranteed by callers (distinct, non-zero share x-coordinates).
  return GF_EXP[GF_LOG[a]! + 255 - GF_LOG[b]!]!;
}

export interface Share {
  x: number;
  y: Buffer;
}

/**
 * Split `secret` into `count` shares, any `threshold` of which reconstruct it.
 * x-coordinates are 1..count (0 is reserved for the secret).
 */
export function splitSecret(
  secret: Buffer,
  count: number,
  threshold: number,
): Share[] {
  if (threshold < 2 || threshold > count || count > 255) {
    throw new Error('invalid Shamir parameters');
  }
  const shares: Share[] = [];
  for (let x = 1; x <= count; x++) {
    shares.push({ x, y: Buffer.alloc(secret.length) });
  }
  for (let byteIdx = 0; byteIdx < secret.length; byteIdx++) {
    // random polynomial of degree threshold-1, constant term = secret byte
    const coeffs = randomBytes(threshold - 1);
    for (const share of shares) {
      let acc = secret[byteIdx]!;
      let xPow = 1;
      for (let d = 0; d < threshold - 1; d++) {
        xPow = gfMul(xPow, share.x);
        acc ^= gfMul(coeffs[d]!, xPow);
      }
      share.y[byteIdx] = acc;
    }
  }
  return shares;
}

/** Reconstruct the secret from ≥ threshold shares (Lagrange interpolation at x=0). */
export function combineShares(shares: Share[]): Buffer {
  const len = shares[0]!.y.length;
  const out = Buffer.alloc(len);
  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    let acc = 0;
    for (let i = 0; i < shares.length; i++) {
      const xi = shares[i]!.x;
      let num = 1;
      let den = 1;
      for (let j = 0; j < shares.length; j++) {
        if (j === i) continue;
        const xj = shares[j]!.x;
        num = gfMul(num, xj);
        den = gfMul(den, xi ^ xj);
      }
      const lagrange = gfDiv(num, den);
      acc ^= gfMul(shares[i]!.y[byteIdx]!, lagrange);
    }
    out[byteIdx] = acc;
  }
  return out;
}

// ── Recovery-code encoding ────────────────────────────────────────────────
// A code is "<xx>-<hex(y)>" where xx is the 2-hex x-coordinate. Human-copyable,
// self-describing (carries its own index), and validates on decode.

export function encodeShare(share: Share): string {
  const x = share.x.toString(16).padStart(2, '0');
  return `${x}-${share.y.toString('hex')}`;
}

export function decodeShare(code: string): Share {
  const trimmed = code.trim();
  const match = /^([0-9a-fA-F]{2})-([0-9a-fA-F]+)$/.exec(trimmed);
  if (!match) throw new Error('malformed recovery code');
  const x = parseInt(match[1]!, 16);
  const y = Buffer.from(match[2]!, 'hex');
  if (x === 0 || y.length !== KEY_BYTES) {
    throw new Error('invalid recovery code');
  }
  return { x, y };
}

// ── Escrow wrap / unwrap ──────────────────────────────────────────────────
export interface WrappedMasterKey {
  ciphertext: string;
  iv: string;
  authTag: string;
  /** Which master-key version was wrapped. */
  keyVersion: number;
  /** M (codes required to recover). */
  threshold: number;
  /** N (codes issued). */
  shareCount: number;
}

export interface RecoveryCodesResult {
  codes: string[];
  wrapped: WrappedMasterKey;
}

/**
 * Generate `count` recovery codes (threshold `threshold`) and wrap the current
 * master key under a fresh escrow key. Returns codes to show ONCE and the
 * wrapped key to persist. Never persists the codes or the plaintext master key.
 */
export function generateRecoveryCodes(
  count = 10,
  threshold = 6,
): RecoveryCodesResult {
  const keyVersion = getCurrentKeyVersion();
  const masterKey = getKey(keyVersion);
  const escrowKey = randomBytes(KEY_BYTES);

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, escrowKey, iv);
  const ct = Buffer.concat([cipher.update(masterKey), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const shares = splitSecret(escrowKey, count, threshold);
  const codes = shares.map(encodeShare);

  return {
    codes,
    wrapped: {
      ciphertext: ct.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      keyVersion,
      threshold,
      shareCount: count,
    },
  };
}

/**
 * Recover the master key bytes from ≥ threshold recovery codes. Returns null if
 * too few codes are supplied or they fail to unwrap (wrong/corrupt codes).
 */
export function unwrapWithRecoveryCodes(
  wrapped: WrappedMasterKey,
  providedCodes: string[],
): Buffer | null {
  if (providedCodes.length < wrapped.threshold) return null;
  let shares: Share[];
  try {
    shares = providedCodes.slice(0, wrapped.threshold).map(decodeShare);
  } catch {
    return null;
  }
  const escrowKey = combineShares(shares);
  try {
    const decipher = createDecipheriv(
      ALGO,
      escrowKey,
      Buffer.from(wrapped.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(wrapped.authTag, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(wrapped.ciphertext, 'base64')),
      decipher.final(),
    ]);
  } catch {
    // Wrong codes → wrong escrow key → GCM auth failure.
    return null;
  }
}
