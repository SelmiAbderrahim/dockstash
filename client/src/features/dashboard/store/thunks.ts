import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { fetchUserRequest } from '../api';
import type { UserProfile } from '../types';

export const fetchUser = createAsyncThunk<UserProfile, string, { rejectValue: string }>(
  'dashboard/fetchUser',
  async (uid, { rejectWithValue }) => {
    try {
      const data = await fetchUserRequest(uid);
      return data.user;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load user.'));
    }
  },
);
