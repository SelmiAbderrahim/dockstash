import { createAsyncThunk } from '@reduxjs/toolkit';
import { loadCookie, saveCookie } from '@shared/utils/cookies';
import { messageFromError } from '@shared/utils/errors';
import { updateGuidePreferenceRequest } from '../api';

interface StoredUser {
  _id?: string;
  id?: string;
  guideMe?: boolean;
  [key: string]: unknown;
}

export const setGuideMe = createAsyncThunk<boolean, boolean, { rejectValue: string }>(
  'guide/setGuideMe',
  async (guideMe, { rejectWithValue }) => {
    const user = loadCookie<StoredUser>('user');
    const userId = user?.id ?? user?._id;
    if (!user || !userId) {
      return rejectWithValue('Could not update the guide preference.');
    }
    try {
      await updateGuidePreferenceRequest(userId, guideMe);
      saveCookie('user', { ...user, guideMe }, { path: '/' });
      return guideMe;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not update the guide preference.'));
    }
  },
);
