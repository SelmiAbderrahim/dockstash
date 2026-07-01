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
} from './thunks';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchStorageRequest: vi.fn(),
  saveStorageRequest: vi.fn(),
  testStorageRequest: vi.fn(),
  fetchRetentionRequest: vi.fn(),
  saveRetentionRequest: vi.fn(),
  savePasswordRequest: vi.fn(),
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
});
