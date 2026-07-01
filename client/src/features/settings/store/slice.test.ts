import { describe, expect, it } from 'vitest';
import { settingsReducer, clearError, resetSaveStatuses } from './slice';
import {
  fetchStorage,
  saveStorage,
  testStorage,
  fetchRetention,
  saveRetention,
  savePassword,
} from './thunks';

const initial = () => settingsReducer(undefined, { type: 'unknown' });

describe('settings slice', () => {
  it('fetchStorage lifecycle', () => {
    let s = settingsReducer(initial(), { type: fetchStorage.pending.type });
    expect(s.storageStatus).toBe('loading');
    s = settingsReducer(s, {
      type: fetchStorage.fulfilled.type,
      payload: { host: 'h', user: 'u', port: 22, configured: true },
    });
    expect(s.storageStatus).toBe('succeeded');
    expect(s.storage?.host).toBe('h');
  });

  it('saveStorage stores config; setup no longer needed', () => {
    let s = settingsReducer(initial(), {
      type: fetchStorage.fulfilled.type,
      payload: { host: '', user: '', port: 22, configured: false },
    });
    s = settingsReducer(s, {
      type: saveStorage.fulfilled.type,
      payload: { host: 'x', user: 'root', port: 22, configured: true },
    });
    expect(s.storage?.configured).toBe(true);
    expect(s.storageSaveStatus).toBe('succeeded');
  });

  it('savePassword.fulfilled marks succeeded', () => {
    const s = settingsReducer(initial(), { type: savePassword.fulfilled.type, payload: true });
    expect(s.passwordSaveStatus).toBe('succeeded');
  });

  it('fetchStorage.rejected sets error, with payload and fallback', () => {
    let s = settingsReducer(initial(), { type: fetchStorage.rejected.type, payload: 'e' });
    expect(s.storageStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: fetchStorage.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load storage settings.');
  });

  it('saveStorage.pending/rejected', () => {
    let s = settingsReducer(initial(), { type: saveStorage.pending.type });
    expect(s.storageSaveStatus).toBe('loading');
    s = settingsReducer(initial(), { type: saveStorage.rejected.type, payload: 'e' });
    expect(s.storageSaveStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: saveStorage.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not save storage settings.');
  });

  it('testStorage lifecycle', () => {
    let s = settingsReducer(initial(), { type: testStorage.pending.type });
    expect(s.storageTestStatus).toBe('loading');
    s = settingsReducer(s, { type: testStorage.fulfilled.type });
    expect(s.storageTestStatus).toBe('succeeded');
    s = settingsReducer(initial(), { type: testStorage.rejected.type, payload: 'e' });
    expect(s.storageTestStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: testStorage.rejected.type, payload: undefined });
    expect(s.error).toBe('Storage connection failed.');
  });

  it('fetchRetention lifecycle', () => {
    let s = settingsReducer(initial(), { type: fetchRetention.pending.type });
    expect(s.retentionStatus).toBe('loading');
    s = settingsReducer(s, {
      type: fetchRetention.fulfilled.type,
      payload: { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 },
    });
    expect(s.retention?.keepDaily).toBe(1);
    s = settingsReducer(initial(), { type: fetchRetention.rejected.type, payload: 'e' });
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: fetchRetention.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load retention.');
  });

  it('saveRetention lifecycle', () => {
    let s = settingsReducer(initial(), { type: saveRetention.pending.type });
    expect(s.retentionSaveStatus).toBe('loading');
    s = settingsReducer(s, {
      type: saveRetention.fulfilled.type,
      payload: { keepDaily: 1, keepWeekly: 2, keepMonthly: 3 },
    });
    expect(s.retentionSaveStatus).toBe('succeeded');
    expect(s.retention?.keepWeekly).toBe(2);
    s = settingsReducer(initial(), { type: saveRetention.rejected.type, payload: 'e' });
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: saveRetention.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not save retention.');
  });

  it('savePassword.pending/rejected', () => {
    let s = settingsReducer(initial(), { type: savePassword.pending.type });
    expect(s.passwordSaveStatus).toBe('loading');
    s = settingsReducer(initial(), { type: savePassword.rejected.type, payload: 'e' });
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: savePassword.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not save password.');
  });

  it('clearError and resetSaveStatuses reducers', () => {
    let s = settingsReducer(initial(), { type: fetchStorage.rejected.type, payload: 'e' });
    s = settingsReducer(s, clearError());
    expect(s.error).toBeNull();

    s = settingsReducer(
      { ...initial(), storageSaveStatus: 'succeeded', retentionSaveStatus: 'failed', passwordSaveStatus: 'loading', storageTestStatus: 'succeeded' },
      resetSaveStatuses(),
    );
    expect(s.storageSaveStatus).toBe('idle');
    expect(s.retentionSaveStatus).toBe('idle');
    expect(s.passwordSaveStatus).toBe('idle');
    expect(s.storageTestStatus).toBe('idle');
  });
});
