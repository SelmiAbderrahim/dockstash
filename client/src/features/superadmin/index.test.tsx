import { describe, expect, it } from 'vitest';
import { superadminReducer, superadminRoutes } from './index';

describe('superadmin public API', () => {
  it('exports a reducer and the route array', () => {
    expect(typeof superadminReducer).toBe('function');
    expect(superadminRoutes[0]?.path).toBe('superadmin');
  });
});
