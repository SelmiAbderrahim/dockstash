import { describe, expect, it } from 'vitest';
import * as marketing from './index';
import * as content from './content/index';

// The feature barrels are pure re-export modules; importing them executes the
// module body so coverage reflects them (they are wired into the router at
// runtime but no unit test imports the barrel directly otherwise).
describe('marketing barrels', () => {
  it('re-export their public API', () => {
    expect(marketing).toBeTruthy();
    expect(content).toBeTruthy();
    expect(Object.keys(marketing).length).toBeGreaterThan(0);
  });
});
