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
  exportConfigRequest,
  downloadJsonExport,
  generateRecoveryCodesRequest,
  triggerSelfBackupRequest,
  fetchSelfBackupRunsRequest,
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

  it('exportConfigRequest POSTs to the export endpoint', async () => {
    apiClient.mockResolvedValue({ version: 1 } as never);
    const result = await exportConfigRequest();
    expect(apiClient).toHaveBeenCalledWith('/recovery/export', { method: 'POST', auth: true });
    expect(result).toEqual({ version: 1 });
  });

  it('generateRecoveryCodesRequest POSTs and returns the codes payload', async () => {
    const payload = { message: 'saved once', codes: ['AAAA-1111', 'BBBB-2222'] };
    apiClient.mockResolvedValue(payload as never);
    const result = await generateRecoveryCodesRequest();
    expect(apiClient).toHaveBeenCalledWith('/recovery/recovery-codes', {
      method: 'POST',
      auth: true,
    });
    expect(result).toBe(payload);
  });

  it('triggerSelfBackupRequest POSTs to the self-backup endpoint', async () => {
    apiClient.mockResolvedValue({ triggered: true } as never);
    const result = await triggerSelfBackupRequest();
    expect(apiClient).toHaveBeenCalledWith('/recovery/self-backup', {
      method: 'POST',
      auth: true,
    });
    expect(result).toEqual({ triggered: true });
  });

  it('fetchSelfBackupRunsRequest unwraps runs', async () => {
    const runs = [
      {
        id: 'r1',
        repo: 'dockstash-self',
        status: 'success',
        startedAt: '2026-07-01T00:00:00.000Z',
        finishedAt: '2026-07-01T00:01:00.000Z',
        error: '',
      },
    ];
    apiClient.mockResolvedValue({ runs } as never);
    const result = await fetchSelfBackupRunsRequest();
    expect(apiClient).toHaveBeenCalledWith('/recovery/self-backup', { auth: true });
    expect(result).toBe(runs);
  });
});

describe('downloadJsonExport', () => {
  it('creates a dated JSON blob download and clicks it', async () => {
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    let clickedDownload = '';
    let clickedHref = '';
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
        clickedHref = this.href;
      });

    downloadJsonExport({ a: 1 }, new Date('2026-07-02T10:20:30.000Z'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0]?.[0] as unknown as Blob;
    expect(blob.type).toBe('application/json');
    // jsdom's Blob has no .text(); read it through FileReader instead.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob);
    });
    expect(text).toBe(JSON.stringify({ a: 1 }, null, 2));
    expect(clickedDownload).toBe('dockstash-export-2026-07-02.json');
    expect(clickedHref).toBe('blob:mock-url');
    // The temporary anchor is removed again after the click.
    expect(document.body.querySelector('a')).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

    // Default `now` covers the current date.
    downloadJsonExport({ b: 2 });
    expect(clickedDownload).toMatch(/^dockstash-export-\d{4}-\d{2}-\d{2}\.json$/);

    click.mockRestore();
  });
});
