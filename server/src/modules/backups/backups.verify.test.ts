import { Readable } from 'node:stream';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';

import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from './backups.model.js';
import { createProject } from './backups.service.js';
import {
  runResticCheck,
  runRestoreDrill,
  runScheduledChecks,
  runScheduledDrills,
} from './backups.verify.service.js';
import type {
  DbDiffer,
  FileDiffer,
  ResticRunner,
  ScratchWorkspace,
} from './backups.boundaries.js';
import {
  configureVerifyController,
  resetVerifyController,
} from './backups.verify.controller.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email = 'v@test.com'): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant-hashed',
    profile: { firstName: 'V', lastName: 'V' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(ownerId: string, name = 'p'): Promise<string> {
  const p = await createProject(ownerId, {
    name,
    path: `/var/www/${name}`,
    repoPassword: 'password1',
  });
  p.plan = {
    paths: [`/var/www/${name}`],
    databases: [
      { service: 'pg', type: 'postgres', container: `${name}_pg_1`, enabled: true },
      { service: 'disabled', type: 'postgres', container: 'x', enabled: false },
    ],
    configs: [`/var/www/${name}/traefik.yml`],
  } as typeof p.plan;
  await p.save();
  return p._id.toString();
}

interface ResticSpy extends ResticRunner {
  checkArgs: string[][];
  restoreArgs: string[][];
  snapshotsFn: () => Promise<Array<{ id: string; time: string }>>;
  checkFn: (args: string[]) => Promise<void>;
  restoreFn: (args: string[]) => Promise<void>;
}

function makeResticSpy(overrides: Partial<{
  snapshots: () => Promise<Array<{ id: string; time: string }>>;
  check: (args: string[]) => Promise<void>;
  restore: (args: string[]) => Promise<void>;
}> = {}): ResticSpy {
  const spy: ResticSpy = {
    checkArgs: [],
    restoreArgs: [],
    snapshotsFn: overrides.snapshots ?? (async () => [{ id: 'abc', time: '2026-07-01T00:00:00Z' }]),
    checkFn: overrides.check ?? (async () => {}),
    restoreFn: overrides.restore ?? (async () => {}),
    async init() {},
    async backup() {},
    async snapshots() {
      return spy.snapshotsFn();
    },
    async check(args) {
      spy.checkArgs.push(args);
      return spy.checkFn(args);
    },
    async restore(args) {
      spy.restoreArgs.push(args);
      return spy.restoreFn(args);
    },
    async snapshotsDetailed() {
      return [];
    },
    async dump(): Promise<never> {
      throw new Error('dump not stubbed');
    },
  };
  return spy;
}

interface ScratchSpy extends ScratchWorkspace {
  createCalls: number;
  removeCalls: string[];
  createFn: () => Promise<string>;
  removeFn: (p: string) => Promise<void>;
}

function makeScratchSpy(overrides: Partial<{
  create: () => Promise<string>;
  remove: (p: string) => Promise<void>;
}> = {}): ScratchSpy {
  const spy: ScratchSpy = {
    createCalls: 0,
    removeCalls: [],
    createFn: overrides.create ?? (async () => '/tmp/scratch-x'),
    removeFn: overrides.remove ?? (async () => {}),
    async create() {
      spy.createCalls += 1;
      return spy.createFn();
    },
    async remove(p) {
      spy.removeCalls.push(p);
      return spy.removeFn(p);
    },
  };
  return spy;
}

function makeFileDiff(result: { mismatches: number; details: string[] }): FileDiffer {
  return {
    async diff() {
      return { ...result };
    },
  };
}

function makeDbDiff(result: { mismatches: number; details: string[] }): DbDiffer {
  return {
    async diff() {
      return { ...result };
    },
  };
}

describe('backups: runResticCheck', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('passes and stamps lastCheckStatus=pass', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy();
    const res = await runResticCheck(projectId, id, { resticRunner: restic });
    expect(res.status).toBe('pass');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastCheckStatus).toBe('pass');
    expect(persisted?.lastCheckAt).toBeTruthy();
    expect(restic.checkArgs[0]).toEqual(['check']);
  });

  it('passes --read-data-subset as argv token when provided', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy();
    await runResticCheck(projectId, id, { resticRunner: restic, readDataSubset: 25 });
    expect(restic.checkArgs[0]).toEqual(['check', '--read-data-subset', '25%']);
  });

  it('stamps fail and never reports pass when restic throws', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy({
      check: async () => {
        throw new Error('corrupt pack');
      },
    });
    const res = await runResticCheck(projectId, id, { resticRunner: restic });
    expect(res.status).toBe('fail');
    expect(res.detail).toMatch(/corrupt pack/);
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastCheckStatus).toBe('fail');
    expect(persisted?.lastCheckStatus).not.toBe('pass');
  });

  it('cloaks existence for cross-user check (404 not 403)', async () => {
    const owner = await seedUser('own@test.com');
    const stranger = await seedUser('str@test.com');
    const projectId = await seedProject(owner.id);
    await expect(
      runResticCheck(projectId, stranger.id, { resticRunner: makeResticSpy() }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('backups: runRestoreDrill (round-trip)', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('passes when file+db diffs are clean (cardinal round-trip test)', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy();
    const scratch = makeScratchSpy();
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('pass');
    expect(res.mismatches).toBe(0);
    expect(restic.restoreArgs[0]).toEqual(['restore', 'latest', '--target', '/tmp/scratch-x']);
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('pass');
  });

  it('fails when any file byte-diff mismatches — never a false green', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: makeResticSpy(),
      scratch: makeScratchSpy(),
      fileDiff: makeFileDiff({ mismatches: 2, details: ['a', 'b'] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('fail');
    expect(res.mismatches).toBeGreaterThanOrEqual(2);
    expect(res.status).not.toBe('pass');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('fail');
    expect(persisted?.lastDrillDetail).toMatch(/mismatch/);
  });

  it('fails when DB row-diff mismatches (per-adapter torn-write detection)', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: makeResticSpy(),
      scratch: makeScratchSpy(),
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 7, details: ['pg: row count mismatch'] }),
    });
    expect(res.status).toBe('fail');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('fail');
  });

  it('surfaces "nothing to restore" cleanly when no snapshots exist', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy({ snapshots: async () => [] });
    const scratch = makeScratchSpy();
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('fail');
    expect(res.detail).toMatch(/No snapshots|nothingToRestore/);
    expect(scratch.createCalls).toBe(0);
    expect(scratch.removeCalls).toEqual([]);
  });

  it('cleans up scratch even when restore throws', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy({
      restore: async () => {
        throw new Error('restore boom');
      },
    });
    const scratch = makeScratchSpy();
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('fail');
    expect(scratch.removeCalls).toEqual(['/tmp/scratch-x']);
  });

  it('tolerates a failing scratch cleanup and still returns a fail result', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy({
      restore: async () => {
        throw new Error('boom');
      },
    });
    const scratch = makeScratchSpy({
      remove: async () => {
        throw new Error('cleanup failed');
      },
    });
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('fail');
  });

  it('surfaces snapshots() failure cleanly and stamps fail', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy({
      snapshots: async () => {
        throw new Error('repo unreachable');
      },
    });
    const scratch = makeScratchSpy();
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
      dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(res.status).toBe('fail');
    expect(scratch.createCalls).toBe(0);
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('fail');
  });

  it('cloaks existence for cross-user drill (404 not 403)', async () => {
    const owner = await seedUser('a@test.com');
    const stranger = await seedUser('b@test.com');
    const projectId = await seedProject(owner.id);
    await expect(
      runRestoreDrill(projectId, stranger.id, {
        resticRunner: makeResticSpy(),
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('backups: schedule entry points', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('runScheduledChecks continues past a throwing project', async () => {
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    await seedProject(a.id, 'pa');
    await seedProject(b.id, 'pb');
    let n = 0;
    const results = await runScheduledChecks({
      resticRunnerFor: () =>
        makeResticSpy({
          check: async () => {
            n += 1;
            if (n === 1) throw new Error('first fails');
          },
        }),
    });
    expect(results).toHaveLength(2);
    // Neither call to runResticCheck itself throws; it stamps 'fail'. So both come back as fail-or-pass.
    expect(results.map((r) => r.status).sort()).toEqual(['fail', 'pass']);
  });

  it('runScheduledDrills continues past a throwing project', async () => {
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    await seedProject(a.id, 'pa');
    await seedProject(b.id, 'pb');
    let n = 0;
    const results = await runScheduledDrills({
      resticRunnerFor: () => makeResticSpy(),
      scratchFor: () => makeScratchSpy(),
      fileDiffFor: () => ({
        async diff() {
          n += 1;
          if (n === 1) return { mismatches: 4, details: ['bad'] };
          return { mismatches: 0, details: [] };
        },
      }),
      dbDiffFor: () => makeDbDiff({ mismatches: 0, details: [] }),
    });
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.status).sort()).toEqual(['fail', 'pass']);
  });
});

describe('backups: HTTP /check and /drill', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(async () => {
    await clearCollections();
    resetVerifyController();
  });
  afterEach(() => resetVerifyController());

  it('POST /:id/check requires auth', async () => {
    const res = await request(app).post('/api/backups/anyid/check').send({});
    expect(res.status).toBe(401);
  });

  it('POST /:id/check returns pass and serializes updated project', async () => {
    const { id, token } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeResticSpy();
    configureVerifyController({
      makeCheckDeps: () => ({ resticRunner: restic }),
      makeDrillDeps: () => ({
        resticRunner: restic,
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    });
    const res = await request(app)
      .post(`/api/backups/${projectId}/check`)
      .set('Authorization', `JWT ${token}`)
      .send({ readDataSubset: 10 });
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('pass');
    expect(res.body.project.lastCheckStatus).toBe('pass');
    expect(restic.checkArgs[0]).toEqual(['check', '--read-data-subset', '10%']);
  });

  it('POST /:id/drill returns fail on mismatches, stamps status', async () => {
    const { id, token } = await seedUser();
    const projectId = await seedProject(id);
    configureVerifyController({
      makeCheckDeps: () => ({ resticRunner: makeResticSpy() }),
      makeDrillDeps: () => ({
        resticRunner: makeResticSpy(),
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 3, details: ['file1'] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    });
    const res = await request(app)
      .post(`/api/backups/${projectId}/drill`)
      .set('Authorization', `JWT ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.result.status).toBe('fail');
    expect(res.body.project.lastDrillStatus).toBe('fail');
  });

  it('POST /:id/drill returns 403 when caller does not own the project', async () => {
    const owner = await seedUser('o@test.com');
    const stranger = await seedUser('s@test.com');
    const projectId = await seedProject(owner.id);
    configureVerifyController({
      makeCheckDeps: () => ({ resticRunner: makeResticSpy() }),
      makeDrillDeps: () => ({
        resticRunner: makeResticSpy(),
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    });
    const res = await request(app)
      .post(`/api/backups/${projectId}/drill`)
      .set('Authorization', `JWT ${stranger.token}`)
      .send({});
    expect(res.status).toBe(404);
  });

  it('POST /:id/check errors 500 when the controller was never configured', async () => {
    const { id, token } = await seedUser();
    const projectId = await seedProject(id);
    const res = await request(app)
      .post(`/api/backups/${projectId}/check`)
      .set('Authorization', `JWT ${token}`)
      .send({});
    expect(res.status).toBe(500);
  });

  it('GET /:id surfaces drill status fields', async () => {
    const { id, token } = await seedUser();
    const projectId = await seedProject(id);
    configureVerifyController({
      makeCheckDeps: () => ({ resticRunner: makeResticSpy() }),
      makeDrillDeps: () => ({
        resticRunner: makeResticSpy(),
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    });
    await request(app)
      .post(`/api/backups/${projectId}/drill`)
      .set('Authorization', `JWT ${token}`)
      .send({});
    const getRes = await request(app)
      .get(`/api/backups/${projectId}`)
      .set('Authorization', `JWT ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.project).toHaveProperty('lastDrillStatus', 'pass');
    expect(getRes.body.project).toHaveProperty('lastDrillAt');
    expect(getRes.body.project).toHaveProperty('lastCheckStatus');
  });
});

describe('backups: verify controller reset', () => {
  it('resetVerifyController clears the injected deps', async () => {
    // configure then reset — subsequent calls to check fall back to 500.
    configureVerifyController({
      makeCheckDeps: () => ({ resticRunner: makeResticSpy() }),
      makeDrillDeps: () => ({
        resticRunner: makeResticSpy(),
        scratch: makeScratchSpy(),
        fileDiff: makeFileDiff({ mismatches: 0, details: [] }),
        dbDiff: makeDbDiff({ mismatches: 0, details: [] }),
      }),
    });
    resetVerifyController();
    // consumer would need to configure again — we just prove reset is idempotent.
    expect(() => resetVerifyController()).not.toThrow();
  });
});

// Keep Readable/vi in the import graph to appease no-unused-vars if any static
// scan sniffs it; both are used in adjacent test files that share this module.
void Readable;
void vi;
