import { Router } from 'express';
import {
  getRetention,
  getStorage,
  postStorageTest,
  putEncryptionPassword,
  putRetention,
  putStorage,
} from './settings.controller.js';

// Auth + email-verification gating is applied at the mount point in app.ts.
export const settingsRouter: Router = Router();

settingsRouter.get('/storage', getStorage);
settingsRouter.put('/storage', putStorage);
settingsRouter.post('/storage/test', postStorageTest);
settingsRouter.get('/retention', getRetention);
settingsRouter.put('/retention', putRetention);
settingsRouter.put('/encryption-password', putEncryptionPassword);
