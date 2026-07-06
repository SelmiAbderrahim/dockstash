// English copy for the InfluxDB guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.influxdb walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const INFLUXDB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs InfluxDB',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your InfluxDB service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that InfluxDB was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the influxdb image and its major version, and adds a database layer with the right backup command — influx backup for v2, influxd backup -portable for v1 — plus the container name it resolved and the env keys it found (DOCKER_INFLUXDB_INIT_USERNAME, DOCKER_INFLUXDB_INIT_PASSWORD, DOCKER_INFLUXDB_INIT_ORG). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the backup command by hand',
      body: 'If you want proof before automating, run influx backup into a temporary path inside the container. You should see it write shard and metadata files as it snapshots each bucket through the HTTP API — that engine-coordinated snapshot is what gets backed up, never the live TSM directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Time-series data accumulates fast, so daily is the right default — hourly if your metrics are business-critical. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash runs the version-correct backup command inside the running container — influx backup through the HTTP API on v2, influxd backup -portable on v1 — and streams the snapshot straight into restic. You can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'An InfluxDB backup is only real once it has restored. Dockstash restores never overwrite your live time-series data by default — you restore to a fresh location first, check the buckets, and promote them deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row is a consistent engine-level snapshot of your TSM shards and metadata — buckets, retention policies, and users — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The backup files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Load the restored backup into a scratch InfluxDB container with influx restore (or influxd restore -portable on v1), then list the buckets. Every bucket you expect should appear with its retention policy; run a quick query against a recent time range to confirm the newest points made it in.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The backup command errors with "unknown command" or unrecognized flags.',
      cause: 'The v1 and v2 command lines are completely different: v2 uses influx backup against the HTTP API, v1 uses influxd backup -portable. Running one generation’s command against the other fails immediately — common after upgrading the image tag.',
      fix: 'Check which major version the container runs (influxd version), then use the matching command. Dockstash detects the major version from the image and picks the right one automatically; re-run detection on the Plan tab after an upgrade.',
    },
    {
      symptom: 'influx backup fails with "unauthorized" or a 401 from the API.',
      cause: 'v2 backups go through the HTTP API and require an operator (all-access) token. A regular read token — or no token at all when auth is enabled — is not enough.',
      fix: 'Supply an operator token with read access to the buckets. If you used the DOCKER_INFLUXDB_INIT_* env keys, the init admin token works; otherwise create one with influx auth create --all-access and add it to the plan’s credentials.',
    },
    {
      symptom: 'A backup made by copying /var/lib/influxdb2 will not start, or queries return partial data.',
      cause: 'InfluxDB compacts TSM shards in the background. A raw copy of the live directory catches shards mid-compaction — some files from before, some from after — producing a torn, inconsistent store.',
      fix: 'Never copy the live data directory. Use the engine’s backup command, which snapshots shards and metadata consistently — this is what Dockstash runs. A torn raw copy is generally unrecoverable; restore from a proper backup instead.',
    },
  ],
  gotchas: [
    'Never restic the live TSM/WAL directory — shards are compacted in the background so a raw copy is inconsistent.',
    'InfluxDB v2 uses `influx backup` (HTTP API + token); v1 uses `influxd backup -portable`. Dockstash detects the major version.',
    'v2 backups need an operator token with read access; without it the backup call is unauthorized.',
  ],
  faq: [
    {
      question: 'What command backs up InfluxDB correctly?',
      answer:
        'For v2, `influx backup` against the HTTP API with an operator token. For v1, `influxd backup -portable`. Both snapshot TSM shards and metadata consistently. Dockstash detects the version and runs the right one.',
    },
    {
      question: 'Can I copy the shard files directly?',
      answer:
        'No. InfluxDB compacts TSM shards in the background, so a live directory copy is inconsistent. Use the backup command, which coordinates a consistent snapshot through the engine.',
    },
    {
      question: 'What token does the v2 backup need?',
      answer:
        'An operator (all-access) token with read permission on the buckets. Dockstash detects the init token env keys; supply a token if auth is enabled.',
    },
    {
      question: 'How do I restore a time series backup?',
      answer:
        'Use `influx restore` (v2) or `influxd restore -portable` (v1) against a fresh instance. Dockstash restores to a staging instance first before any overwrite.',
    },
    {
      question: 'How often should I back up InfluxDB?',
      answer:
        'Daily works for most metrics workloads; go hourly if losing an hour of points would hurt. On the Free tier backups are manual Backup Now runs; Pro adds scheduled backups up to hourly, and Business allows any cron expression. Pair the schedule with a weekly restore drill for standing proof.',
    },
    {
      question: 'Does backing up block writes to InfluxDB?',
      answer:
        'No. The backup command snapshots shards through the engine while the server keeps accepting writes — your collectors and dashboards keep running during the backup.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and checks the restored dump — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
