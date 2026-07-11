import { sendEmail } from './mailers/resend.js';
import type { ContactFormInput } from './communication.schema.js';
import {
  translate,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '../../shared/i18n/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

const CONTACT_FORM_FALLBACK = 'you@example.com';

/** Contact-form recipient: `CONTACT_RECIPIENT` env, with a loud fallback. */
export function contactFormRecipient(): string {
  if (env.CONTACT_RECIPIENT) return env.CONTACT_RECIPIENT;
  if (env.RESEND_API_KEY) {
    logger.warn(
      'CONTACT_RECIPIENT is unset — contact-form mail goes to the placeholder address',
    );
  }
  return CONTACT_FORM_FALLBACK;
}

function normalizedClientUrl(): string {
  return env.CLIENT_URL.replace(/\/$/, '');
}

export async function deliverContactForm(input: ContactFormInput): Promise<void> {
  // The `from` MUST be our own verified sender (env RESEND_FROM, applied by the
  // transport when `from` is omitted) — never the submitter's address, which is
  // attacker-controlled and would let anyone spoof the From of support mail.
  // The submitter's identity rides in `replyTo` + the body so replies still work.
  await sendEmail({
    to: contactFormRecipient(),
    replyTo: input.email,
    subject: input.subject,
    text: `From: ${input.firstName} ${input.lastName} <${input.email}>\n\n${input.message}`,
  });
}

export async function deliverPasswordResetEmail(
  email: string,
  resetUrl: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: translate(locale, 'email.passwordReset.subject'),
    text: translate(locale, 'email.passwordReset.body', { resetUrl }),
  });
}

export async function deliverVerificationEmail(
  email: string,
  verifyUrl: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: translate(locale, 'email.verifyEmail.subject'),
    text: translate(locale, 'email.verifyEmail.body', { verifyUrl }),
  });
}

export async function deliverPasswordChangedEmail(
  email: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: translate(locale, 'email.passwordChanged.subject'),
    text: translate(locale, 'email.passwordChanged.body'),
  });
}

export async function deliverLoginOtpEmail(
  email: string,
  code: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<void> {
  await sendEmail({
    to: email,
    subject: translate(locale, 'email.loginOtp.subject'),
    text: translate(locale, 'email.loginOtp.body', { code, minutes: 10 }),
  });
}

export interface WelcomeEmailInput {
  email: string;
  name: string;
  locale?: SupportedLocale;
}

export async function deliverWelcomeEmail(input: WelcomeEmailInput): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  await sendEmail({
    to: input.email,
    subject: translate(locale, 'email.welcome.subject'),
    text: translate(locale, 'email.welcome.body', {
      name: input.name,
      clientUrl: normalizedClientUrl(),
    }),
  });
}

export interface PaymentReceiptInput {
  email: string;
  amount: string;
  plan: string;
  locale?: SupportedLocale;
}

export async function deliverPaymentReceiptEmail(
  input: PaymentReceiptInput,
): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  await sendEmail({
    to: input.email,
    subject: translate(locale, 'email.paymentReceipt.subject'),
    text: translate(locale, 'email.paymentReceipt.body', {
      amount: input.amount,
      plan: input.plan,
      clientUrl: normalizedClientUrl(),
    }),
  });
}

export interface DunningInput {
  email: string;
  plan: string;
  graceEndsAt: string;
  locale?: SupportedLocale;
}

export async function deliverDunningEmail(input: DunningInput): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  await sendEmail({
    to: input.email,
    subject: translate(locale, 'email.dunning.subject'),
    text: translate(locale, 'email.dunning.body', {
      plan: input.plan,
      graceEndsAt: input.graceEndsAt,
      clientUrl: normalizedClientUrl(),
    }),
  });
}

export interface PlanChangeEmailInput {
  email: string;
  plan: string;
  locale?: SupportedLocale;
}

/**
 * Grace-window expiry notice: the paid plan lapsed and the account dropped to
 * Free. Backups are retained (read-only) — the body reassures + points to
 * billing to re-upgrade. (prompt 13 / F3)
 */
