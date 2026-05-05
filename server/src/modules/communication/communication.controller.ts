import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { contactFormSchema } from './communication.schema.js';
import { deliverContactForm } from './communication.service.js';

export const sendContactForm: RequestHandler = asyncHandler(async (req, res) => {
  const input = contactFormSchema.parse(req.body);
  await deliverContactForm(input);
  res.status(200).json({
    message: 'Your email has been sent. We will be in touch with you soon.',
  });
});
