import { describe, expect, it } from 'vitest';
import { profileReducer, resetSaveStatus } from './slice';
import { fetchUser, saveProfile } from './thunks';

const initial = () => profileReducer(undefined, { type: 'unknown' });

describe('profile slice', () => {
  it('starts idle with an empty profile', () => {
    const state = initial();
    expect(state.profile).toEqual({});
    expect(state.status).toBe('idle');
    expect(state.saveStatus).toBe('idle');
    expect(state.error).toBeNull();
  });

  it('fetchUser lifecycle', () => {
    let s = profileReducer(initial(), { type: fetchUser.pending.type });
    expect(s.status).toBe('loading');
    s = profileReducer(s, {
      type: fetchUser.fulfilled.type,
      payload: { email: 'a@b.co', firstName: 'A', lastName: 'B' },
    });
    expect(s.status).toBe('succeeded');
    expect(s.profile.email).toBe('a@b.co');
  });

  it('fetchUser.rejected records the error and falls back to a default message', () => {
    let s = profileReducer(initial(), { type: fetchUser.rejected.type, payload: 'boom' });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('boom');
    s = profileReducer(initial(), { type: fetchUser.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load profile.');
  });

  it('saveProfile lifecycle', () => {
    let s = profileReducer(initial(), { type: saveProfile.pending.type });
    expect(s.saveStatus).toBe('loading');
    s = profileReducer(s, {
      type: saveProfile.fulfilled.type,
      payload: { email: 'a@b.co', firstName: 'New', lastName: 'Name' },
    });
    expect(s.saveStatus).toBe('succeeded');
    expect(s.profile.firstName).toBe('New');
  });

  it('saveProfile.rejected records the error and falls back to a default message', () => {
    let s = profileReducer(initial(), { type: saveProfile.rejected.type, payload: 'nope' });
    expect(s.saveStatus).toBe('failed');
    expect(s.error).toBe('nope');
    s = profileReducer(initial(), { type: saveProfile.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not save profile.');
  });

  it('resetSaveStatus resets saveStatus to idle', () => {
    const saved = profileReducer(initial(), { type: saveProfile.fulfilled.type, payload: {} });
    expect(saved.saveStatus).toBe('succeeded');
    const reset = profileReducer(saved, resetSaveStatus());
    expect(reset.saveStatus).toBe('idle');
  });
});
