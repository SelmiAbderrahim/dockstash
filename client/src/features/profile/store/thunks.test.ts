import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { profileReducer } from './slice';
import { fetchUser, saveProfile } from './thunks';
import { selectProfile, selectProfileError, selectProfileSaveStatus } from './selectors';
import * as api from '../api';

vi.mock('../api', () => ({ fetchUserRequest: vi.fn(), updateProfileRequest: vi.fn() }));
const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { profile: profileReducer } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('profile thunks', () => {
  it('fetchUser resolves the profile', async () => {
    mocked.fetchUserRequest.mockResolvedValue({ user: { email: 'x@y.co', role: 'User' } });
    const store = makeStore();
    await store.dispatch(fetchUser('u-1'));
    expect(mocked.fetchUserRequest).toHaveBeenCalledWith('u-1');
    expect(selectProfile(store.getState() as never)).toEqual({ email: 'x@y.co', role: 'User' });
  });

  it('fetchUser rejects with a message', async () => {
    mocked.fetchUserRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    await store.dispatch(fetchUser('u-2'));
    expect(selectProfileError(store.getState() as never)).toBe('boom');
  });

  it('saveProfile resolves the updated profile', async () => {
    mocked.updateProfileRequest.mockResolvedValue({
      user: { email: 'x@y.co', firstName: 'New', lastName: 'Name' },
    });
    const store = makeStore();
    await store.dispatch(saveProfile({ uid: 'u-1', firstName: 'New', lastName: 'Name' }));
    expect(mocked.updateProfileRequest).toHaveBeenCalledWith('u-1', {
      firstName: 'New',
      lastName: 'Name',
    });
    expect(selectProfile(store.getState() as never)).toEqual({
      email: 'x@y.co',
      firstName: 'New',
      lastName: 'Name',
    });
    expect(selectProfileSaveStatus(store.getState() as never)).toBe('succeeded');
  });

  it('saveProfile rejects with a message', async () => {
    mocked.updateProfileRequest.mockRejectedValue(new Error('nope'));
    const store = makeStore();
    await store.dispatch(saveProfile({ uid: 'u-1', firstName: 'A', lastName: 'B' }));
    expect(selectProfileError(store.getState() as never)).toBe('nope');
    expect(selectProfileSaveStatus(store.getState() as never)).toBe('failed');
  });
});
