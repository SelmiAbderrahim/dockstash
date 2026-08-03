import { describe, expect, it } from 'vitest';
import { engineLabel, snapshotKind } from './snapshotKind';
import type { Snapshot } from './types';

const make = (tags?: string[]): Snapshot => ({
  id: 's1',
  projectId: 'p1',
  time: '2024-01-01T00:00:00Z',
  sizeBytes: 0,
  ...(tags ? { tags } : {}),
});

describe('snapshotKind', () => {
  it('classifies a db:<service>:<engine> tag as a database with its engine', () => {
    expect(snapshotKind(make(['db:cache:redis']))).toEqual({
      kind: 'database',
      engine: 'redis',
    });
    expect(snapshotKind(make(['db:primary:postgres']))).toEqual({
      kind: 'database',
      engine: 'postgres',
    });
  });

  it('keeps an unknown engine as its raw tag value', () => {
    expect(snapshotKind(make(['db:svc:cockroach']))).toEqual({
      kind: 'database',
      engine: 'cockroach',
    });
  });

  it('classifies the mirror tag as a mirror', () => {
    expect(snapshotKind(make(['mirror']))).toEqual({ kind: 'mirror' });
  });

  it('lets a db tag win over a mirror tag regardless of order', () => {
    expect(snapshotKind(make(['mirror', 'db:cache:redis']))).toEqual({
      kind: 'database',
      engine: 'redis',
    });
  });

  it('falls back to files when there are no tags', () => {
    expect(snapshotKind(make())).toEqual({ kind: 'files' });
  });

  it('falls back to files for an empty tag list', () => {
    expect(snapshotKind(make([]))).toEqual({ kind: 'files' });
  });

  it('falls back to files for unrelated tags', () => {
    expect(snapshotKind(make(['weekly', 'manual']))).toEqual({ kind: 'files' });
  });
});

describe('engineLabel', () => {
  it('maps known engines to their proper-noun labels', () => {
    expect(engineLabel('redis')).toBe('Redis');
    expect(engineLabel('postgres')).toBe('Postgres');
    expect(engineLabel('mysql')).toBe('MySQL');
    expect(engineLabel('mongo')).toBe('MongoDB');
    expect(engineLabel('minio')).toBe('MinIO');
  });

  it('returns the raw value for an unknown engine', () => {
    expect(engineLabel('cockroach')).toBe('cockroach');
  });
});
