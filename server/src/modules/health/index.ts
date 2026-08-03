export {
  runHealthCheck,
  pingRedis,
  redisProbe,
  type HealthCheckResult,
  type HealthDeps,
  type RedisPingClient,
  type RedisClientFactory,
} from './health.service.js';
export {
  healthRouter,
  projectHealthRouter,
  backupHealthRouter,
} from './health.routes.js';
export {
  configureHealthController,
  resetHealthController,
} from './health.controller.js';
export {
  getHealthOverview,
  getProjectHealth,
  listAlerts,
  markAlertsRead,
  recordAlert,
  serializeAlert,
  ALERTS_PAGE_SIZE,
  type HealthOverview,
  type ProjectHealthEntry,
  type PublicAlert,
  type RecordAlertInput,
} from './health.backup-health.service.js';
export {
  computeProjectHealth,
  worstStatus,
  HEALTH_STATUSES,
  type HealthStatus,
  type ProjectHealthSignals,
  type ProjectHealthVerdict,
} from './health.rules.js';
export {
  Alert,
  ALERT_EVENT_KINDS,
  ALERT_SEVERITIES,
  type AlertDocument,
  type AlertHydrated,
  type AlertEventKind,
  type AlertSeverity,
} from './health.model.js';
