export { communicationRouter } from './communication.routes.js';
export {
  deliverContactForm,
  deliverPasswordResetEmail,
  deliverVerificationEmail,
  deliverPasswordChangedEmail,
  deliverWelcomeEmail,
  deliverAlertEmail,
  type WelcomeEmailInput,
  type AlertEmailInput,
  type AlertKind,
} from './communication.service.js';
export {
  sendEmail,
  setResendTransport,
  getResendTransport,
  type EmailMessage,
  type EmailSendResult,
  type ResendTransport,
} from './mailers/resend.js';
