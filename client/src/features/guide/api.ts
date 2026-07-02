import { apiClient } from '@shared/api/client';

export interface GuidePreferenceResponse {
  user: { id: string; guideMe: boolean };
}

export const updateGuidePreferenceRequest = (
  userId: string,
  guideMe: boolean,
): Promise<GuidePreferenceResponse> =>
  apiClient<GuidePreferenceResponse>(`/users/${userId}/preferences`, {
    method: 'PATCH',
    auth: true,
    body: { guideMe },
  });
