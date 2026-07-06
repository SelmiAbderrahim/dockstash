// English copy for the SQLite guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.sqlite walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const SQLITE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that embeds SQLite',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project whose app stores its data in a SQLite file — PocketBase, Vaultwarden, Uptime Kuma, Gitea, and Ghost all do. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that SQLite was detected',
      body: 'Open the project and look at the Plan tab. SQLite has no dedicated container — it lives inside your app’s image — so Dockstash finds it through the env keys that point at the database file (DATABASE_PATH, DATABASE_URL, DB_PATH) and adds a database layer that snapshots it with the online backup API. You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the backup by hand',
      body: 'If you want proof before automating, run the same command Dockstash will run: sqlite3 /data/app.db ".backup \'/tmp/app-backup.db\'" inside the app container. It prints nothing on success and leaves a complete, consistent copy at /tmp/app-backup.db — WAL contents included. That copy is what gets backed up, never the live .db file.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most SQLite-backed apps. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash runs the .backup command inside the app container to produce a consistent copy of the database, then streams that copy — together with the project files — into restic. You can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A SQLite backup is only real once it has restored. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row contains a consistent single-file copy of the database — produced through the online backup API, so there are no -wal or -shm sidecars to reconcile — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The database copy and files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Run sqlite3 <restored-file> "PRAGMA integrity_check;" — a healthy database answers with a single "ok". Then open the file with sqlite3 and spot-check the tables your app depends on: row counts and the most recent records are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, stop the app, replace its database file with the restored copy, and start the app again (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The restored database opens but the most recent rows are missing.',
      cause: 'The backup was a raw copy of only the .db file while the app ran in WAL mode — the newest writes were still sitting in the -wal sidecar and never made it into the copy.',
      fix: 'Never raw-copy a live WAL database. Use sqlite3 ".backup" or VACUUM INTO, which go through the online backup API and fold the WAL into the copy. Dockstash uses the backup API for exactly this reason.',
    },
    {
      symptom: 'The .backup command fails with "database is locked".',
      cause: 'A long-running write transaction (or a stuck writer) holds the database lock, and sqlite3 gave up before it was released.',
      fix: 'Set a busy timeout (sqlite3 -cmd ".timeout 30000" or PRAGMA busy_timeout) so the backup waits instead of failing, and schedule backups at a quiet hour. If the lock never clears, look for a hung writer process in the app container.',
    },
    {
      symptom: 'PRAGMA integrity_check on a copied file reports "database disk image is malformed".',
      cause: 'The file was copied while the app was writing to it — a torn page capture that no repair tool reliably fixes.',
      fix: 'Discard the torn copy and restore from a snapshot produced by the backup API. Every Dockstash snapshot is taken with ".backup", so integrity_check should return "ok" — that is what the verify step checks.',
    },
    {
      symptom: 'You ran PRAGMA wal_checkpoint(TRUNCATE) before a raw copy, but the copy is still inconsistent.',
      cause: 'A checkpoint moves WAL pages into the main file at one instant, but writers can add new WAL frames the moment it finishes — a checkpoint before cp is not an atomic snapshot under concurrent writes.',
      fix: 'Treat checkpoint-then-copy as a misconception, not a technique. The only safe live snapshot is the online backup API (".backup" or VACUUM INTO); raw copies are only safe when the app is stopped.',
    },
  ],
  gotchas: [
    'Never copy a live .db file while the app is running under WAL mode — you will miss the -wal/-shm sidecar files and capture a torn, unrestorable database.',
    'Use sqlite3 ".backup" or "VACUUM INTO", both of which use the online backup API and handle WAL correctly.',
    'A checkpoint (PRAGMA wal_checkpoint(TRUNCATE)) before a raw copy is not a substitute for the backup API under concurrent writes.',
  ],
  faq: [
    {
      question: 'Can I just copy the .db file?',
      answer:
        'Not safely while the app is writing. In WAL mode the newest data lives in the -wal sidecar; a plain cp of only the .db captures a stale, torn state. Use sqlite3 ".backup" or "VACUUM INTO" which read a consistent copy through the online backup API.',
    },
    {
      question: 'What is VACUUM INTO?',
      answer:
        'VACUUM INTO \'file.db\' writes a fresh, defragmented, transactionally consistent copy of the database to a new file. It is a clean way to snapshot a live SQLite database without stopping the app.',
    },
    {
      question: 'Do I need to back up the -wal and -shm files?',
      answer:
        'If you use the backup API you do not — it consolidates the WAL into the copy. If you insist on a raw file copy (not recommended live), you must include -wal and -shm, but that is still race-prone.',
    },
    {
      question: 'How do I restore a SQLite backup?',
      answer:
        'Stop the app, replace the database file with the .backup output, and start the app. Because the backup is a single consistent file, there are no sidecars to reconcile.',
    },
    {
      question: 'My app bundles SQLite (PocketBase, Vaultwarden, Uptime Kuma) — will Dockstash find it?',
      answer:
        'Yes. There is no separate SQLite container to spot, so Dockstash reads the app’s compose config and env keys (DATABASE_PATH, DATABASE_URL, DB_PATH) to locate the database file, then snapshots it with the backup API. Review the Plan tab to confirm the detected path before your first run.',
    },
    {
      question: 'How often should I back up SQLite?',
      answer:
        'Daily is the practical default for most single-file apps; hourly if losing a day of writes is unacceptable. On the Free plan backups are manual (Backup Now); Pro allows schedules up to hourly, Business any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and checks the restored database — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
