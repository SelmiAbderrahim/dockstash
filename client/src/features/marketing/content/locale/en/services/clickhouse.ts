// English copy for the ClickHouse guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.clickhouse walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const CLICKHOUSE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs ClickHouse',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your ClickHouse service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that ClickHouse was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the clickhouse/clickhouse-server image, and adds a database layer with the right backup command — plus the container name it resolved and the env keys it found (CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DB). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the server by hand',
      body: 'If you want proof before automating, run clickhouse-client with SHOW DATABASES inside the container. You should see your databases listed (default, system, and any your app created) — those are what the native BACKUP DATABASE statement will snapshot as consistent table parts.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most analytics workloads — ClickHouse data usually arrives in bulk, so hourly rarely buys much. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash runs the native BACKUP DATABASE statement inside the running container to produce a consistent snapshot of table parts, then restics the result to your storage VPS — you can watch the live restic output line by line in the log panel while it runs. The first run on a large MergeTree table can take a while; later runs deduplicate against it.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A ClickHouse backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a consistent BACKUP of your ClickHouse database — frozen table parts, not a torn file copy — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The backup lands in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Run RESTORE DATABASE into a scratch ClickHouse container, then query it: SELECT count() FROM system.tables tells you the tables came back, and a count() on your biggest MergeTree table against production is the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'BACKUP DATABASE fails with an error about an unknown or missing disk.',
      cause: 'The native BACKUP statement writes to a named backup disk, and no backup disk is declared in the server configuration.',
      fix: 'Add a backups disk under <storage_configuration> (or a <backups> allowed-disk entry) in the ClickHouse config and restart, or switch to the clickhouse-backup tool, which freezes parts via hardlinks without needing a configured disk.',
    },
    {
      symptom: 'A raw copy of /var/lib/clickhouse restores into a server that reports broken or missing parts.',
      cause: 'ClickHouse merges and mutates table parts in the background continuously; a file copy taken while merges run captures directories mid-rewrite.',
      fix: 'Never copy the live data directory. Use BACKUP DATABASE or clickhouse-backup — both freeze parts to a consistent set first — and let Dockstash restic that output.',
    },
    {
      symptom: 'The first backup is huge and takes far longer than expected.',
      cause: 'Large MergeTree tables mean the initial BACKUP materializes every part once; there is no smaller starting point.',
      fix: 'Let the first run finish — restic deduplication and the BACKUP statement’s incremental mode keep every later run small. Watch progress in the live log panel and check the repository size trend on the project card.',
    },
  ],
  gotchas: [
    'Never restic the live /var/lib/clickhouse/store directory — parts are merged and mutated in the background, so a raw copy is inconsistent.',
    'The BACKUP/RESTORE SQL requires a configured backup disk in the server config; without it, use the clickhouse-backup tool which freezes parts via hardlinks.',
    'Large MergeTree tables produce large backups; incremental restic dedup helps but the initial BACKUP can be sizeable.',
  ],
  faq: [
    {
      question: 'What is the correct way to back up ClickHouse?',
      answer:
        'Use the native BACKUP statement (BACKUP DATABASE ... TO Disk(...)) or the clickhouse-backup tool. Both produce a consistent snapshot of table parts. Dockstash then restics the resulting backup directory.',
    },
    {
      question: 'Can I copy /var/lib/clickhouse instead?',
      answer:
        'No. ClickHouse continuously merges and mutates parts in the background, so a live directory copy is inconsistent. The BACKUP statement or clickhouse-backup freeze the parts safely.',
    },
    {
      question: 'BACKUP statement or clickhouse-backup — which should I use?',
      answer:
        'The native BACKUP statement is simplest when a backup disk is configured. clickhouse-backup is handy for freezing parts via hardlinks and shipping them, especially on older versions. Dockstash supports either output.',
    },
    {
      question: 'Are ClickHouse backups incremental?',
      answer:
        'The BACKUP statement supports incremental backups against a base, and restic adds its own deduplication on top, so repeated snapshots stay compact.',
    },
    {
      question: 'How often should I back up ClickHouse?',
      answer:
        'Daily is the practical default — analytics data usually arrives in bulk, and restic dedup keeps daily snapshots cheap. On the Free plan backups are manual only (Backup Now); Pro unlocks schedules up to hourly, and Business allows any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and checks the restored database output — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
