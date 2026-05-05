import { apiClient } from '@shared/api/client';
import type { FetchUserResponse } from './types';

export const fetchUserRequest = (uid: string): Promise<FetchUserResponse> =>
  apiClient<FetchUserResponse>(`/user/${uid}`, { auth: true });
