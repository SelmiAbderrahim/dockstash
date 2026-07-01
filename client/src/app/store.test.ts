import { describe, expect, it } from 'vitest';
import { store } from './store';

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
});
