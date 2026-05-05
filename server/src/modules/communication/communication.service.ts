import { sendEmail } from './mailers/mailgun.js';
import type { ContactFormInput } from './communication.schema.js';

const CONTACT_FORM_RECIPIENT = 'you@example.com';

export async function deliverContactForm(input: ContactFormInput): Promise<void> {
  await sendEmail({
    from: `${input.firstName} ${input.lastName} <${input.email}>`,
    to: CONTACT_FORM_RECIPIENT,
    subject: input.subject,
    text: input.message,
  });
}

export async function deliverPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Reset Password',
    text:
      'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
      `Please click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}\n\n` +
      'If you did not request this, please ignore this email and your password will remain unchanged.\n',
  });
}

export async function deliverPasswordChangedEmail(email: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Password Changed',
    text:
      'You are receiving this email because you changed your password.\n\n' +
      'If you did not request this change, please contact us immediately.',
  });
}
