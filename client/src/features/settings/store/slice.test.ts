import { describe, expect, it } from 'vitest';
import { settingsReducer } from './slice';
import { fetchStorage, saveStorage, savePassword } from './thunks';

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
});
