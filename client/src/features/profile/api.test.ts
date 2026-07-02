import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import { fetchUserRequest, updateProfileRequest } from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.mockResolvedValue({ user: { email: 'a@b.co' } } as never);
});

describe('profile api', () => {
  it('fetchUserRequest GETs the authenticated user path', async () => {
    const result = await fetchUserRequest('u-9');
    expect(apiClient).toHaveBeenCalledWith('/users/u-9', { auth: true });
    expect(result).toEqual({ user: { email: 'a@b.co' } });
  });

  it('updateProfileRequest PATCHes the authenticated user path with the name fields', async () => {
    const result = await updateProfileRequest('u-9', { firstName: 'A', lastName: 'B' });
    expect(apiClient).toHaveBeenCalledWith('/users/u-9', {
      method: 'PATCH',
      auth: true,
      body: { firstName: 'A', lastName: 'B' },
    });
    expect(result).toEqual({ user: { email: 'a@b.co' } });
  });
});
