import { describe, expect, it } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../utils/http-error.js';
import { ROLE_ADMIN, ROLE_MEMBER, ROLE_OWNER } from '../../modules/users/index.js';
import { requireRole } from './require-role.js';

function invoke(minRole: Parameters<typeof requireRole>[0], user?: Express.User): unknown {
  let outcome: unknown = 'not-called';
  requireRole(minRole)(
    { user } as Request,
    {} as Response,
    ((err?: unknown) => {
      outcome = err;
    }) as NextFunction,
  );
  return outcome;
}

describe('requireRole', () => {
  it('rejects an unauthenticated request with 401', () => {
    const err = invoke(ROLE_ADMIN, undefined);
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it('rejects a lower-ranked role with 403', () => {
    for (const role of [ROLE_MEMBER, ROLE_OWNER]) {
      const err = invoke(ROLE_ADMIN, { id: 'u1', role });
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).status).toBe(403);
    }
  });

  it('rejects an unknown role string (rank 0) with 403', () => {
    const err = invoke(ROLE_MEMBER, { id: 'u1', role: 'Nonsense' });
    expect((err as HttpError).status).toBe(403);
  });

  it('passes an equal-ranked role through to next()', () => {
    expect(invoke(ROLE_ADMIN, { id: 'u1', role: ROLE_ADMIN })).toBeUndefined();
  });

  it('passes a higher-ranked role through to next()', () => {
    expect(invoke(ROLE_MEMBER, { id: 'u1', role: ROLE_ADMIN })).toBeUndefined();
  });
});
