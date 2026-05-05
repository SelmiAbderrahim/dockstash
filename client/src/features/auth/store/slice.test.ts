import { describe, expect, it } from 'vitest';
import { authReducer, clearError } from './slice';
import { logoutUser } from './thunks';

describe('auth slice', () => {
  it('returns the initial state when given an unknown action', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state.error).toBe('');
    expect(state.message).toBe('');
    expect(state.content).toBe('');
  });

  it('clears the error when clearError is dispatched', () => {
    const state = authReducer(
      { authenticated: false, error: 'oops', message: '', content: '' },
      clearError(),
    );
    expect(state.error).toBe('');
  });

  it('marks the user as unauthenticated after logoutUser fulfilled', () => {
    const state = authReducer(
      { authenticated: true, error: '', message: 'hi', content: 'x' },
      { type: logoutUser.fulfilled.type, payload: '' },
    );
    expect(state.authenticated).toBe(false);
    expect(state.message).toBe('');
    expect(state.content).toBe('');
  });
});
