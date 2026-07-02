import { describe, expect, it } from 'vitest';
import { settingsReducer, clearError, resetSaveStatuses } from './slice';
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

  it('exportConfig lifecycle', () => {
    let s = settingsReducer(initial(), { type: exportConfig.pending.type });
    expect(s.exportStatus).toBe('loading');
    s = settingsReducer(s, { type: exportConfig.fulfilled.type, payload: true });
    expect(s.exportStatus).toBe('succeeded');
    s = settingsReducer(initial(), { type: exportConfig.rejected.type, payload: 'e' });
    expect(s.exportStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: exportConfig.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not export configuration.');
  });

  it('generateRecoveryCodes lifecycle', () => {
    let s = settingsReducer(initial(), { type: generateRecoveryCodes.pending.type });
    expect(s.recoveryCodesStatus).toBe('loading');
    s = settingsReducer(s, {
      type: generateRecoveryCodes.fulfilled.type,
      payload: { message: 'saved once', codes: ['AAAA-1111'] },
    });
    expect(s.recoveryCodesStatus).toBe('succeeded');
    expect(s.recoveryCodes?.codes).toEqual(['AAAA-1111']);
    s = settingsReducer(initial(), { type: generateRecoveryCodes.rejected.type, payload: 'e' });
    expect(s.recoveryCodesStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), {
      type: generateRecoveryCodes.rejected.type,
      payload: undefined,
    });
    expect(s.error).toBe('Could not generate recovery codes.');
  });

  it('triggerSelfBackup lifecycle', () => {
    let s = settingsReducer(initial(), { type: triggerSelfBackup.pending.type });
    expect(s.selfBackupTriggerStatus).toBe('loading');
    s = settingsReducer(s, { type: triggerSelfBackup.fulfilled.type, payload: true });
    expect(s.selfBackupTriggerStatus).toBe('succeeded');
    s = settingsReducer(initial(), { type: triggerSelfBackup.rejected.type, payload: 'e' });
    expect(s.selfBackupTriggerStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), { type: triggerSelfBackup.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not trigger self-backup.');
  });

  it('fetchSelfBackupRuns lifecycle', () => {
    let s = settingsReducer(initial(), { type: fetchSelfBackupRuns.pending.type });
    expect(s.selfBackupRunsStatus).toBe('loading');
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
    s = settingsReducer(s, { type: fetchSelfBackupRuns.fulfilled.type, payload: runs });
    expect(s.selfBackupRunsStatus).toBe('succeeded');
    expect(s.selfBackupRuns).toEqual(runs);
    s = settingsReducer(initial(), { type: fetchSelfBackupRuns.rejected.type, payload: 'e' });
    expect(s.selfBackupRunsStatus).toBe('failed');
    expect(s.error).toBe('e');
    s = settingsReducer(initial(), {
      type: fetchSelfBackupRuns.rejected.type,
      payload: undefined,
    });
    expect(s.error).toBe('Could not load self-backup runs.');
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
