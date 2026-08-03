import { HttpError } from '../../shared/utils/http-error.js';
import { decryptSecret } from '../../shared/crypto/index.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { translate, DEFAULT_LOCALE } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import { loadTransportForUser } from '../settings/settings.service.js';
import { sendFailureAlert } from '../alerting/index.js';
import { Schedule, type ScheduleStatus } from '../scheduler/scheduler.model.js';
import type { JobData, LogEmitter } from '../scheduler/scheduler.boundaries.js';
import type { AgentPrincipal } from '../../shared/middleware/require-agent-auth.js';
import {
  AgentJob,
  type AgentJobHydrated,
  type AgentJobKind,
} from './agent-jobs.model.js';

type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

const LOG_TAIL_CAP = 200;

/** Alert taxonomy has no check/prune kinds — fold them into `backup`. */
function failureKindFor(kind: AgentJobKind): 'backup' | 'restore' {
  return kind === 'restore' ? 'restore' : 'backup';
}

/** Normalize unknown throwables to a message string. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Runtime hooks (Socket.IO log emitter + failure alerts) are injected by the
 * scheduler runtime at boot — mirrors `configureSchedulerController`.
 */
interface AgentJobEvents {
  logs?: LogEmitter;
}

let events: AgentJobEvents = {};

export function configureAgentJobEvents(next: AgentJobEvents): void {
  events = next;
}

/**
 * Persist a job for a remote agent. Called by the agent-aware queue decorator
 * when a project is assigned to an agent — the local worker never sees it.
 */
export async function createAgentJob(
  data: JobData,
  agentId: string,
): Promise<AgentJobHydrated> {
  return AgentJob.create({
    owner: data.owner,
    agent: agentId,
    project: data.projectId,
    scheduleId: data.scheduleId ?? null,
    kind: data.kind as AgentJobKind,
    retention: data.retention ?? null,
    restorePayload: data.payload
      ? {
          snapshotId: data.payload.snapshotId,
          overwrite: data.payload.overwrite,
          targetPath: data.payload.targetPath ?? null,
        }
      : null,
    status: 'pending',
  });
}

async function persistScheduleStatus(
  scheduleId: string | null | undefined,
  status: ScheduleStatus,
): Promise<void> {
  if (!scheduleId) return;
  try {
    await Schedule.findByIdAndUpdate(scheduleId, { lastRunStatus: status });
  } catch {
    // best effort — mirrors the local dispatcher's persistStatus
  }
}

async function failJobInline(
  job: AgentJobHydrated,
  error: string,
  now: Date,
): Promise<void> {
  job.status = 'failed';
  job.error = error;
  job.finishedAt = now;
  await job.save();
  await persistScheduleStatus(job.scheduleId, 'failed');
  events.logs?.done(String(job._id), false, error);
}

/** Claim payload — secrets exist ONLY in this response, never at rest. */
export interface ClaimedJobPayload {
  id: string;
  kind: AgentJobKind;
  projectId: string;
  leaseSeconds: number;
  attempt: number;
  maxAttempts: number;
  plan: {
    paths: string[];
    configs: string[];
    databases: Array<{
      service: string;
      type: string;
      container: string;
      enabled: boolean;
    }>;
  };
  retention: { keepDaily: number; keepWeekly: number; keepMonthly: number } | null;
  restore: { snapshotId: string; overwrite: boolean; targetPath: string | null } | null;
  repo: { url: string; password: string };
  ssh: { privateKey: string; hostKeyLine: string };
}

/**
 * Atomically claim the oldest pending job for this agent and assemble its
 * execution payload (the same material `resolveProjectRunner` builds for the
 * local worker). Jobs whose project vanished are failed inline and
 * the next one is tried. Returns null when nothing is claimable.
 */
