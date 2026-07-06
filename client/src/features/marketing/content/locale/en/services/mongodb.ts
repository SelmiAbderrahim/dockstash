// English copy for the MongoDB guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.mongodb walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const MONGODB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs MongoDB',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your MongoDB service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that MongoDB was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the mongo image, and adds a database layer with the right dump command — plus the container name it resolved and the env keys it found (MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_DATABASE). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the dump by hand',
      body: 'If you want proof before automating, run the same dump Dockstash will run — mongodump writing a single archive to stdout, piped through a byte counter. A large, non-zero byte count is your proof the archive streams cleanly. That archive is what gets backed up, never the live /data/db directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most MongoDB projects. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash executes mongodump with --archive and --oplog inside the running container and streams the archive straight into restic — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A MongoDB backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh staging location first, replay the archive there, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a complete mongodump archive — every database and collection, plus the oplog entries captured during the dump — alongside the project files from the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The archive and files land in the target path you choose; feed the archive to mongorestore with --oplogReplay and --drop in a staging container, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'In the scratch container, list the databases with mongosh and confirm every database came back, then spot-check the collections your app depends on. Document counts and recent records are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The dump fails with "--oplog mode only supported on replica set members" (or similar).',
      cause: 'Your mongod runs standalone. --oplog needs an oplog to read, and only replica-set members keep one — on a standalone server there is nothing to capture.',
      fix: 'Convert to a single-node replica set: start mongod with --replSet rs0 and run rs.initiate() once. Same container, same data, and you gain the point-in-time guarantee.',
    },
    {
      symptom: 'mongodump fails with "Authentication failed" even though compose sets MONGO_INITDB_ROOT_USERNAME.',
      cause: 'The MONGO_INITDB_* env vars only create the user on first initialization of an empty /data/db volume. If the volume already existed, or the credentials were changed later, the compose values no longer match reality.',
      fix: 'Authenticate with the credentials that actually exist in the database (check with mongosh), or recreate the user, then align the compose env so detection and the dump agree.',
    },
    {
      symptom: 'mongorestore into a scratch container fails with an unsupported-version or invalid-archive error.',
      cause: 'The archive came from a newer server or newer mongodump than the restore target understands — restoring a mongo:7 archive into mongo:5 is not supported.',
      fix: 'Restore into the same major version the dump came from (e.g. mongo:7), and keep mongodump/mongorestore from the same Database Tools release. Upgrading across versions is done by the server after restore, not by mongorestore.',
    },
    {
      symptom: 'A backup run fails with a stale restic lock after a crash or reboot.',
      cause: 'A previous job died mid-run and left the repository locked.',
      fix: 'Nothing to do manually: the next run detects the orphaned lock and runs restic unlock automatically before proceeding. If runs keep failing, check the live log panel for the underlying error.',
    },
  ],
  gotchas: [
    'Never restic the live /data/db WiredTiger files — copied mid-checkpoint they are inconsistent and often unrecoverable.',
    '--oplog requires the server to be a replica-set member (even a single-node replica set); on a standalone mongod it is a no-op with no point-in-time guarantee.',
    'On restore, --oplogReplay must accompany --oplog dumps or the point-in-time consistency is lost.',
  ],
  faq: [
    {
      question: 'What does --oplog actually do?',
      answer:
        'It records the operations log entries that occur while mongodump runs and stores them in the archive. On restore, --oplogReplay applies them so the dump reflects a single consistent point in time rather than a smear across the dump window.',
    },
    {
      question: 'Do I need a replica set for consistent backups?',
      answer:
        'For point-in-time consistency, yes — --oplog only works on a replica-set member. Many single-node deployments run as a one-member replica set specifically to get this guarantee.',
    },
    {
      question: 'Why not copy /data/db directly?',
      answer:
        'WiredTiger writes checkpoints continuously. A file copy mid-checkpoint captures an inconsistent state that frequently will not start. mongodump reads a logical, restorable snapshot.',
    },
    {
      question: 'How do I restore into a clean database?',
      answer:
        'mongorestore --archive --oplogReplay --drop drops existing collections before restoring so you do not merge old and new data. Dockstash restores to a staging target first by default.',
    },
    {
      question: 'How often should I back up MongoDB?',
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
