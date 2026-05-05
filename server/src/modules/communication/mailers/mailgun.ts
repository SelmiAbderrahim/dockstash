import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

export type EmailMessage = {
  to: string;
  from?: string;
  subject: string;
  text: string;
};

const MAILGUN_API_BASE = 'https://api.mailgun.net/v3';
const DEFAULT_FROM = 'no-reply@example.com';

export async function sendEmail(message: EmailMessage): Promise<{ delivered: boolean }> {
  if (!env.MAILGUN_PRIVATE_KEY || !env.MAILGUN_DOMAIN) {
    logger.warn(
      { to: message.to, subject: message.subject },
      'mailgun is not configured; skipping email send',
    );
    return { delivered: false };
  }

  const auth = Buffer.from(`api:${env.MAILGUN_PRIVATE_KEY}`).toString('base64');
  const body = new URLSearchParams({
    from: message.from ?? DEFAULT_FROM,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });

  const response = await fetch(`${MAILGUN_API_BASE}/${env.MAILGUN_DOMAIN}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(
      { status: response.status, body: text, to: message.to },
      'mailgun send failed',
    );
    return { delivered: false };
  }

  return { delivered: true };
}
