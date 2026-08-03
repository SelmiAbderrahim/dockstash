/**
 * @deprecated Mailgun transport was replaced by Resend in prompt 08. This file
 * is a thin re-export of the Resend transport for any lingering import path;
 * new code MUST import from `./resend.js` directly.
 */
export { sendEmail, setResendTransport, getResendTransport } from './resend.js';
export type { EmailMessage, EmailSendResult, ResendTransport } from './resend.js';
