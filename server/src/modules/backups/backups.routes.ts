import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  create,
  get,
  list,
  listContainers,
  listFolders,
  patchAgent,
  patchPlan,
  scan,
} from './backups.controller.js';
import { check, drill } from './backups.verify.controller.js';
import { listProjectSnapshots } from './backups.snapshots.controller.js';

export const backupsRouter: Router = Router();

backupsRouter.use(requireAuth);
backupsRouter.post('/scan', scan);
// Discovery routes are mounted before the `/:projectId` param route so the
// literal `discover` segment is never captured as a project id.
backupsRouter.get('/discover/folders', listFolders);
backupsRouter.get('/discover/containers', listContainers);
backupsRouter.post('/', create);
backupsRouter.get('/', list);
backupsRouter.get('/:projectId', get);
backupsRouter.get('/:projectId/snapshots', listProjectSnapshots);
backupsRouter.patch('/:projectId/plan', patchPlan);
backupsRouter.patch('/:projectId/agent', patchAgent);
backupsRouter.post('/:projectId/check', check);
backupsRouter.post('/:projectId/drill', drill);
