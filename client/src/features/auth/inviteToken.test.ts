import { describe, expect, it } from 'vitest';
import { inviteTokenFrom } from './inviteToken';

describe('inviteTokenFrom', () => {
  it('accepts a well-formed token', () => {
    expect(inviteTokenFrom('abcXYZ_0-9')).toBe('abcXYZ_0-9');
  });

  it('drops anything path-shaped, empty, or overlong', () => {
    expect(inviteTokenFrom(null)).toBe('');
    expect(inviteTokenFrom('')).toBe('');
    expect(inviteTokenFrom('../../evil')).toBe('');
    expect(inviteTokenFrom('https://evil.example')).toBe('');
    expect(inviteTokenFrom('a'.repeat(129))).toBe('');
  });
});
