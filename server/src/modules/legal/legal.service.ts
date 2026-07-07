import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { User } from '../users/index.js';
import { Project } from '../backups/index.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface UserExport {
  account: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    language: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    deletionScheduledAt: string | null;
    legalHold: boolean;
  };
  projects: Array<{
    id: string;
    name: string;
    path: string;
    plan: unknown;
    // Secrets are exported as ciphertext ONLY — never the plaintext restic
    // password. Same envelope discipline as the prompt-09 disaster-recovery
    // export.
    repoPasswordEnc: unknown;
    lastStatus: string;
    lastRunAt: string | null;
    paused: boolean;
    legalHold: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
}

export interface ExportUserDataDeps {
  t?: Translator;
}

export async function exportUserData(
  userId: string,
  deps: ExportUserDataDeps = {},
): Promise<UserExport> {
  const t = deps.t ?? identityT;
  const user = await User.findById(userId);
  if (!user) throw HttpError.notFound(t('errors.userNotFound'));
  const projects = await Project.find({ owner: userId }).sort({ createdAt: -1 });
  return {
    account: {
      id: user._id.toString(),
      email: user.email,
      /* c8 ignore next 2 -- schema defaults profile.firstName/lastName to '' so the nullish fallbacks never fire */
      firstName: user.profile?.firstName ?? '',
      lastName: user.profile?.lastName ?? '',
      role: user.role,
      language: user.language ?? null,
      createdAt: toIso((user as unknown as { createdAt?: Date }).createdAt),
      updatedAt: toIso((user as unknown as { updatedAt?: Date }).updatedAt),
      deletionScheduledAt: toIso(user.deletionScheduledAt ?? null),
      legalHold: Boolean(user.legalHold),
    },
    projects: projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      path: p.path,
      plan: p.plan,
      repoPasswordEnc: p.repoPasswordEnc,
      /* c8 ignore next -- schema defaults lastStatus to 'idle' so the fallback never fires */
      lastStatus: p.lastStatus ?? 'idle',
      lastRunAt: toIso(p.lastRunAt ?? null),
      paused: Boolean(p.paused),
      legalHold: Boolean(p.legalHold),
      createdAt: toIso((p as unknown as { createdAt?: Date }).createdAt),
      updatedAt: toIso((p as unknown as { updatedAt?: Date }).updatedAt),
    })),
  };
}

export interface WarningMailer {
  sendDeletionWarning(input: {
    to: string;
    firstName: string;
    purgeAt: Date;
    locale: string;
  }): Promise<void>;
}

export interface PurgeQueue {
  enqueuePurge(input: { userId: string; purgeAt: Date }): Promise<void>;
}

export interface ScheduleAccountDeletionDeps {
  t?: Translator;
  now?: () => Date;
  graceHours: number;
  mailer?: WarningMailer;
  queue: PurgeQueue;
  locale?: string;
}

export interface AccountDeletionScheduled {
  scheduledAt: string;
  purgeAt: string;
  warningEmailQueued: boolean;
}

export async function scheduleAccountDeletion(
  userId: string,
  deps: ScheduleAccountDeletionDeps,
): Promise<AccountDeletionScheduled> {
  const t = deps.t ?? identityT;
  const now = deps.now?.() ?? new Date();
  const user = await User.findById(userId);
  if (!user) throw HttpError.notFound(t('errors.userNotFound'));
  if (user.legalHold) {
    throw HttpError.forbidden(t('security.legalHold.deletionBlocked'));
  }
  if (user.deletionScheduledAt) {
    throw HttpError.conflict(t('security.deletion.alreadyScheduled'));
  }
  const purgeAt = new Date(now.getTime() + deps.graceHours * 60 * 60 * 1000);
  user.deletionScheduledAt = purgeAt;
  await user.save();

  await deps.queue.enqueuePurge({ userId, purgeAt });

  let warningEmailQueued = false;
  if (deps.mailer) {
    try {
      await deps.mailer.sendDeletionWarning({
        to: user.email,
        /* c8 ignore next -- schema defaults profile.firstName to '' so the nullish fallback never fires */
        firstName: user.profile?.firstName ?? '',
        purgeAt,
        locale: deps.locale ?? user.language ?? DEFAULT_LOCALE,
      });
      user.deletionWarningSentAt = new Date();
      await user.save();
      warningEmailQueued = true;
    } catch {
      // Warning-email failure is non-fatal — the schedule stays intact and
      // a nightly sweep re-attempts before purge.
      warningEmailQueued = false;
    }
  }

  return {
    scheduledAt: now.toISOString(),
    purgeAt: purgeAt.toISOString(),
    warningEmailQueued,
  };
}

function toIso(d: Date | null | undefined): string | null {
  if (!d) return null;
  /* c8 ignore next 2 -- callers only ever pass a Date or null; the coercion/NaN guards are belt-and-braces */
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export interface PurgeAccountDeps {
  t?: Translator;
  now?: () => Date;
  resticRepoPurger?: {
    purgeRepo(project: {
      id: string;
      owner: string;
      path: string;
    }): Promise<void>;
  };
}

export interface PurgeResult {
  ok: boolean;
  reason?: 'legalHold' | 'notScheduled' | 'notDue' | 'notFound';
  projectsPurged: number;
}

export async function purgeAccount(
  userId: string,
  deps: PurgeAccountDeps = {},
): Promise<PurgeResult> {
  const t = deps.t ?? identityT;
  const now = deps.now?.() ?? new Date();
  const user = await User.findById(userId);
  if (!user) return { ok: false, reason: 'notFound', projectsPurged: 0 };
  if (user.legalHold) return { ok: false, reason: 'legalHold', projectsPurged: 0 };
  if (!user.deletionScheduledAt) return { ok: false, reason: 'notScheduled', projectsPurged: 0 };
  if (user.deletionScheduledAt.getTime() > now.getTime()) {
    return { ok: false, reason: 'notDue', projectsPurged: 0 };
  }
  const projects = await Project.find({ owner: userId });
  let purged = 0;
  let skippedForLegalHold = false;
  for (const p of projects) {
    if (p.legalHold) {
      skippedForLegalHold = true;
      continue;
    }
    if (deps.resticRepoPurger) {
      try {
        await deps.resticRepoPurger.purgeRepo({
          id: p._id.toString(),
          owner: userId,
          path: p.path,
        });
      } catch (err) {
        throw HttpError.internal(
          t('security.deletion.purgeFailed', {
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    }
    await Project.deleteOne({ _id: p._id });
    purged += 1;
  }
  // F8: a project under legal hold survives the loop above. Deleting the User
  // row anyway would orphan it (no owner, yet not user-level held). Defer the
  // account purge — the deletion schedule stays intact so a later sweep retries
  // once the hold lifts. Never deletes more than the non-held projects.
  if (skippedForLegalHold) {
    return { ok: false, reason: 'legalHold', projectsPurged: purged };
  }
  await User.deleteOne({ _id: user._id });
  return { ok: true, projectsPurged: purged };
}