export async function deliverDowngradeNoticeEmail(
  input: PlanChangeEmailInput,
): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  await sendEmail({
    to: input.email,
    subject: translate(locale, 'email.downgradeNotice.subject'),
    text: translate(locale, 'email.downgradeNotice.body', {
      plan: input.plan,
      clientUrl: normalizedClientUrl(),
    }),
  });
}

/**
 * Reactivation notice: a lapsed/past-due subscription recovered to active —
 * paused projects are back online. (prompt 13 / F3)
 */
export async function deliverReactivationEmail(
  input: PlanChangeEmailInput,
): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  await sendEmail({
    to: input.email,
    subject: translate(locale, 'email.reactivation.subject'),
    text: translate(locale, 'email.reactivation.body', {
      plan: input.plan,
      clientUrl: normalizedClientUrl(),
    }),
  });
}

export interface InvitationClaimedInput {
  claimantEmail: string;
  claimantName: string;
  plan: string;
  grantDuration: string;
  claimedAt: string;
  currentPeriodEnd: string;
  label: string;
}

/**
 * Operator notification: someone activated an invitation link. Goes to
 * `CONTACT_RECIPIENT` — never to the claimant. Silent skip when no operator
 * inbox is configured; `sendEmail` additionally skips (and never throws) when
 * Resend is unconfigured, so a claim never fails on mail.
 */
export async function deliverInvitationClaimedEmail(
  input: InvitationClaimedInput,
): Promise<void> {
  if (!env.CONTACT_RECIPIENT) return;
  const vars = {
    claimantName: input.claimantName,
    claimantEmail: input.claimantEmail,
    plan: input.plan,
    grantDuration: input.grantDuration,
    claimedAt: input.claimedAt,
    currentPeriodEnd: input.currentPeriodEnd,
    label: input.label,
    invitationsUrl: `${normalizedClientUrl()}/superadmin?tab=invitations`,
  };
  await sendEmail({
    to: env.CONTACT_RECIPIENT,
    subject: translate(DEFAULT_LOCALE, 'email.inviteClaimed.subject', vars),
    text: translate(DEFAULT_LOCALE, 'email.inviteClaimed.body', vars),
  });
}

export type AlertKind = 'backup' | 'restore' | 'drill' | 'mirror' | 'heartbeat';

export interface AlertEmailInput {
  email: string;
  kind: AlertKind;
  project: string;
  projectId: string;
  error: string;
  lastGoodAt: Date | null;
  failedAt?: Date;
  hoursThreshold?: number;
  locale?: SupportedLocale;
}

/**
 * `neverRun` — the recipient-locale word for "no successful run yet". Used by
 * the alert renderer when `lastGoodAt` is null.
 */
function renderLastGoodAt(locale: SupportedLocale, lastGoodAt: Date | null): string {
  if (!lastGoodAt) return translate(locale, 'email.neverRun');
  return lastGoodAt.toISOString();
}

function subjectKeyFor(kind: AlertKind): string {
  switch (kind) {
    case 'backup':
      return 'email.backupFailure.subject';
    case 'restore':
      return 'email.restoreFailure.subject';
    case 'drill':
      return 'email.drillFailure.subject';
    case 'mirror':
      return 'email.mirrorFailure.subject';
    case 'heartbeat':
      return 'email.heartbeatMiss.subject';
  }
}

function bodyKeyFor(kind: AlertKind): string {
  switch (kind) {
    case 'backup':
      return 'email.backupFailure.body';
    case 'restore':
      return 'email.restoreFailure.body';
    case 'drill':
      return 'email.drillFailure.body';
    case 'mirror':
      return 'email.mirrorFailure.body';
    case 'heartbeat':
      return 'email.heartbeatMiss.body';
  }
}

export async function deliverAlertEmail(input: AlertEmailInput): Promise<void> {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const failedAt = (input.failedAt ?? new Date()).toISOString();
  const lastGoodAt = renderLastGoodAt(locale, input.lastGoodAt);
  const vars = {
    project: input.project,
    projectId: input.projectId,
    error: input.error,
    failedAt,
    lastGoodAt,
    hours: input.hoursThreshold ?? '',
    clientUrl: normalizedClientUrl(),
  };
  await sendEmail({
    to: input.email,
    subject: translate(locale, subjectKeyFor(input.kind), vars),
    text: translate(locale, bodyKeyFor(input.kind), vars),
  });
}
