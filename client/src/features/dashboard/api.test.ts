import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import { fetchUserRequest } from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.mockResolvedValue({ user: { email: 'a@b.co' } } as never);
});

describe('dashboard api', () => {
  it('fetchUserRequest GETs the authenticated user path', async () => {
    const result = await fetchUserRequest('u-9');
    expect(apiClient).toHaveBeenCalledWith('/user/u-9', { auth: true });
    expect(result).toEqual({ user: { email: 'a@b.co' } });
  });
});
