export { communicationRouter } from './communication.routes.js';
export {
  deliverContactForm,
  deliverPasswordResetEmail,
  deliverPasswordChangedEmail,
} from './communication.service.js';
export { sendEmail, type EmailMessage } from './mailers/mailgun.js';
