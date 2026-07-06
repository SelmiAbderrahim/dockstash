// English copy for the MinIO guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.minio walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const MINIO_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs MinIO',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your MinIO service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that MinIO was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the minio/minio image, and adds an object-store layer built around mc mirror — plus the container name it resolved and the env keys it found (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, or the legacy MINIO_ACCESS_KEY / MINIO_SECRET_KEY pair). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the bucket listing by hand',
      body: 'If you want proof before automating, run mc ls against the local alias inside the container. You should see every bucket listed with its size and object count — those buckets are exactly what mc mirror will copy out through the S3 API, object by object, never the raw /data directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily at a quiet hour is the right default for most object stores — mirrors are incremental, so subsequent runs only copy what changed. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash runs mc mirror inside the container to copy each bucket out through the S3 API — capturing every object atomically with its metadata — and streams the result into restic. You can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A MinIO backup is only real once it has restored. Dockstash restores never overwrite your live buckets by default — you restore to a fresh location first, check the objects, and promote them deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a complete API-level mirror of your buckets — every object with its metadata and tags — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The mirrored buckets and files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored objects',
        body: 'Mirror the restored bucket into a scratch MinIO instance, then list its contents with mc ls. Compare object counts and total size against the live bucket, and spot-check a few objects your app actually serves — a download that opens correctly is the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored objects check out, point your app at them (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'A restored /data directory copy will not serve objects, or MinIO logs xl.meta errors on startup.',
      cause: 'The backup was made by copying the raw /data directory instead of mirroring through the S3 API. MinIO stores each object alongside xl.meta metadata files, and a raw copy that misses or tears them leaves objects unreadable.',
      fix: 'Back up with mc mirror through the S3 API — the approach Dockstash configures by default. If you inherited a raw-copy backup, restore it into a stopped MinIO of the same version and verify every bucket with mc ls before trusting it.',
    },
    {
      symptom: 'Some recently uploaded objects are missing from the backup.',
      cause: 'They were in-flight multipart uploads when the mirror ran — incomplete uploads are invisible to the S3 listing until the final part lands, and a raw file copy would capture them as unusable fragments.',
      fix: 'Nothing is corrupt: the next scheduled mirror picks up the completed objects. If a specific upload matters, re-run Backup Now after it completes, or schedule backups outside your heavy upload windows.',
    },
    {
      symptom: 'A versioned bucket restores with only one version of each object.',
      cause: 'A plain mc mirror copies the current state of each object — older versions are not replicated unless versions are mirrored explicitly.',
      fix: 'If you rely on bucket versioning for point-in-time recovery, mirror versions explicitly (mc mirror with version replication) or treat the Dockstash snapshot timeline itself as your version history — each daily snapshot preserves that day’s object state.',
    },
    {
      symptom: 'mc commands fail with "Access Denied" or "invalid credentials".',
      cause: 'The credentials in compose changed (for example rotating MINIO_ROOT_USER / MINIO_ROOT_PASSWORD) but the container’s configured mc alias still holds the old pair.',
      fix: 'Recreate the container so the alias is rebuilt from the current env, or re-run mc alias set inside the container with the new credentials, then re-run the backup.',
    },
  ],
  gotchas: [
    'Prefer mc mirror over copying the raw /data directory — MinIO stores objects plus xl.meta metadata, and a raw copy can miss in-flight multipart uploads.',
    'Mirror through the S3 API so object metadata, versions, and tags are preserved consistently.',
    'For versioned buckets, replicate versions explicitly or you capture only the latest object state.',
  ],
  faq: [
    {
      question: 'Should I back up MinIO with mc mirror or a file copy?',
      answer:
        'Use mc mirror. It reads objects through the S3 API so each object and its metadata are captured atomically. A raw /data copy can catch in-flight multipart uploads or miss metadata layout.',
    },
    {
      question: 'Does mc mirror preserve versions and tags?',
      answer:
        'It preserves object metadata and tags. For versioned buckets you need to mirror versions explicitly, otherwise only the current version of each object is captured.',
    },
    {
      question: 'Can I restore into a fresh MinIO instance?',
      answer:
        'Yes. Point mc at the new instance, create the target bucket, and mirror the backup directory back. Dockstash restics the mirrored objects between steps.',
    },
    {
      question: 'Is copying /data ever acceptable?',
      answer:
        'Only with MinIO fully stopped and no writes in flight, and even then metadata layout must be preserved exactly. The API-level mirror is the safer, supported approach.',
    },
    {
      question: 'How often should I back up MinIO?',
      answer:
        'Daily is the practical default — mc mirror is incremental, so quiet days cost almost nothing. On the Free tier backups are manual Backup Now runs; Pro adds scheduled backups up to hourly, and Business allows any cron expression. Pair the schedule with a weekly restore drill for standing proof.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your objects on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace and byte-hashes every restored file against the source — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof your buckets come back.',
    },
  ],
};
