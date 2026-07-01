import { describe, expect, it } from 'vitest';
import { HttpError } from './http-error.js';

describe('HttpError factories', () => {
  it('maps each factory to its status code and carries details', () => {
    expect(HttpError.badRequest().status).toBe(400);
    expect(HttpError.unauthorized().status).toBe(401);
    expect(HttpError.forbidden().status).toBe(403);
    expect(HttpError.notFound().status).toBe(404);
    expect(HttpError.conflict().status).toBe(409);
    expect(HttpError.tooMany().status).toBe(429);
    expect(HttpError.internal().status).toBe(500);

    const withDetails = HttpError.forbidden('nope', { code: 'X' });
    expect(withDetails.message).toBe('nope');
    expect(withDetails.details).toEqual({ code: 'X' });
    expect(withDetails).toBeInstanceOf(Error);
  });
});
