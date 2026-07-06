// English copy for the PostgreSQL guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.postgres walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const POSTGRES_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs PostgreSQL',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your PostgreSQL service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that PostgreSQL was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the postgres image, and adds a database layer with the right dump command — plus the container name it resolved and the env keys it found (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the dump by hand',
      body: 'If you want proof before automating, run the same dump Dockstash will run. You should see SQL statements stream out — that output is what gets backed up, never the live data directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most PostgreSQL projects. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash executes pg_dumpall inside the running container and streams the dump straight into restic — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A PostgreSQL backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a complete consistent dump of every database in the cluster, plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The dump and files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Load the restored dump into a scratch PostgreSQL container with psql, then list databases and spot-check the tables your app depends on. Row counts and recent records are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The dump fails with "role does not exist" or authentication errors.',
      cause: 'The POSTGRES_USER env value in compose does not match a role inside the database — common after a manual role rename or a volume restored from another project.',
      fix: 'Run psql inside the container and check \\du for real roles, then align the compose env (or the plan’s dump credentials) with an existing superuser role.',
    },
    {
      symptom: 'The restored SQL errors with "extension ... is not available".',
      cause: 'The dump references CREATE EXTENSION (PostGIS, pgvector, …) but the restore-target image does not ship those extension binaries.',
      fix: 'Restore into the same image your production service uses (e.g. postgis/postgis or pgvector/pgvector builds), not a vanilla postgres image.',
    },
    {
      symptom: 'Backups suddenly take much longer or the repo grows fast.',
      cause: 'pg_dumpall output changes wholesale when large tables churn, reducing restic deduplication.',
      fix: 'Keep the schedule daily and let prune + retention trim history; for very large clusters, verify retention (keep daily/weekly/monthly) is actually pruning by checking the repo size trend on the project card.',
    },
    {
      symptom: 'A backup run fails with a stale restic lock after a crash or reboot.',
      cause: 'A previous job died mid-run and left the repository locked.',
      fix: 'Nothing to do manually: the next run detects the orphaned lock and runs restic unlock automatically before proceeding. If runs keep failing, check the live log panel for the underlying error.',
    },
  ],
  gotchas: [
    'Never restic the live /var/lib/postgresql/data directory — a heap page copied mid-write is torn and unrestorable.',
    'pg_dumpall captures roles and all databases; a single pg_dump misses global objects like roles and tablespaces.',
    'Extensions (PostGIS, pgvector) must be installed in the target image before restore or the SQL will error.',
  ],
  faq: [
    {
      question: 'Why pg_dumpall instead of copying the data directory?',
      answer:
        'A live Postgres data directory is being written to constantly. Copying it captures a torn, inconsistent state that will not start. pg_dumpall reads a consistent MVCC snapshot from the running server, producing a dump that restores cleanly.',
    },
    {
      question: 'Does Dockstash lock the database during backup?',
      answer:
        'No. pg_dumpall uses MVCC snapshots, so reads are consistent without blocking writes. Your application keeps serving traffic during the dump.',
    },
    {
      question: 'How often should I back up PostgreSQL?',
      answer:
        'Daily is the practical default for most projects; hourly if losing a day of writes is unacceptable (Pro allows hourly, Business any cron). Pair the backup schedule with a weekly restore drill so every week you get proof the backup actually restores.',
    },
    {
      question: 'How do I restore a single database instead of all of them?',
      answer:
        'A pg_dumpall archive is plain SQL; you can restore the whole cluster with psql, or use per-database pg_dump/pg_restore if you only need one. Dockstash restores the full consistent snapshot by default.',
    },
    {
      question: 'What about extensions like PostGIS or pgvector?',
      answer:
        'The dump references CREATE EXTENSION but does not ship the extension binaries. Make sure the restore-target image has the same extensions available before restoring.',
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
