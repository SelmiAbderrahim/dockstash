export { superadminRouter } from './superadmin.routes.js';
export {
  configureSuperadminController,
  resetSuperadminController,
  type ConfigureSuperadminControllerDeps,
} from './superadmin.controller.js';
export {
  seedSuperadmin,
  type SeedSuperadminResult,
  type SeedSuperadminCreds,
} from './superadmin.seed.js';
export {
  collectStats,
  listUsers,
  changeUserRole,
  verifyUserEmail,
  setLegalHold,
  scheduleUserDeletion,
  getBillingOverview,
  listGlobalAudit,
  getSystemSummary,
  toAdminUser,
  type AdminUser,
  type SuperadminStats,
  type ListUsersResult,
  type BillingOverview,
  type GlobalAuditResult,
  type SystemSummary,
} from './superadmin.service.js';
