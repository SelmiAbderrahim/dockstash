import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { settingsReducer } from './slice';
import {
  fetchStorage,
  saveStorage,
  testStorage,
  fetchRetention,
  saveRetention,
  savePassword,
  exportConfig,
  generateRecoveryCodes,
  triggerSelfBackup,
  fetchSelfBackupRuns,
} from './thunks';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchStorageRequest: vi.fn(),
  saveStorageRequest: vi.fn(),
  testStorageRequest: vi.fn(),
  fetchRetentionRequest: vi.fn(),
  saveRetentionRequest: vi.fn(),
  savePasswordRequest: vi.fn(),
  exportConfigRequest: vi.fn(),
  downloadJsonExport: vi.fn(),
  generateRecoveryCodesRequest: vi.fn(),
  triggerSelfBackupRequest: vi.fn(),
  fetchSelfBackupRunsRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { settings: settingsReducer } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('settings thunks', () => {
  it('fetchStorage resolves and rejects', async () => {
    const cfg = { host: 'h', user: 'u', port: 22, configured: true };
    mocked.fetchStorageRequest.mockResolvedValue(cfg);
    const store = makeStore();
    const ok = await store.dispatch(fetchStorage());
    expect(fetchStorage.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(cfg);

    mocked.fetchStorageRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(fetchStorage());
    expect(fetchStorage.rejected.match(bad)).toBe(true);
    expect(typeof bad.payload).toBe('string');
  });

  it('saveStorage resolves and rejects', async () => {
    const cfg = { host: 'x', user: 'root', port: 22, configured: true };
    mocked.saveStorageRequest.mockResolvedValue(cfg);
    const store = makeStore();
    const input = { host: 'x', user: 'root', port: 22, privateKey: 'k' };
    const ok = await store.dispatch(saveStorage(input));
    expect(saveStorage.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(cfg);

    mocked.saveStorageRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(saveStorage(input));
    expect(saveStorage.rejected.match(bad)).toBe(true);
  });

  it('testStorage resolves true and rejects', async () => {
    mocked.testStorageRequest.mockResolvedValue({ ok: true });
    const store = makeStore();
    const ok = await store.dispatch(testStorage());
    expect(testStorage.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(true);

    mocked.testStorageRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(testStorage());
    expect(testStorage.rejected.match(bad)).toBe(true);
  });

  it('fetchRetention resolves and rejects', async () => {
    const policy = { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 };
    mocked.fetchRetentionRequest.mockResolvedValue(policy);
    const store = makeStore();
    const ok = await store.dispatch(fetchRetention());
    expect(ok.payload).toBe(policy);

    mocked.fetchRetentionRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(fetchRetention());
    expect(fetchRetention.rejected.match(bad)).toBe(true);
  });

  it('saveRetention resolves and rejects', async () => {
    const policy = { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 };
    mocked.saveRetentionRequest.mockResolvedValue(policy);
    const store = makeStore();
    const ok = await store.dispatch(saveRetention(policy));
    expect(ok.payload).toBe(policy);

    mocked.saveRetentionRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(saveRetention(policy));
    expect(saveRetention.rejected.match(bad)).toBe(true);
  });

  it('savePassword resolves true and rejects', async () => {
    mocked.savePasswordRequest.mockResolvedValue({ ok: true });
    const store = makeStore();
    const ok = await store.dispatch(savePassword('secret'));
    expect(ok.payload).toBe(true);

    mocked.savePasswordRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(savePassword('secret'));
    expect(savePassword.rejected.match(bad)).toBe(true);
  });

  it('exportConfig downloads the envelope and resolves; rejects on failure', async () => {
    const envelope = { version: 1 };
    mocked.exportConfigRequest.mockResolvedValue(envelope);
    const store = makeStore();
    const ok = await store.dispatch(exportConfig());
    expect(exportConfig.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(true);
    expect(mocked.downloadJsonExport).toHaveBeenCalledWith(envelope);

    mocked.exportConfigRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(exportConfig());
    expect(exportConfig.rejected.match(bad)).toBe(true);
    expect(typeof bad.payload).toBe('string');
  });

  it('generateRecoveryCodes resolves and rejects', async () => {
    const payload = { message: 'saved once', codes: ['AAAA-1111'] };
    mocked.generateRecoveryCodesRequest.mockResolvedValue(payload);
    const store = makeStore();
    const ok = await store.dispatch(generateRecoveryCodes());
    expect(generateRecoveryCodes.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(payload);

    mocked.generateRecoveryCodesRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(generateRecoveryCodes());
    expect(generateRecoveryCodes.rejected.match(bad)).toBe(true);
  });

  it('triggerSelfBackup resolves true and rejects', async () => {
    mocked.triggerSelfBackupRequest.mockResolvedValue({ triggered: true });
    const store = makeStore();
    const ok = await store.dispatch(triggerSelfBackup());
    expect(triggerSelfBackup.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(true);

    mocked.triggerSelfBackupRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(triggerSelfBackup());
    expect(triggerSelfBackup.rejected.match(bad)).toBe(true);
  });

  it('fetchSelfBackupRuns resolves and rejects', async () => {
    const runs = [
      {
        id: 'r1',
        repo: 'dockstash-self',
        status: 'success',
        startedAt: null,
        finishedAt: null,
        error: '',
      },
    ];
    mocked.fetchSelfBackupRunsRequest.mockResolvedValue(runs);
    const store = makeStore();
    const ok = await store.dispatch(fetchSelfBackupRuns());
    expect(fetchSelfBackupRuns.fulfilled.match(ok)).toBe(true);
    expect(ok.payload).toBe(runs);

    mocked.fetchSelfBackupRunsRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(fetchSelfBackupRuns());
    expect(fetchSelfBackupRuns.rejected.match(bad)).toBe(true);
  });
});
