import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { loadOwnedProject } from '../backups/backups.service.js';
import { clampRetentionPolicy } from '../billing/index.js';
import type { RetentionPolicyShape } from '../billing/index.js';
import type { ResticRunnerExt, RetentionPolicy } from './scheduler.boundaries.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/**
 * Map a retention policy → restic `forget --prune` argv. Retention is
 * destructive (deletes snapshots + reclaims space) — always its own job,
 * never inline with a backup run.
 */
export function pruneArgs(retention: RetentionPolicy): string[] {
  const args = [
    'forget',
    '--prune',
    '--keep-daily',
    String(retention.keepDaily),
    '--keep-weekly',
    String(retention.keepWeekly),
    '--keep-monthly',
    String(retention.keepMonthly),
  ];
  // Continuous-backup keeps are appended only when set — 0/undefined keeps
  // the pre-continuous argv byte-identical for legacy schedules.
  if (retention.keepHourly !== undefined && retention.keepHourly > 0) {
    args.push('--keep-hourly', String(retention.keepHourly));
  }
  if (retention.keepLast !== undefined && retention.keepLast > 0) {
    args.push('--keep-last', String(retention.keepLast));
  }
  return args;
}

export interface RunPruneDeps {
  t?: Translator;
  resticRunner: ResticRunnerExt;
  /** Tier clamp, injectable for tests. Defaults to billing's policy clamp. */
  clampPolicy?: (
    userId: string,
    policy: RetentionPolicyShape,
  ) => Promise<RetentionPolicyShape>;
}

export interface RunPruneResult {
  ok: boolean;
  detail: string;
}

export async function runPrune(
  projectId: string,
  userId: string,
  retention: RetentionPolicy,
  deps: RunPruneDeps,
): Promise<RunPruneResult> {
  const t = deps.t ?? identityT;
  const project = await loadOwnedProject(projectId, userId, { t });
  // Legal hold beats retention. IDEA.md §8 / prompt 11: auto-prune MUST NOT
  // delete snapshots on a held project. The job returns ok=true so the
  // scheduler records it as a successful skip, not a failure.
  if (project.legalHold) {
    return { ok: true, detail: t('security.legalHold.pruneSkipped') };
  }
  // Tier ceiling beats the stored schedule policy: a downgraded user must not
  // keep retaining on their old, wider policy.
  const clamp = deps.clampPolicy ?? clampRetentionPolicy;
  const effective = await clamp(userId, retention);
  try {
    await deps.resticRunner.forget(pruneArgs(effective));
    return { ok: true, detail: t('scheduler.success.prunePassed') };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw HttpError.internal(t('scheduler.error.pruneFailed', { message }));
  }
}
