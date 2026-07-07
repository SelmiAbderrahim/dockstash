import { readFileSync, readdirSync } from 'node:fs';
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
const SRC_DIR = path.resolve(HERE, '../..');

/** Recursively collect every `.ts` under a directory. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(full));
    else if (entry.name.endsWith('.ts')) out.push(full);
  }
  return out;
}

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
    // Agent registration is a countable resource — reserve the per-plan slot
    // atomically BEFORE the Agent record is created (parse → reserve → create).
    file: 'agents/agents.controller.ts',
    handlerName: 'registerAgentHandler',
    guard: /reserveAgentSlot\s*\(/,
    guardLabel: 'reserveAgentSlot (atomic agent-cap reservation)',
  },
  {
    // Deleting an agent frees its reserved slot after the owner-scoped delete.
    file: 'agents/agents.controller.ts',
    handlerName: 'deleteAgentHandler',
    guard: /releaseAgentSlot\s*\(/,
    guardLabel: 'releaseAgentSlot (slot release on delete)',
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

describe('entitlement-meta: the legacy multi-VPS boolean gate is fully retired', () => {
  // The fleet is now a metered per-plan count (reserveAgentSlot) instead of a
  // Business-only boolean. The old `assertMultiVps` + `Allowed` helper must not
  // survive anywhere in server/src — a stray call would reintroduce the tier
  // lock the migration removed. The token is split so this test file itself
  // (which names the token in this comment/string) never self-matches.
  const BANNED = 'assertMultiVps' + 'Allowed';
  it('no server source references the removed gate', () => {
    const offenders = collectTsFiles(SRC_DIR).filter((file) =>
      readFileSync(file, 'utf8').includes(BANNED),
    );
    expect(offenders, `${BANNED} still referenced in: ${offenders.join(', ')}`).toEqual([]);
  });
});

describe('entitlement-meta: agent registration reserves BEFORE it creates the record', () => {
  it('reserveAgentSlot precedes registerAgent, with a release rollback path', () => {
    const filePath = path.join(MODULES_DIR, 'agents/agents.controller.ts');
    const src = readFileSync(filePath, 'utf8');
    const body = extractHandlerBody(src, 'registerAgentHandler');
    expect(body).not.toBeNull();
    const reserveIdx = body!.indexOf('reserveAgentSlot');
    const createIdx = body!.indexOf('registerAgent(');
    expect(reserveIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(reserveIdx).toBeLessThan(createIdx);
    // The rollback release must be reachable from a catch on registerAgent.
    expect(/releaseAgentSlot\s*\(/.test(body!)).toBe(true);
  });
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

// ---------------------------------------------------------------------------
// prompt 13 durable guards: every free-landing transition pauses consistently,
// the prune path skips paused projects, and entitlement-visible transitions
// notify the user. See `.claude/rules/entitlement-cap-ordering.md`
// § "Free-Landing Consistency".
// ---------------------------------------------------------------------------

// Slice a function's source region: from its declaration anchor to the next
// top-level `export`/`async function` (or EOF). Robust for functions whose
// return type contains an object-literal `{ }` (which trips a balanced-brace
// body extractor started at the signature).
function fnBody(file: string, anchorRe: RegExp): string {
  const src = readFileSync(path.join(MODULES_DIR, file), 'utf8');
  const anchor = anchorRe.exec(src);
  expect(anchor, `anchor ${anchorRe} not found in ${file}`).not.toBeNull();
  const from = anchor!.index + anchor![0].length;
  const rest = src.slice(from);
  const next = rest.search(/\n(?:export\s|async\s+function\s)/);
  return next === -1 ? rest : rest.slice(0, next);
}

describe('entitlement-meta: every free-landing transition pauses via applyProjectCap (prompt 13 / F2,F4)', () => {
  it('webhook upsertSubscription pauses on a direct canceled/revoke', () => {
    const body = fnBody(
      'billing/webhook/registry.ts',
      /async\s+function\s+upsertSubscription\b/,
    );
    // A terminal cancel/revoke must funnel through the same free-landing pause.
    expect(/canceled['"]\s*\|\|\s*status\s*===\s*['"]revoked/.test(body)).toBe(true);
    expect(/applyProjectCap\s*\(/.test(body)).toBe(true);
  });

  it('reconcile heals terminal + orphan rows through applyProjectCap', () => {
    const src = readFileSync(
      path.join(MODULES_DIR, 'billing/reconcile.ts'),
      'utf8',
    );
    // The shared healer's terminal branch AND the orphan null-heal both pause.
    const calls = src.match(/applyProjectCap\s*\(/g) ?? [];
    expect(calls.length).toBeGreaterThanOrEqual(2);
    // F4: orphan rows are revisited by id.
    expect(/getSubscription\s*\(/.test(src)).toBe(true);
  });

  it('expireGraceIfNeeded and handleRefund pause on the free landing', () => {
    const grace = fnBody(
      'billing/lifecycle.service.ts',
      /export\s+async\s+function\s+expireGraceIfNeeded\b/,
    );
    expect(/applyProjectCap\s*\(/.test(grace)).toBe(true);
    const refund = fnBody(
      'billing/lifecycle.service.ts',
      /export\s+async\s+function\s+handleRefund\b/,
    );
    expect(/applyProjectCap\s*\(/.test(refund)).toBe(true);
  });
});

describe('entitlement-meta: prune skips a paused project before forget (prompt 13 / F1)', () => {
  it('runPrune guards on project.paused before resticRunner.forget', () => {
    const src = readFileSync(
      path.join(MODULES_DIR, 'scheduler/scheduler.prune.service.ts'),
      'utf8',
    );
    const pausedIdx = src.indexOf('project.paused');
    const forgetIdx = src.indexOf('.forget(');
    expect(pausedIdx).toBeGreaterThan(-1);
    expect(forgetIdx).toBeGreaterThan(-1);
    expect(pausedIdx).toBeLessThan(forgetIdx);
  });
});

describe('entitlement-meta: entitlement-visible transitions notify the user (prompt 13 / F3)', () => {
  it('dunning_started + reactivated fire from the webhook path', () => {
    const src = readFileSync(
      path.join(MODULES_DIR, 'billing/webhook/registry.ts'),
      'utf8',
    );
    expect(src.includes("notifyLifecycleEvent('dunning_started'")).toBe(true);
    expect(src.includes("notifyLifecycleEvent('reactivated'")).toBe(true);
  });

  it('grace_expired fires from the lifecycle sweep', () => {
    const src = readFileSync(
      path.join(MODULES_DIR, 'billing/lifecycle.service.ts'),
      'utf8',
    );
    expect(src.includes("notifyLifecycleEvent('grace_expired'")).toBe(true);
  });
});
