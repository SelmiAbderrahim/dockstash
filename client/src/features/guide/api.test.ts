import { describe, expect, it, vi } from 'vitest';
import { apiClient } from '@shared/api/client';
import { updateGuidePreferenceRequest } from './api';

vi.mock('@shared/api/client', () => ({
  apiClient: vi.fn(() => Promise.resolve({ user: { id: 'u1', guideMe: false } })),
}));

describe('updateGuidePreferenceRequest', () => {
  it('PATCHes the preferences endpoint with auth', async () => {
    const result = await updateGuidePreferenceRequest('u1', false);
    expect(apiClient).toHaveBeenCalledWith('/users/u1/preferences', {
      method: 'PATCH',
      auth: true,
      body: { guideMe: false },
    });
    expect(result.user.guideMe).toBe(false);
  });
});
