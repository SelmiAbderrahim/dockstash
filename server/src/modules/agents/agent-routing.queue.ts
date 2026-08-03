import { HttpError } from '../../shared/utils/http-error.js';
import { translate, DEFAULT_LOCALE } from '../../shared/i18n/index.js';
import { Project } from '../backups/backups.model.js';
import type {
  Job,
  JobData,
  SchedulerQueue,
} from '../scheduler/scheduler.boundaries.js';
import { AgentJob } from './agent-jobs.model.js';
import { createAgentJob } from './agent-jobs.service.js';

/**
 * SchedulerQueue decorator: jobs for projects assigned to a remote agent are
 * persisted as AgentJob docs (the agent claims them by polling); everything
 * else flows to the local in-process queue unchanged. Cron, `enqueueNow`,
 * and the controller never know the difference.
 */
export function makeAgentAwareQueue(inner: SchedulerQueue): SchedulerQueue {
  return {
    async add(data: JobData): Promise<Job> {
      const project = await Project.findById(data.projectId)
        .select('agent legalHold')
        .lean();
      if (!project?.agent) {
        return inner.add(data);
      }
      if (data.kind === 'drill') {
        throw HttpError.badRequest(
          translate(DEFAULT_LOCALE, 'agents.error.drillNotSupported'),
        );
      }
      // Mirror is server-local v1 — the agent daemon has no mirror executor,
      // so reject at enqueue instead of shipping a job that can only fail.
      if (data.kind === 'mirror') {
        throw HttpError.badRequest(
          translate(DEFAULT_LOCALE, 'agents.error.mirrorNotSupported'),
        );
      }
      if (data.kind === 'prune' && project.legalHold) {
        // Parity with runPrune: legal hold beats retention — record a
        // successful skip instead of shipping a destructive job to the agent.
        const doc = await AgentJob.create({
          owner: data.owner,
          agent: project.agent,
          project: data.projectId,
          scheduleId: data.scheduleId ?? null,
          kind: 'prune',
          retention: data.retention ?? null,
          status: 'succeeded',
          finishedAt: new Date(),
          error: '',
        });
        return { id: String(doc._id), data, attempts: 0 };
      }
      const doc = await createAgentJob(data, String(project.agent));
      return { id: String(doc._id), data, attempts: 0 };
    },

    async activeCountForProject(projectId: string): Promise<number> {
      const local = await inner.activeCountForProject(projectId);
      const remote = await AgentJob.countDocuments({
        project: projectId,
        status: { $in: ['pending', 'leased'] },
      });
      return local + remote;
    },

    waitIdle: () => inner.waitIdle(),
    close: () => inner.close(),
  };
}
