import { describe, expect, it } from 'vitest';
import { resolveConnectSources } from './server.js';

describe('resolveConnectSources', () => {
  it('keeps relative connections on the same origin', () => {
    expect(resolveConnectSources('/api', '/')).toEqual(["'self'"]);
  });

  it('allows configured HTTP and WebSocket origins without duplicates', () => {
    expect(
      resolveConnectSources('https://api.example.test/api', 'https://api.example.test'),
    ).toEqual(["'self'", 'https://api.example.test', 'wss://api.example.test']);
  });

  it('rejects unsupported connection schemes', () => {
    expect(() => resolveConnectSources('javascript:alert(1)', '')).toThrow(
      'Browser connection URLs must use HTTP(S)',
    );
  });
});