export async function claimNextJob(
  principal: AgentPrincipal,
  deps: { t?: Translator; now?: Date } = {},
): Promise<ClaimedJobPayload | null> {
  const t = deps.t ?? identityT;
  const now = deps.now ?? new Date();
  // Bounded loop: each iteration either returns, or terminally fails one
  // pending job — it cannot spin.
  for (;;) {
    const job = await AgentJob.findOneAndUpdate(
      { agent: principal.id, status: 'pending' },
      {
        status: 'leased',
        claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + env.AGENT_JOB_LEASE_SECONDS * 1000),
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    );
    if (!job) return null;

    const project = await Project.findById(job.project);
    if (!project || project.owner.toString() !== principal.owner) {
      await failJobInline(job, 'project not found', now);
      continue;
    }

    let repoUrl: string;
    let repoPassword: string;
    let sshPrivateKey: string;
    let hostKeyLine: string;
    try {
      const { transport, settings } = await loadTransportForUser(principal.owner, t);
      /* c8 ignore next 3 -- unreachable: loadTransportForUser only returns configured settings, which implies sshKeyEnc */
      if (!settings.sshKeyEnc) {
        throw new Error('storage SSH key missing');
      }
      repoUrl = transport.repoUrl({ id: String(project._id), owner: principal.owner });
      repoPassword = decryptSecret(project.repoPasswordEnc);
      sshPrivateKey = decryptSecret(settings.sshKeyEnc);
      hostKeyLine = settings.hostKeyLine;
    } catch (err) {
      await failJobInline(job, `storage unavailable: ${errorMessage(err)}`, now);
      continue;
    }

    await persistScheduleStatus(job.scheduleId, 'running');

    return {
      id: String(job._id),
      kind: job.kind,
      projectId: String(project._id),
      leaseSeconds: env.AGENT_JOB_LEASE_SECONDS,
      attempt: job.attempts,
      maxAttempts: 3,
      plan: {
        paths: [...project.plan.paths],
        configs: [...project.plan.configs],
        databases: project.plan.databases.map((db) => ({
          service: db.service,
          type: db.type,
          container: db.container,
          enabled: db.enabled,
        })),
      },
      retention: job.retention
        ? {
            keepDaily: job.retention.keepDaily,
            keepWeekly: job.retention.keepWeekly,
            keepMonthly: job.retention.keepMonthly,
          }
        : null,
      restore: job.restorePayload
        ? {
            snapshotId: job.restorePayload.snapshotId,
            overwrite: job.restorePayload.overwrite,
            targetPath: job.restorePayload.targetPath ?? null,
          }
        : null,
      repo: { url: repoUrl, password: repoPassword },
      ssh: { privateKey: sshPrivateKey, hostKeyLine },
    };
  }
}

/**
 * Append agent-reported log lines to the job tail (server-capped), renew the
 * lease, and fan the lines out to the live Socket.IO room.
 */
export async function appendJobLogs(
  principal: AgentPrincipal,
  jobId: string,
  lines: string[],
  deps: { t?: Translator; now?: Date } = {},
): Promise<void> {
  const t = deps.t ?? identityT;
  const now = deps.now ?? new Date();
  const job = await AgentJob.findOneAndUpdate(
    { _id: jobId, agent: principal.id, status: 'leased' },
    {
      $push: { logTail: { $each: lines, $slice: -LOG_TAIL_CAP } },
      leaseExpiresAt: new Date(now.getTime() + env.AGENT_JOB_LEASE_SECONDS * 1000),
    },
    { new: true },
  );
  if (!job) throw HttpError.notFound(t('agents.error.jobNotFound'));
  for (const line of lines) events.logs?.log(jobId, line);
}

export interface AgentJobResultInput {
  ok: boolean;
  error?: string;
  stats?: {
    snapshotCount?: number;
    totalRepoBytes?: number;
    lastBackupBytes?: number;
  };
}

