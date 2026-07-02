import { describe, expect, it } from 'vitest';
import { ApiError } from '@shared/api/client';
import { messageFromError } from './errors';

describe('messageFromError', () => {
  it('returns a string ApiError data body verbatim', () => {
    expect(messageFromError(new ApiError('m', 400, 'plain text'), 'fb')).toBe('plain text');
  });

  it('extracts the `error` field from a structured ApiError body', () => {
    expect(messageFromError(new ApiError('m', 400, { error: 'field-msg' }), 'fb')).toBe('field-msg');
  });

  it('falls back when the ApiError body has a non-string `error` field', () => {
    expect(messageFromError(new ApiError('m', 400, { error: 42 }), 'fb')).toBe('m');
  });

  it('unwraps the nested message from a `{ error: { message } }` body', () => {
    expect(
      messageFromError(new ApiError('m', 409, { error: { message: 'host taken', details: {} } }), 'fb'),
    ).toBe('host taken');
  });

  it('falls back when the nested `error.message` is not a string', () => {
    expect(messageFromError(new ApiError('m', 409, { error: { message: 42 } }), 'fb')).toBe('m');
  });

  it('falls back to the ApiError message when the body is an object without `error`', () => {
    expect(messageFromError(new ApiError('the-message', 500, { other: 1 }), 'fb')).toBe('the-message');
  });

  it('returns the message for a plain Error', () => {
    expect(messageFromError(new Error('boom'), 'fb')).toBe('boom');
  });

  it('returns the fallback for a non-error value', () => {
    expect(messageFromError('just a string', 'fallback')).toBe('fallback');
    expect(messageFromError(undefined, 'fallback')).toBe('fallback');
  });
});
