import { z } from 'zod';

export const contactFormSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  subject: z.string().min(1),
  message: z.string().min(1),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;
