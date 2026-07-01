import { apiClient } from '@shared/api/client';
import type { FetchUserResponse } from './types';

// Server mounts the users module at /api/users (users.routes.ts: GET /:userId).
export const fetchUserRequest = (uid: string): Promise<FetchUserResponse> =>
  apiClient<FetchUserResponse>(`/users/${uid}`, { auth: true });
