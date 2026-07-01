export { legalRouter } from './legal.routes.js';
export {
  configureLegalController,
  resetLegalController,
  type ConfigureLegalControllerDeps,
} from './legal.controller.js';
export {
  exportUserData,
  scheduleAccountDeletion,
  purgeAccount,
  type UserExport,
  type WarningMailer,
  type PurgeQueue,
  type ExportUserDataDeps,
  type ScheduleAccountDeletionDeps,
  type AccountDeletionScheduled,
  type PurgeAccountDeps,
  type PurgeResult,
} from './legal.service.js';
