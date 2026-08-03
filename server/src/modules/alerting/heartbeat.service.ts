import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, type SupportedLocale } from '../../shared/i18n/index.js';
import { Project, type ProjectHydrated } from '../backups/backups.model.js';
import { User } from '../users/users.model.js';
import { deliverAlertEmail } from '../communication/index.js';
import { recordAlert } from '../health/index.js';

const HOUR_MS = 60 * 60 * 1000;

export interface HeartbeatSweepResult {
  projectsScanned: number;
  alertsSent: number;
  suppressed: number;
}

export interface HeartbeatSweepDeps {
  now?: Date;
  /** Override the heartbeat threshold. Defaults to `env.ALERT_HEARTBEAT_HOURS`. */
  thresholdHours?: number;
  /** Delivery gate for the email channel — always on by default. */
  emailAllowedFor?: (ownerId: string) => Promise<boolean>;
}

/**
 * Dead-man's-switch sweep. Fires an alert for every project whose last
 * successful backup is older than the heartbeat window (or that never
 * succeeded). Dedupes via `lastHeartbeatAlertAt`: a stall that already alerted
 * within the window does NOT re-alert.
 */
export async function runHeartbeatSweep(
  deps: HeartbeatSweepDeps = {},
): Promise<HeartbeatSweepResult> {
  const now = deps.now ?? new Date();
  const hours = deps.thresholdHours ?? env.ALERT_HEARTBEAT_HOURS;
  const thresholdMs = hours * HOUR_MS;
  const emailAllowedFor = deps.emailAllowedFor ?? (async () => true);

  const projects = await Project.find({});
  let alertsSent = 0;
  let suppressed = 0;

  for (const project of projects) {
    const lastGood = project.lastSuccessAt ?? null;
    const stale =
      !lastGood || now.getTime() - lastGood.getTime() > thresholdMs;
    if (!stale) continue;

    const lastAlert = project.lastHeartbeatAlertAt ?? null;
    if (lastAlert && now.getTime() - lastAlert.getTime() < thresholdMs) {
      suppressed += 1;
      continue;
    }

    const sent = await sendHeartbeatAlertFor(project, hours, now, emailAllowedFor);
    if (sent) alertsSent += 1;
  }

  return { projectsScanned: projects.length, alertsSent, suppressed };
}

async function sendHeartbeatAlertFor(
  project: ProjectHydrated,
  hours: number,
  now: Date,
  emailAllowedFor: (ownerId: string) => Promise<boolean>,
): Promise<boolean> {
  try {
    // Write the in-app alert row before attempting optional email delivery.
    try {
      await recordAlert({
        owner: String(project.owner),
        projectId: String(project._id),
        projectName: project.name,
        kind: 'heartbeat',
        severity: 'warning',
      });
    } catch (err) {
      logger.error(
        { err, projectId: String(project._id) },
        'heartbeat alert row persist failed',
      );
    }
    const user = await User.findById(project.owner);
    // Email alerts are a paid-plan feature — skip the send (as if no address)
    // for tiers without it. The stall is still recorded/deduped as handled.
    const allowed = await emailAllowedFor(String(project.owner));
    const email = allowed ? (user?.email ?? null) : null;
    const locale: SupportedLocale =
      (user?.language as SupportedLocale | null) ?? DEFAULT_LOCALE;

    if (email) {
      try {
        await deliverAlertEmail({
          email,
          kind: 'heartbeat',
          project: project.name,
          projectId: String(project._id),
          error: '',
          lastGoodAt: project.lastSuccessAt ?? null,
          hoursThreshold: hours,
          locale,
        });
      } catch (err) {
        logger.error(
          { err, projectId: String(project._id) },
          'heartbeat alert email failed',
        );
        return false;
      }
    }

    project.lastHeartbeatAlertAt = now;
    await project.save();
    return true;
  } catch (err) {
    logger.error(
      { err, projectId: String(project._id) },
      'heartbeat sweep: alert emit failed',
    );
    return false;
  }
}
