import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';

/**
 * Neutral message shape used by every caller. Kept identical to the shape the
 * Mailgun transport exposed so the swap is invisible above this file.
 */
export type EmailMessage = {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
};

export type EmailSendResult = { delivered: boolean };

/**
 * Injection seam. Tests replace this via `setResendTransport()` to observe
 * outbound calls without hitting the network.
 */
export type ResendTransport = (
  message: EmailMessage,
  from: string,
  apiKey: string,
) => Promise<EmailSendResult>;

const RESEND_API_URL = 'https://api.resend.com/emails';

const httpTransport: ResendTransport = async (message, from, apiKey) => {
  const body: Record<string, unknown> = {
    from: message.from ?? from,
    to: [message.to],
    subject: message.subject,
    text: message.text,
  };
  if (message.replyTo) body.reply_to = message.replyTo;
  if (message.html) body.html = message.html;

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.error(
      { status: response.status, body: text, to: message.to, subject: message.subject },
      'resend send failed',
    );
    return { delivered: false };
  }
  return { delivered: true };
};

let activeTransport: ResendTransport = httpTransport;

export function setResendTransport(transport: ResendTransport | null): void {
  activeTransport = transport ?? httpTransport;
}

export function getResendTransport(): ResendTransport {
  return activeTransport;
}

/**
 * Send an email via Resend. When RESEND_API_KEY / RESEND_FROM are unset (Free /
 * self-host), we skip the send and return `{ delivered: false }` so the caller
 * never crashes on the missing-config case. Errors from the transport surface
 * as a logged failure — they never throw at the caller.
 */
export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    logger.warn(
      { to: message.to, subject: message.subject },
      'resend is not configured; skipping email send',
    );
    return { delivered: false };
  }
  try {
    return await activeTransport(message, env.RESEND_FROM, env.RESEND_API_KEY);
  } catch (err) {
    logger.error(
      { err, to: message.to, subject: message.subject },
      'resend transport threw',
    );
    return { delivered: false };
  }
}
