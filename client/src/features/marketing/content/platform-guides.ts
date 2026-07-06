// Platform guide dataset — the UNIVERSAL facts layer for guides about using
// Dockstash itself (/guides/<slug>). Step ids key into the per-locale copy
// bundles (content/locale/guides.<locale>.ts → platform); titles and
// descriptions live in the `marketing` i18n namespace under
// `guides.platform.<slug>`. Commands are universal and never translated.
//
// Slugs must NEVER match /^backup-.*-docker$/ — that URL shape belongs to the
// database service guides (GuidePage dispatches on it). The `slug: 'x',`
// line format is load-bearing for server/src/modules/seo/seo.parity.test.ts.

import type { PlatformGuide } from '../types';

export const PLATFORM_GUIDES: Record<string, PlatformGuide> = {
  'connect-fleet-agent': {
    slug: 'connect-fleet-agent',
    steps: [
      { id: 'open-fleet' },
      { id: 'register-agent' },
      { id: 'copy-token' },
      {
        id: 'install-agent',
        cmd: 'docker compose -f docker-compose.agent.yml pull\ndocker compose -f docker-compose.agent.yml up -d --force-recreate',
      },
      { id: 'set-project-roots' },
      {
        id: 'verify-online',
        cmd: 'docker compose -f docker-compose.agent.yml ps',
      },
      { id: 'assign-project' },
    ],
    relatedPlatformGuides: ['schedule-backups', 'troubleshooting-backups'],
    relatedServices: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  'schedule-backups': {
    slug: 'schedule-backups',
    steps: [
      { id: 'open-schedule' },
      { id: 'pick-frequency' },
      { id: 'add-prune' },
      { id: 'add-check-drill' },
      { id: 'save-and-watch' },
    ],
    relatedPlatformGuides: ['retention-policy', 'restore-drills'],
    relatedServices: ['postgres', 'mysql', 'mongodb'],
    lastReviewed: '2026-07',
  },

  'restore-a-backup': {
    slug: 'restore-a-backup',
    steps: [
      { id: 'open-snapshots' },
      { id: 'pick-restore-point' },
      { id: 'typed-confirm' },
      { id: 'choose-mode' },
      { id: 'watch-logs' },
      { id: 'validate-result' },
    ],
    relatedPlatformGuides: ['restore-drills', 'storage-destinations'],
    relatedServices: ['postgres', 'sqlite'],
    lastReviewed: '2026-07',
  },

  'restore-drills': {
    slug: 'restore-drills',
    steps: [
      { id: 'schedule-drill' },
      { id: 'run-drill-now' },
      { id: 'read-report' },
      { id: 'fix-failures' },
    ],
    relatedPlatformGuides: ['restore-a-backup', 'schedule-backups'],
    relatedServices: ['postgres', 'mongodb'],
    lastReviewed: '2026-07',
  },

  'notifications-alerts': {
    slug: 'notifications-alerts',
    steps: [
      { id: 'understand-triggers' },
      { id: 'set-heartbeat' },
      { id: 'add-webhook' },
      { id: 'review-audit' },
    ],
    relatedPlatformGuides: ['troubleshooting-backups', 'restore-drills'],
    relatedServices: ['redis', 'mysql'],
    lastReviewed: '2026-07',
  },

  'retention-policy': {
    slug: 'retention-policy',
    steps: [
      { id: 'open-retention' },
      { id: 'choose-keep' },
      {
        id: 'schedule-prune',
        cmd: 'restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6',
      },
      { id: 'verify-prune' },
    ],
    relatedPlatformGuides: ['schedule-backups', 'storage-destinations'],
    relatedServices: ['postgres', 'clickhouse'],
    lastReviewed: '2026-07',
  },

  'storage-destinations': {
    slug: 'storage-destinations',
    steps: [
      { id: 'prepare-vps' },
      { id: 'add-ssh-key' },
      { id: 'save-encryption-password' },
      { id: 'verify-connection' },
      { id: 'plan-recovery' },
    ],
    relatedPlatformGuides: ['retention-policy', 'restore-a-backup'],
    relatedServices: ['minio', 'postgres'],
    lastReviewed: '2026-07',
  },

  'troubleshooting-backups': {
    slug: 'troubleshooting-backups',
    steps: [
      { id: 'check-status' },
      { id: 'read-live-logs' },
      { id: 'stale-lock' },
      {
        id: 'agent-offline',
        cmd: 'docker compose -f docker-compose.agent.yml ps',
      },
      { id: 'heartbeat-alerts' },
    ],
    relatedPlatformGuides: ['connect-fleet-agent', 'notifications-alerts'],
    relatedServices: ['mysql', 'mongodb'],
    lastReviewed: '2026-07',
  },
};

export function getPlatformGuide(slug: string): PlatformGuide | undefined {
  return PLATFORM_GUIDES[slug];
}

export const PLATFORM_GUIDE_SLUGS: string[] = Object.keys(PLATFORM_GUIDES);
