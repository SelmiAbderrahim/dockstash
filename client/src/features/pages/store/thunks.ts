import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { sendContactRequest } from '../api';
import type { ContactFormBody } from '../types';

export const sendContactForm = createAsyncThunk<string, ContactFormBody, { rejectValue: string }>(
  'pages/sendContactForm',
  async (body, { rejectWithValue }) => {
    try {
      const data = await sendContactRequest(body);
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not send contact form.'));
    }
  },
);
