import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { create, get, list, patchPlan, scan } from './backups.controller.js';
import { check, drill } from './backups.verify.controller.js';
import { listProjectSnapshots } from './backups.snapshots.controller.js';

export const backupsRouter: Router = Router();

backupsRouter.use(requireAuth);
backupsRouter.post('/scan', scan);
backupsRouter.post('/', create);
backupsRouter.get('/', list);
backupsRouter.get('/:projectId', get);
backupsRouter.get('/:projectId/snapshots', listProjectSnapshots);
backupsRouter.patch('/:projectId/plan', patchPlan);
backupsRouter.post('/:projectId/check', check);
backupsRouter.post('/:projectId/drill', drill);
