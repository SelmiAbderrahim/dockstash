import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { fetchUserRequest, updateProfileRequest } from '../api';
import type { UserProfile } from '../types';

export const fetchUser = createAsyncThunk<UserProfile, string, { rejectValue: string }>(
  'profile/fetchUser',
  async (uid, { rejectWithValue }) => {
    try {
      const data = await fetchUserRequest(uid);
      return data.user;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load profile.'));
    }
  },
);

export const saveProfile = createAsyncThunk<
  UserProfile,
  { uid: string; firstName: string; lastName: string },
  { rejectValue: string }
>('profile/saveProfile', async ({ uid, firstName, lastName }, { rejectWithValue }) => {
  try {
    const data = await updateProfileRequest(uid, { firstName, lastName });
    return data.user;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save profile.'));
  }
});
