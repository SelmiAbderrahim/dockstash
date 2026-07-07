import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guard for threat surface #3 (Plan Caps / Entitlement
 * Bypass). Static checks over the mounted gated create/enable controllers:
 * a future edit that adds a new gated verb but forgets to call an entitlement
 * assert BEFORE the reserve/create step fails loudly here. Cross-referenced
 * from `prompts/dockstash-security/03-plan-caps-entitlement-bypass-opus-4.7.md`
 * and `.claude/rules/entitlement-cap-ordering.md`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(HERE, '../../modules');

interface GatedHandler {
  file: string;
  handlerName: string;
  /** Regex matching an assert or reserve call the handler MUST contain. */
  guard: RegExp;
  /** Human-readable name of the required guard (for failure messages). */
  guardLabel: string;
}

// The load-bearing gated verbs: every POST/PATCH that either reserves a
// domain slot or enables a paid feature. `enqueue` reads its check through
// the runtime `entitlements.canEnqueue` hook, not a controller-level call,
// so it's covered by the runtime tests in scheduler.test.ts (not scanned here).
const GATED_HANDLERS: GatedHandler[] = [
  {
    file: 'backups/backups.controller.ts',
    handlerName: 'create',
    guard: /reserveProjectSlot\s*\(/,
    guardLabel: 'reserveProjectSlot (atomic project-cap reservation)',
  },
  {
    file: 'backups/backups.controller.ts',
    handlerName: 'patchAlerts',
    guard: /assertAlertsAllowed\s*\(/,
    guardLabel: 'assertAlertsAllowed',
  },
  {
    file: 'backups/backups.controller.ts',
    handlerName: 'patchMirror',
    guard: /assertMirrorAllowed\s*\(/,
    guardLabel: 'assertMirrorAllowed',
  },
  {
    file: 'backups/backups.controller.ts',
    handlerName: 'patchAgent',
    guard: /assertMultiVpsAllowed\s*\(/,
    guardLabel: 'assertMultiVpsAllowed',
  },
  {
    file: 'backups/backups.verify.controller.ts',
    handlerName: 'drill',
    guard: /assertRestoreDrillAllowed\s*\(/,
    guardLabel: 'assertRestoreDrillAllowed',
  },
  {
    file: 'backups/backups.snapshots.controller.ts',
    handlerName: 'resolvePitr',
    guard: /assertPitrAllowed\s*\(/,
    guardLabel: 'assertPitrAllowed',
  },
  {
    file: 'scheduler/scheduler.controller.ts',
    handlerName: 'create',
    // createSchedule (service) fires assertScheduleAllowed on every create; the
    // controller delegates. Recognize either shape so a future refactor that
    // moves the assert up doesn't fail spuriously.
    guard: /createSchedule\s*\(|assertScheduleAllowed\s*\(/,
    guardLabel: 'createSchedule (→ assertScheduleAllowed) or assertScheduleAllowed',
  },
  {
    file: 'scheduler/scheduler.controller.ts',
    handlerName: 'patch',
    // patch delegates to updateSchedule; the service re-runs assertScheduleAllowed
    // on cron/enable changes (S3-02 fix).
    guard: /updateSchedule\s*\(|assertScheduleAllowed\s*\(/,
    guardLabel: 'updateSchedule (→ assertScheduleAllowed) or assertScheduleAllowed',
  },
];

/**
 * Extract the body of a specific exported handler declared as
 * `export const NAME: RequestHandler = asyncHandler(async (req, res) => { ... });`.
 * Skips past the arg-list `(...)` (which may contain default-value braces) and
 * returns the balanced-braces body from the FIRST unmatched `{` after the
 * paren close. Returns the body text (including braces) or null.
 */
function extractBalancedBody(src: string, startFromIdx: number): string | null {
  // Find the first `{` after startFromIdx that begins a balanced brace scope,
  // skipping any `{...}` that closes before another `{` opens (default args).
  // Simplest correct rule: walk through parens first — skip `(...)` at
  // startFromIdx, then take the next `{` as body start.
  let i = startFromIdx;
  // Skip past a leading paren group if present (function args).
  while (i < src.length && src[i] !== '(' && src[i] !== '{') i += 1;
  if (i >= src.length) return null;
  if (src[i] === '(') {
    let parens = 0;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '(') parens += 1;
      else if (ch === ')') {
        parens -= 1;
        if (parens === 0) {
          i += 1;
          break;
        }
      }
    }
  }
  // Now find the body-opening `{` after the arg list / return type.
  while (i < src.length && src[i] !== '{') i += 1;
  if (i >= src.length) return null;
  const bodyStart = i;
  let depth = 0;
  for (; i < src.length; i += 1) {
    const ch = src[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(bodyStart, i + 1);
    }
  }
  return null;
}

function extractHandlerBody(src: string, handlerName: string): string | null {
  const anchor = new RegExp(
    `export\\s+const\\s+${handlerName}\\s*:\\s*RequestHandler[^\\n]*=[^\\n]*asyncHandler\\s*\\(`,
  );
  const match = anchor.exec(src);
  if (!match) return null;
  // The RequestHandler assignment is `= asyncHandler(async (req, res) => { ... });`.
  // Start the body extractor right after the matched `asyncHandler(`.
  return extractBalancedBody(src, match.index + match[0].length);
}

describe('entitlement-meta: every gated create/enable controller has an API-layer assert', () => {
  for (const spec of GATED_HANDLERS) {
    it(`${spec.file} :: ${spec.handlerName} calls ${spec.guardLabel}`, () => {
      const filePath = path.join(MODULES_DIR, spec.file);
      const src = readFileSync(filePath, 'utf8');
      const body = extractHandlerBody(src, spec.handlerName);
      expect(body, `handler ${spec.handlerName} not found in ${spec.file}`).not.toBeNull();
      expect(
        spec.guard.test(body!),
        `${spec.file}::${spec.handlerName} is missing the ${spec.guardLabel} call at the API layer`,
      ).toBe(true);
    });
  }
});

describe('entitlement-meta: reserve happens BEFORE createProject in the backups create handler', () => {
  // Ordering guard for parse → assert → reserve → create → (on-throw release).
  // A future edit that moves createProject above reserveProjectSlot re-opens
  // the S3-01 cap-bypass window.
  it('reserveProjectSlot precedes createProject in backups.controller::create', () => {
    const filePath = path.join(MODULES_DIR, 'backups/backups.controller.ts');
    const src = readFileSync(filePath, 'utf8');
    const body = extractHandlerBody(src, 'create');
    expect(body).not.toBeNull();
    const reserveIdx = body!.indexOf('reserveProjectSlot');
    const createIdx = body!.indexOf('createProject(');
    expect(reserveIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeLessThan(createIdx);
    // The rollback release must be reachable from a catch on createProject.
    expect(/releaseProjectSlot\s*\(/.test(body!)).toBe(true);
  });
});

describe('entitlement-meta: PATCH scheduler re-runs the tier gate on cron/enable transitions', () => {
  // S3-02 durable guard: a future edit that skips assertScheduleAllowed on
  // updateSchedule would let a legacy Pro schedule keep firing at minute
  // cadence after a Free downgrade.
  it('updateSchedule references assertScheduleAllowed for a cron/enable change', () => {
    const filePath = path.join(MODULES_DIR, 'scheduler/scheduler.service.ts');
    const src = readFileSync(filePath, 'utf8');
    const anchor = /export\s+async\s+function\s+updateSchedule\b/.exec(src);
    expect(anchor).not.toBeNull();
    // Skip past the fn signature (including any default-arg braces) before
    // capturing the balanced body.
    const body = extractBalancedBody(src, anchor!.index + anchor![0].length);
    expect(body).not.toBeNull();
    expect(/assertScheduleAllowed\s*\(/.test(body!)).toBe(true);
    expect(/classifyCron\s*\(/.test(body!)).toBe(true);
    // And retention clamp is applied at write time.
    expect(/clampRetentionPolicy\s*\(/.test(body!)).toBe(true);
  });
});
