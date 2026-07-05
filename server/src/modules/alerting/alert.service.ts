import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { DEFAULT_LOCALE, type SupportedLocale } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import { User } from '../users/users.model.js';
import { isEmailAlertsAllowed } from '../billing/entitlements.service.js';
import { deliverAlertEmail, type AlertKind } from '../communication/index.js';
import { recordAlert } from '../health/index.js';

export type FailureKind = Exclude<AlertKind, 'heartbeat'>;

export interface FailureAlertInput {
  projectId: string;
  kind: FailureKind;
  error: string;
  failedAt?: Date;
}

export interface FailureAlertDeps {
  webhookPoster?: (payload: AlertWebhookPayload, url: string) => Promise<void>;
  /** Plan gate for email + per-project webhook — defaults to billing. */
  emailAllowedFor?: (ownerId: string) => Promise<boolean>;
}

export interface AlertWebhookPayload {
  kind: FailureKind | 'heartbeat';
  projectId: string;
  project: string;
  error: string;
  lastGoodAt: string | null;
  failedAt: string;
}

async function defaultWebhookPoster(
  payload: AlertWebhookPayload,
  url: string,
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    logger.error(
      { status: response.status, body, projectId: payload.projectId },
      'alert webhook POST failed',
    );
  }
}

async function loadOwnerLocale(ownerId: string): Promise<{
  email: string | null;
  locale: SupportedLocale;
}> {
  const user = await User.findById(ownerId);
  if (!user) return { email: null, locale: DEFAULT_LOCALE };
  const locale = (user.language as SupportedLocale | null) ?? DEFAULT_LOCALE;
  return { email: user.email, locale };
}

/**
 * Send a failure alert. Best-effort: any transport/webhook failure is logged
 * and swallowed so the orchestrator never crashes on an alert send.
 */
export async function sendFailureAlert(
  input: FailureAlertInput,
  deps: FailureAlertDeps = {},
): Promise<void> {
  const failedAt = input.failedAt ?? new Date();
  try {
    const project = await Project.findById(input.projectId);
    if (!project) {
      logger.warn(
        { projectId: input.projectId, kind: input.kind },
        'alert.sendFailureAlert: project not found',
      );
      return;
    }
    const { email, locale } = await loadOwnerLocale(String(project.owner));
    // Outbound channels (email + per-project webhook) are paid-plan features;
    // the operator-level env webhook and the in-app alert row are not gated.
    const paidAlertsAllowed = await (deps.emailAllowedFor ?? isEmailAlertsAllowed)(
      String(project.owner),
    );
    const emailAllowed = email !== null && paidAlertsAllowed;
    const lastGoodAt = project.lastSuccessAt ?? null;

    // In-app alert row — always written, never fails the job path.
    try {
      await recordAlert({
        owner: String(project.owner),
        projectId: String(project._id),
        projectName: project.name,
        kind: input.kind,
        severity: 'critical',
        error: input.error,
      });
    } catch (err) {
      logger.error(
        { err, projectId: input.projectId, kind: input.kind },
        'alert row persist failed',
      );
    }
    const webhookPayload: AlertWebhookPayload = {
      kind: input.kind,
      projectId: String(project._id),
      project: project.name,
      error: input.error,
      lastGoodAt: lastGoodAt ? lastGoodAt.toISOString() : null,
      failedAt: failedAt.toISOString(),
    };

    if (email && emailAllowed) {
      try {
        await deliverAlertEmail({
          email,
          kind: input.kind,
          project: project.name,
          projectId: String(project._id),
          error: input.error,
          lastGoodAt,
          failedAt,
          locale,
        });
      } catch (err) {
        logger.error(
          { err, projectId: input.projectId, kind: input.kind },
          'alert email failed',
        );
      }
    }

    // Webhook fan-out: the per-project URL (Pro+) plus the operator-level env
    // target. Deduped so the same URL is never posted twice.
    const webhookTargets = new Set<string>();
    if (project.alertWebhookUrl && paidAlertsAllowed) {
      webhookTargets.add(project.alertWebhookUrl);
    }
    if (env.ALERT_WEBHOOK_URL) webhookTargets.add(env.ALERT_WEBHOOK_URL);
    const poster = deps.webhookPoster ?? defaultWebhookPoster;
    for (const url of webhookTargets) {
      try {
        await poster(webhookPayload, url);
      } catch (err) {
        logger.error(
          { err, projectId: input.projectId, kind: input.kind },
          'alert webhook failed',
        );
      }
    }
  } catch (err) {
    logger.error(
      { err, projectId: input.projectId, kind: input.kind },
      'alert.sendFailureAlert unexpected failure',
    );
  }
}
