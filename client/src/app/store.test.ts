import { describe, expect, it } from 'vitest';
import { store, makeStore } from './store';

describe('store after demo strip', () => {
  const state = store.getState();

  it('registers auth, billing, dashboard slices', () => {
    expect(state).toHaveProperty('auth');
    expect(state).toHaveProperty('billing');
    expect(state).toHaveProperty('dashboard');
  });

  it('does NOT register removed demo slices', () => {
    expect(state).not.toHaveProperty('messaging');
    expect(state).not.toHaveProperty('pages');
    expect(state).not.toHaveProperty('sales');
    expect(state).not.toHaveProperty('template');
  });

  it('makeStore hydrates from preloaded state when provided', () => {
    const hydrated = makeStore({ auth: { ...state.auth, error: 'preloaded' } });
    expect(hydrated.getState().auth.error).toBe('preloaded');
  });
});
