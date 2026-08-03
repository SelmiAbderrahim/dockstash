import { apiClient } from '@shared/api/client';
import type { FetchUserResponse, UpdateProfileResponse } from './types';

// Server mounts the users module at /api/users (users.routes.ts: GET /:userId, PATCH /:userId).
export const fetchUserRequest = (uid: string): Promise<FetchUserResponse> =>
  apiClient<FetchUserResponse>(`/users/${uid}`, { auth: true });

export const updateProfileRequest = (
  uid: string,
  input: { firstName: string; lastName: string },
): Promise<UpdateProfileResponse> =>
  apiClient<UpdateProfileResponse>(`/users/${uid}`, {
    method: 'PATCH',
    auth: true,
    body: input,
  });
