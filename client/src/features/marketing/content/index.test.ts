import { describe, expect, it } from 'vitest';
import * as content from './index';

describe('marketing content public API barrel', () => {
  it('re-exports the content datasets and helpers', () => {
    expect(content.COMPETITORS).toBeTruthy();
    expect(content.SERVICE_GUIDES).toBeTruthy();
    expect(content.USE_CASES).toBeTruthy();
    expect(typeof content.hashSlug).toBe('function');
  });
});
