import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('joins class names and drops falsy conditionals', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
    expect(cn('a', { b: true, c: false })).toBe('a b');
  });

  it('resolves conflicting tailwind utilities to the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('text-muted-foreground', 'text-foreground')).toBe('text-foreground');
  });
});
