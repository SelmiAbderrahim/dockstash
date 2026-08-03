import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { env } from '../../config/env.js';
import { exportUserData, scheduleAccountDeletion, type PurgeQueue, type WarningMailer } from './legal.service.js';

// The purge queue + warning mailer are injectable so tests + wiring do not
// pull the whole scheduler/communication modules into unit tests. Production
// wiring calls `configureLegalController` at boot.
let queue: PurgeQueue | null = null;
let mailer: WarningMailer | null = null;

export interface ConfigureLegalControllerDeps {
  queue: PurgeQueue;
  mailer?: WarningMailer;
}

export function configureLegalController(deps: ConfigureLegalControllerDeps): void {
  queue = deps.queue;
  mailer = deps.mailer ?? null;
}

export function resetLegalController(): void {
  queue = null;
  mailer = null;
}

export const exportMyData: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw HttpError.unauthorized(req.t?.('errors.unauthorized'));
  const data = await exportUserData(req.user.id, { t: req.t });
  res.status(200).json(data);
});

export const deleteMyAccount: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw HttpError.unauthorized(req.t?.('errors.unauthorized'));
  if (!queue) {
    throw HttpError.internal(
      req.t?.('security.deletion.notConfigured') ?? 'Deletion queue is not configured.',
    );
  }
  const result = await scheduleAccountDeletion(req.user.id, {
    t: req.t,
    graceHours: env.ACCOUNT_DELETION_GRACE_HOURS,
    queue,
    mailer: mailer ?? undefined,
    locale: req.language,
  });
  res.status(202).json(result);
});
