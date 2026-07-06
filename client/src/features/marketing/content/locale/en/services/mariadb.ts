// English copy for the MariaDB guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.mariadb walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const MARIADB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs MariaDB',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your MariaDB service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that MariaDB was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the mariadb image, and adds a database layer with the right dump command — plus the container name it resolved and the env keys it found (MARIADB_ROOT_PASSWORD, or the legacy MYSQL_ROOT_PASSWORD, plus MARIADB_DATABASE and MARIADB_USER). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the dump by hand',
      body: 'If you want proof before automating, run the same dump Dockstash will run — mariadb-dump with --single-transaction. You should see SQL stream out: CREATE DATABASE, CREATE TABLE, and INSERT statements. That output is what gets backed up, never the live /var/lib/mysql directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most MariaDB projects. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash executes mariadb-dump with --single-transaction, --routines, and --triggers inside the running container and streams the dump straight into restic — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A MariaDB backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, check the data, and promote it deliberately.',
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
        body: 'Load the restored dump into a scratch MariaDB container, then run SHOW DATABASES through the mariadb client to confirm every schema came back, and spot-check the tables your app depends on. Row counts and recent records are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Running the dump by hand fails with "mariadb-dump: command not found".',
      cause: 'Older MariaDB images (10.4 and earlier) only ship the mysqldump binary; mariadb-dump arrived later, with mysqldump kept as a compatibility symlink on new images.',
      fix: 'Use mysqldump with the same flags on older images — the output is identical. Dockstash detects which binary the image provides and calls the right one automatically.',
    },
    {
      symptom: 'The dump fails with "Access denied for user \'root\'@\'localhost\'".',
      cause: 'The root password env key in compose (MARIADB_ROOT_PASSWORD or the legacy MYSQL_ROOT_PASSWORD) no longer matches the password inside the data volume — the env var only sets the password on first initialization.',
      fix: 'Use the password the volume was initialized with, or reset the root password inside the container, then align the compose env so detection and the dump agree.',
    },
    {
      symptom: 'Restoring the dump into a MySQL container errors on syntax.',
      cause: 'MariaDB and MySQL have drifted — MariaDB features like sequences, certain collations, and storage options do not exist in MySQL, so a cross-engine restore can break.',
      fix: 'Restore into a MariaDB image of the same major version the dump came from. Only attempt a MariaDB → MySQL migration deliberately, after cleaning the dump.',
    },
    {
      symptom: 'A backup run fails with a stale restic lock after a crash or reboot.',
      cause: 'A previous job died mid-run and left the repository locked.',
      fix: 'Nothing to do manually: the next run detects the orphaned lock and runs restic unlock automatically before proceeding. If runs keep failing, check the live log panel for the underlying error.',
    },
  ],
  gotchas: [
    'Never restic the live /var/lib/mysql directory — a mid-write InnoDB copy is unrestorable.',
    'Newer images ship mariadb-dump; older ones use mysqldump. Dockstash detects which binary the image provides.',
    'MariaDB accepts either MARIADB_ROOT_PASSWORD or the legacy MYSQL_ROOT_PASSWORD env key, so both are detected.',
  ],
  faq: [
    {
      question: 'Is MariaDB backed up the same way as MySQL?',
      answer:
        'Almost identically. Both use --single-transaction for a consistent InnoDB snapshot. The difference is the client binary: recent MariaDB images ship mariadb-dump (mysqldump is a compatibility symlink). Dockstash picks the right one.',
    },
    {
      question: 'Which root password env key does Dockstash detect?',
      answer:
        'Both MARIADB_ROOT_PASSWORD and the older MYSQL_ROOT_PASSWORD are recognized, since MariaDB images accept either depending on version.',
    },
    {
      question: 'Can I restore a MariaDB dump into MySQL or vice versa?',
      answer:
        'Often, but not always — feature and syntax drift between the two can break edge cases. Restore into the same engine family the dump came from for a reliable result.',
    },
    {
      question: 'Why not just snapshot the volume?',
      answer:
        'The /var/lib/mysql volume is written continuously. A snapshot mid-write is inconsistent. A logical dump via mariadb-dump is the restorable path.',
    },
    {
      question: 'How often should I back up MariaDB?',
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
