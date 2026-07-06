// English copy for the MySQL guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.mysql walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const MYSQL_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs MySQL',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your MySQL service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that MySQL was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the mysql image, and adds a database layer with the right dump command — plus the container name it resolved and the env keys it found (MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the dump by hand',
      body: 'If you want proof before automating, run the same dump Dockstash will run. You should see SQL stream out — CREATE DATABASE, CREATE TABLE, and INSERT statements. That output is what gets backed up, never the live /var/lib/mysql directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most MySQL projects. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash executes mysqldump with --single-transaction, --routines, and --triggers inside the running container and streams the dump straight into restic — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A MySQL backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a complete single-point-in-time dump of every database on the server — schemas, data, routines, and triggers — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The dump and files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Load the restored dump into a scratch MySQL container, then run SHOW DATABASES to confirm every schema came back, and spot-check the tables your app depends on. Row counts and recent records are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The dump fails with "Access denied for user \'root\'@\'localhost\'".',
      cause: 'The MYSQL_ROOT_PASSWORD in compose no longer matches the password inside the data volume — the env var only sets the password on first initialization, so changing it later in compose does nothing to an existing volume.',
      fix: 'Use the password the volume was initialized with, or reset the root password inside the container, then align the compose env so detection and the dump agree.',
    },
    {
      symptom: 'The dump completes but some tables are inconsistent after restore.',
      cause: 'Those tables are MyISAM. --single-transaction only guarantees a consistent snapshot for transactional InnoDB tables; MyISAM tables are read outside that guarantee.',
      fix: 'Check the engine with SHOW TABLE STATUS. Migrate MyISAM tables to InnoDB (ALTER TABLE ... ENGINE=InnoDB) — the durable fix — or accept a brief lock with --lock-tables for those tables.',
    },
    {
      symptom: 'Restore into a scratch container errors with "Unknown collation: utf8mb4_0900_ai_ci".',
      cause: 'The dump came from MySQL 8.x but you are restoring into a 5.7 image; 8.0 default collations do not exist in older servers.',
      fix: 'Restore into the same major version the dump came from (e.g. mysql:8). Restoring older dumps into newer servers works; the reverse frequently does not.',
    },
    {
      symptom: 'A backup run fails with a stale restic lock after a crash or reboot.',
      cause: 'A previous job died mid-run and left the repository locked.',
      fix: 'Nothing to do manually: the next run detects the orphaned lock and runs restic unlock automatically before proceeding. If runs keep failing, check the live log panel for the underlying error.',
    },
  ],
  gotchas: [
    'Never restic the live /var/lib/mysql directory — InnoDB tablespaces copied mid-write are inconsistent and will fail recovery.',
    '--single-transaction only gives a consistent snapshot for transactional (InnoDB) tables; MyISAM tables are not covered and need a lock.',
    'Add --routines and --triggers or stored procedures and triggers are silently dropped from the dump.',
  ],
  faq: [
    {
      question: 'Why is --single-transaction important?',
      answer:
        'Without it, mysqldump reads tables one at a time and a write between tables produces an inconsistent dump. --single-transaction wraps everything in one InnoDB transaction so the whole dump reflects a single point in time, with no write lock.',
    },
    {
      question: 'Does the dump include stored procedures and triggers?',
      answer:
        'Only if you pass --routines and --triggers, which Dockstash includes. A default mysqldump omits them, which is a common cause of a "restored but broken" database.',
    },
    {
      question: 'Can I back up MySQL by copying /var/lib/mysql?',
      answer:
        'No. The InnoDB tablespace and redo logs are written continuously; a file copy mid-write is inconsistent. Dockstash runs mysqldump inside the container instead.',
    },
    {
      question: 'What if I use MyISAM tables?',
      answer:
        '--single-transaction does not make MyISAM consistent because it is non-transactional. If you rely on MyISAM, a brief lock (--lock-tables) is required — migrating those tables to InnoDB is the durable fix.',
    },
    {
      question: 'How often should I back up MySQL?',
      answer:
        'Daily is the practical default for most projects; hourly if losing a day of writes is unacceptable. On the Free tier backups are manual only; Pro allows schedules up to hourly, Business any cron. Pair the schedule with a weekly restore drill so every week you get proof the backup actually restores.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and row-diffs the restored dump — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
