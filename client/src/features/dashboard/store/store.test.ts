import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { dashboardReducer } from './slice';
import { fetchUser } from './thunks';
import { selectProfile, selectProfileError } from './selectors';
import * as api from '../api';

vi.mock('../api', () => ({ fetchUserRequest: vi.fn() }));
const mocked = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
});

const makeStore = () => configureStore({ reducer: { dashboard: dashboardReducer } });

describe('dashboard slice + thunks', () => {
  it('starts from an empty profile and no error', () => {
    const state = makeStore().getState() as never;
    expect(selectProfile(state)).toEqual({});
    expect(selectProfileError(state)).toBe('');
  });

  it('fetchUser.fulfilled stores the profile and clears the error', async () => {
    mocked.fetchUserRequest.mockResolvedValue({ user: { email: 'x@y.co', role: 'User' } });
    const store = makeStore();
    await store.dispatch(fetchUser('u-1'));
    expect(mocked.fetchUserRequest).toHaveBeenCalledWith('u-1');
    expect(selectProfile(store.getState() as never)).toEqual({ email: 'x@y.co', role: 'User' });
    expect(selectProfileError(store.getState() as never)).toBe('');
  });

  it('fetchUser.rejected records the error message', async () => {
    mocked.fetchUserRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    await store.dispatch(fetchUser('u-2'));
    expect(selectProfileError(store.getState() as never)).toBe('boom');
  });

  it('reducer falls back to a default message when the rejection has no payload', () => {
    const state = dashboardReducer(undefined, {
      type: fetchUser.rejected.type,
      payload: undefined,
    });
    expect(state.error).toBe('Could not load user.');
  });
});
