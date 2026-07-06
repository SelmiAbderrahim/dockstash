// English copy for the Elasticsearch guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.elasticsearch walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const ELASTICSEARCH_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs Elasticsearch',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your Elasticsearch service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that Elasticsearch was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the elasticsearch image, and adds a database layer built on the snapshot API — plus the container name it resolved and the env keys it found (ELASTIC_PASSWORD, ELASTICSEARCH_USERNAME, discovery.type). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the cluster by hand',
      body: 'If you want proof before automating, curl the _cluster/health endpoint inside the container. A green or yellow status means the cluster is ready to snapshot (yellow is normal for a single node — replica shards have nowhere to go). Red means at least one primary shard is down; fix that before backing up.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage. Elasticsearch itself also needs a registered snapshot repository — a filesystem path (a bind-mounted directory is simplest) or an object store — that the snapshot API writes into and Dockstash restics off-site.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily is the right default for most search clusters — snapshots are incremental within the repository, so each run only stores new segments. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash triggers a snapshot through the snapshot API (PUT _snapshot/<repo>/<snap>) so Elasticsearch writes a consistent point-in-time view of each index into the repository, then restics that directory to your storage VPS — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'An Elasticsearch backup is only real once it has restored. Dockstash restores never overwrite your live cluster by default — you restore to a fresh location first, check the indices, and promote deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row contains the snapshot repository with a consistent point-in-time view of every index, plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The repository lands in the target path you choose, leaving the live cluster untouched. Register it in a scratch Elasticsearch container and POST _snapshot/<repo>/<snap>/_restore.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Curl _cat/indices?v against the scratch node and read the table: every index you expect should be listed with a green or yellow health, an open status, and a docs.count that matches production. Spot-check a few documents with a search query.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored indices check out, point your app at the scratch cluster (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Snapshot calls fail with repository_missing_exception or a repository verification error.',
      cause: 'No snapshot repository is registered, or the path is not listed in path.repo / not writable from inside the container.',
      fix: 'Bind-mount a directory into the container, add it to path.repo in elasticsearch.yml, restart, and register it with PUT _snapshot/<repo> as an fs repository. Snapshots only work against a registered, verified repository.',
    },
    {
      symptom: 'Restore is rejected with "cannot restore index ... because an open index with same name already exists".',
      cause: 'The snapshot API refuses to restore into an index that is currently open — it will not silently merge or overwrite live data.',
      fix: 'Close or delete the existing index first, or restore under a different name with the rename_pattern/rename_replacement options. Restoring into a scratch node avoids the collision entirely.',
    },
    {
      symptom: 'The cluster health is red and snapshots come back partial or fail outright.',
      cause: 'At least one primary shard is unassigned; a snapshot cannot capture shards that are not available.',
      fix: 'Diagnose with _cluster/allocation/explain and bring the primaries back (disk watermark, node down, corrupt shard) before backing up. A yellow single-node cluster is fine; red is not.',
    },
  ],
  gotchas: [
    'Never restic the live data directory — Lucene segments are written and merged continuously, so a file copy is inconsistent.',
    'You must register a snapshot repository (a shared fs path or object store) before the first snapshot; a bind-mounted path shared with the container is the simplest fs repo.',
    'Restoring an index that already exists requires closing or deleting it first, or the restore is rejected.',
  ],
  faq: [
    {
      question: 'Why use the snapshot API instead of copying the data folder?',
      answer:
        'Elasticsearch writes and merges Lucene segments constantly, so a live directory copy is inconsistent and may not open. The snapshot API captures a consistent, incremental point-in-time view of each index.',
    },
    {
      question: 'How do I register a snapshot repository?',
      answer:
        'Configure a filesystem repository pointing at a path both Elasticsearch and Dockstash can read (or an object store), then register it with a PUT _snapshot call. Dockstash restics that repository directory.',
    },
    {
      question: 'Are Elasticsearch snapshots incremental?',
      answer:
        'Yes. Within a repository, each snapshot only stores segments not already present, so repeated snapshots are cheap. restic deduplication compounds this.',
    },
    {
      question: 'Does this work for OpenSearch too?',
      answer:
        'Yes — OpenSearch forked from Elasticsearch and uses the same snapshot API model. Register a repository and snapshot the same way.',
    },
    {
      question: 'How often should I back up Elasticsearch?',
      answer:
        'Daily is the practical default — snapshots are incremental within the repository, so daily runs stay cheap even on big indices. On the Free plan backups are manual only (Backup Now); Pro unlocks schedules up to hourly, and Business allows any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and checks the restored backup output — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