async function stampProject(
  projectId: string,
  owner: string,
  kind: AgentJobKind,
  result: AgentJobResultInput,
  now: Date,
): Promise<void> {
  // Owner scope AT QUERY TIME (surface #2 / S2-02). A malicious daemon cannot
  // pin telemetry on another owner's project even if a stray join reaches this
  // path — the DB never returns an unowned row.
  const project = await Project.findOne({ _id: projectId, owner });
  if (!project) return; // deleted mid-run — nothing left to stamp
  const detail = result.ok ? '' : (result.error ?? 'agent job failed');
  switch (kind) {
    case 'backup': {
      // Mirrors the local pipeline's markStatus (backups.service.ts).
      project.lastStatus = result.ok ? 'success' : 'failed';
      project.lastError = detail;
      project.lastRunAt = now;
      if (result.ok) {
        project.lastSuccessAt = now;
        project.lastHeartbeatAlertAt = null;
        project.snapshotCount =
          result.stats?.snapshotCount ?? project.snapshotCount + 1;
        if (result.stats?.totalRepoBytes !== undefined) {
          project.totalRepoBytes = result.stats.totalRepoBytes;
        }
        if (result.stats?.lastBackupBytes !== undefined) {
          project.lastBackupBytes = result.stats.lastBackupBytes;
        }
      }
      break;
    }
    case 'check': {
      project.lastCheckAt = now;
      project.lastCheckStatus = result.ok ? 'pass' : 'fail';
      project.lastCheckDetail = detail;
      break;
    }
    case 'restore': {
      project.lastRestoreAt = now;
      project.lastRestoreStatus = result.ok ? 'pass' : 'fail';
      project.lastRestoreDetail = detail;
      break;
    }
    case 'prune': {
      // Prune has no dedicated stamp fields; failures surface via lastError.
      if (!result.ok) {
        project.lastError = detail;
      }
      break;
    }
  }
  await project.save();
}

/**
 * Final, single-shot completion (idempotent: only a `leased` job transitions).
 * Applies full parity with the local pipeline: project stamps, schedule
 * status, terminal log event, failure alert.
 */
export async function completeJob(
  principal: AgentPrincipal,
  jobId: string,
  result: AgentJobResultInput,
  deps: { t?: Translator; now?: Date } = {},
): Promise<AgentJobHydrated> {
  const t = deps.t ?? identityT;
  const now = deps.now ?? new Date();
  const job = await AgentJob.findOneAndUpdate(
    { _id: jobId, agent: principal.id, status: 'leased' },
    {
      status: result.ok ? 'succeeded' : 'failed',
      error: result.ok ? '' : (result.error ?? 'agent job failed'),
      finishedAt: now,
      resultStats: result.stats
        ? {
            snapshotCount: result.stats.snapshotCount ?? null,
            totalRepoBytes: result.stats.totalRepoBytes ?? null,
            lastBackupBytes: result.stats.lastBackupBytes ?? null,
          }
        : null,
    },
    { new: true },
  );
  if (!job) throw HttpError.notFound(t('agents.error.jobNotFound'));

  await stampProject(String(job.project), principal.owner, job.kind, result, now);
  await persistScheduleStatus(job.scheduleId, result.ok ? 'success' : 'failed');
  events.logs?.done(jobId, result.ok, result.ok ? undefined : job.error);
  if (!result.ok) {
    try {
      await sendFailureAlert({
        projectId: String(job.project),
        kind: failureKindFor(job.kind),
        error: job.error,
      });
    } catch (alertErr) {
      logger.error({ err: alertErr }, 'agent job failure alert emit failed');
    }
  }
  return job;
}

/**
 * Fail leased jobs whose lease expired (agent died mid-run). No auto-requeue:
 * a half-run restic backup on a vanished agent must surface loudly.
 */
export async function expireStaleAgentJobs(now: Date = new Date()): Promise<void> {
  const stale = await AgentJob.find({ status: 'leased', leaseExpiresAt: { $lt: now } });
  for (const job of stale) {
    job.status = 'failed';
    job.error = 'agent lease expired';
    job.finishedAt = now;
    await job.save();
    await persistScheduleStatus(job.scheduleId, 'failed');
    events.logs?.done(String(job._id), false, job.error);
    try {
      await sendFailureAlert({
        projectId: String(job.project),
        kind: failureKindFor(job.kind),
        error: job.error,
      });
    } catch (alertErr) {
      logger.error({ err: alertErr }, 'agent lease-expiry alert emit failed');
    }
  }
}

/** Live-log room authorization: who owns this agent job? */
export async function ownerOfAgentJob(jobId: string): Promise<string | null> {
  // Local queue ids are small integers, not ObjectIds — never a CastError.
  if (!/^[a-f0-9]{24}$/i.test(jobId)) return null;
  const job = await AgentJob.findById(jobId).select('owner').lean();
  return job ? String(job.owner) : null;
}
