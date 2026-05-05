import { apiClient } from '@shared/api/client';
import type { ContactFormBody, ContactFormResponse } from './types';

export const sendContactRequest = (body: ContactFormBody): Promise<ContactFormResponse> =>
  apiClient<ContactFormResponse>('/communication/contact', { method: 'POST', body });
