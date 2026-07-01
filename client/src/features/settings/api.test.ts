import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import { ApiError } from '@shared/api/client';
import {
  fetchStorageRequest,
  saveStorageRequest,
  testStorageRequest,
  fetchRetentionRequest,
  saveRetentionRequest,
  savePasswordRequest,
} from './api';

vi.mock('@shared/api/client', async () => {
  const actual = await vi.importActual<typeof import('@shared/api/client')>('@shared/api/client');
  return { ...actual, apiClient: vi.fn() };
});
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('settings api wrappers', () => {
  it('fetchStorageRequest unwraps storage', async () => {
    const storage = { host: 'h', user: 'u', port: 22, configured: true };
    apiClient.mockResolvedValue({ storage } as never);
    const result = await fetchStorageRequest();
    expect(apiClient).toHaveBeenCalledWith('/settings/storage', { auth: true });
    expect(result).toBe(storage);
  });

  it('fetchStorageRequest treats a 404 as unconfigured', async () => {
    apiClient.mockRejectedValue(new ApiError('not found', 404, null));
    const result = await fetchStorageRequest();
    expect(result).toEqual({ host: '', user: '', port: 22, configured: false });
  });

  it('fetchStorageRequest rethrows non-404 errors', async () => {
    apiClient.mockRejectedValue(new ApiError('server', 500, null));
    await expect(fetchStorageRequest()).rejects.toBeInstanceOf(ApiError);
  });

  it('fetchStorageRequest rethrows non-ApiError errors', async () => {
    apiClient.mockRejectedValue(new Error('boom'));
    await expect(fetchStorageRequest()).rejects.toThrow('boom');
  });

  it('saveStorageRequest PUTs the input and unwraps storage', async () => {
    const storage = { host: 'x', user: 'root', port: 22, configured: true };
    apiClient.mockResolvedValue({ storage } as never);
    const input = { host: 'x', user: 'root', port: 22, privateKey: 'k' };
    const result = await saveStorageRequest(input);
    expect(apiClient).toHaveBeenCalledWith('/settings/storage', {
      method: 'PUT',
      auth: true,
      body: input,
    });
    expect(result).toBe(storage);
  });

  it('testStorageRequest posts to the test path', async () => {
    apiClient.mockResolvedValue({ ok: true } as never);
    const result = await testStorageRequest();
    expect(apiClient).toHaveBeenCalledWith('/settings/storage/test', {
      method: 'POST',
      auth: true,
    });
    expect(result).toEqual({ ok: true });
  });

  it('fetchRetentionRequest unwraps retention', async () => {
    const retention = { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 };
    apiClient.mockResolvedValue({ retention } as never);
    const result = await fetchRetentionRequest();
    expect(apiClient).toHaveBeenCalledWith('/settings/retention', { auth: true });
    expect(result).toBe(retention);
  });

  it('fetchRetentionRequest returns defaults on 404', async () => {
    apiClient.mockRejectedValue(new ApiError('nf', 404, null));
    const result = await fetchRetentionRequest();
    expect(result).toEqual({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 });
  });

  it('fetchRetentionRequest rethrows non-404 errors', async () => {
    apiClient.mockRejectedValue(new ApiError('server', 500, null));
    await expect(fetchRetentionRequest()).rejects.toBeInstanceOf(ApiError);
  });

  it('saveRetentionRequest PUTs the policy and unwraps retention', async () => {
    const retention = { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 };
    apiClient.mockResolvedValue({ retention } as never);
    const result = await saveRetentionRequest(retention);
    expect(apiClient).toHaveBeenCalledWith('/settings/retention', {
      method: 'PUT',
      auth: true,
      body: retention,
    });
    expect(result).toBe(retention);
  });

  it('savePasswordRequest PUTs the password', async () => {
    apiClient.mockResolvedValue({ ok: true } as never);
    const result = await savePasswordRequest('secret');
    expect(apiClient).toHaveBeenCalledWith('/settings/encryption-password', {
      method: 'PUT',
      auth: true,
      body: { password: 'secret' },
    });
    expect(result).toEqual({ ok: true });
  });
});
