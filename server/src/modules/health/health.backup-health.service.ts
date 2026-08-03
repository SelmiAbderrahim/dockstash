import { isValidObjectId } from 'mongoose';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project, type ProjectHydrated } from '../backups/backups.model.js';
import { Agent } from '../agents/index.js';
import { Schedule } from '../scheduler/scheduler.model.js';
import {
  Alert,
  type AlertEventKind,
  type AlertHydrated,
  type AlertSeverity,
} from './health.model.js';
import {
  computeProjectHealth,
  worstStatus,
  type HealthStatus,
} from './health.rules.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface ServiceCtx {
  t?: Translator;
  now?: Date;
}

export interface ProjectHealthEntry {
  projectId: string;
  name: string;
  status: HealthStatus;
  reasons: string[];
  lastStatus: string;
  lastSuccessAt: string | null;
  lastDrillStatus: string | null;
  lastCheckStatus: string | null;
  agentStatus: 'online' | 'offline' | null;
  hasEnabledSchedule: boolean;
}

export interface HealthOverview {
  status: HealthStatus;
  projects: ProjectHealthEntry[];
  unreadAlerts: number;
}

interface VerdictCtx {
  now: Date;
  enabledScheduleProjectIds: Set<string>;
  agentStatusById: Map<string, 'online' | 'offline'>;
}

function entryFor(project: ProjectHydrated, ctx: VerdictCtx): ProjectHealthEntry {
  const projectId = String(project._id);
  const agentStatus = project.agent
    ? (ctx.agentStatusById.get(String(project.agent)) ?? 'offline')
    : null;
  const hasEnabledSchedule = ctx.enabledScheduleProjectIds.has(projectId);
  const verdict = computeProjectHealth({
    lastStatus: project.lastStatus,
    lastSuccessAt: project.lastSuccessAt ?? null,
    lastCheckStatus: project.lastCheckStatus ?? null,
    lastDrillStatus: project.lastDrillStatus ?? null,
    lastRestoreStatus: project.lastRestoreStatus ?? null,
    hasEnabledSchedule,
    agentStatus,
    staleAfterHours: env.ALERT_HEARTBEAT_HOURS,
    now: ctx.now,
  });
  return {
    projectId,
    name: project.name,
    status: verdict.status,
    reasons: verdict.reasons,
    lastStatus: project.lastStatus,
    lastSuccessAt: project.lastSuccessAt ? project.lastSuccessAt.toISOString() : null,
    lastDrillStatus: project.lastDrillStatus ?? null,
    lastCheckStatus: project.lastCheckStatus ?? null,
    agentStatus,
    hasEnabledSchedule,
  };
}

/** Fleet-wide backup-health snapshot: worst project wins the banner. */
export async function getHealthOverview(
  owner: string,
  ctx: ServiceCtx = {},
): Promise<HealthOverview> {
  const now = ctx.now ?? new Date();
  const [projects, schedules, agents, unreadAlerts] = await Promise.all([
    Project.find({ owner }).sort({ createdAt: -1 }),
    Schedule.find({ owner, enabled: true }),
    Agent.find({ owner }),
    Alert.countDocuments({ owner, readAt: null }),
  ]);
  const verdictCtx: VerdictCtx = {
    now,
    enabledScheduleProjectIds: new Set(schedules.map((s) => String(s.project))),
    agentStatusById: new Map(agents.map((a) => [String(a._id), a.status] as const)),
  };
  const entries = projects.map((p) => entryFor(p, verdictCtx));
  return {
    status: worstStatus(entries.map((e) => e.status)),
    projects: entries,
    unreadAlerts,
  };
}

/** Single-project health detail; existence-cloaks like loadOwnedProject (surface #2). */
export async function getProjectHealth(
  projectId: string,
  owner: string,
  ctx: ServiceCtx = {},
): Promise<ProjectHealthEntry> {
  const t = ctx.t ?? identityT;
  if (!isValidObjectId(projectId)) {
    throw HttpError.notFound(t('backups.error.projectNotFound'));
  }
  const project = await Project.findOne({ _id: projectId, owner });
  if (!project) throw HttpError.notFound(t('backups.error.projectNotFound'));
  const now = ctx.now ?? new Date();
  const [schedules, agents] = await Promise.all([
    Schedule.find({ owner, project: projectId, enabled: true }),
    Agent.find({ owner }),
  ]);
  return entryFor(project, {
    now,
    enabledScheduleProjectIds: new Set(schedules.map((s) => String(s.project))),
    agentStatusById: new Map(agents.map((a) => [String(a._id), a.status] as const)),
  });
}

export interface RecordAlertInput {
  owner: string;
  projectId: string;
  projectName: string;
  kind: AlertEventKind;
  severity: AlertSeverity;
  error?: string;
}

/**
 * Persist an in-app alert row. Callers on the job path swallow failures so
 * alert bookkeeping can never fail a backup run.
 */
export async function recordAlert(input: RecordAlertInput): Promise<AlertHydrated> {
  return Alert.create({
    owner: input.owner,
    project: input.projectId,
    projectName: input.projectName,
    kind: input.kind,
    severity: input.severity,
    error: input.error ?? '',
  });
}

export interface PublicAlert {
  id: string;
  projectId: string;
  projectName: string;
  kind: AlertEventKind;
  severity: AlertSeverity;
  error: string;
  read: boolean;
  createdAt: string;
}

export function serializeAlert(alert: AlertHydrated): PublicAlert {
  const doc = alert.toObject({ virtuals: false });
  return {
    id: alert._id.toString(),
    projectId: String(alert.project),
    projectName: alert.projectName,
    kind: alert.kind,
    severity: alert.severity,
    error: alert.error,
    read: alert.readAt !== null,
    createdAt: (doc.createdAt as Date).toISOString(),
  };
}

export const ALERTS_PAGE_SIZE = 50;

export async function listAlerts(
  owner: string,
  opts: { unreadOnly?: boolean } = {},
): Promise<PublicAlert[]> {
  const query: Record<string, unknown> = { owner };
  if (opts.unreadOnly) query.readAt = null;
  const rows = await Alert.find(query)
    .sort({ createdAt: -1 })
    .limit(ALERTS_PAGE_SIZE);
  return rows.map(serializeAlert);
}

/** Mark alerts read; `ids` omitted = mark every unread alert for the owner. */
export async function markAlertsRead(owner: string, ids?: string[]): Promise<number> {
  const query: Record<string, unknown> = { owner, readAt: null };
  if (ids && ids.length > 0) query._id = { $in: ids };
  const res = await Alert.updateMany(query, { readAt: new Date() });
  return res.modifiedCount;
}
