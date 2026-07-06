// English copy for the Neo4j guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.neo4j walkthrough/restoreVerify ids.
// Note: neo4j's 'test-dump' and 'verify-data' steps carry no command —
// Community-edition dumps need the database stopped, so the bodies explain
// the safe pattern instead of a live one-liner.

import type { ServiceGuideCopy } from '../../types';

export const NEO4J_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs Neo4j',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your Neo4j service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that Neo4j was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the neo4j image, and records the container it resolved plus the env keys it found (NEO4J_AUTH, NEO4J_PLUGINS). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Understand how the Neo4j dump works',
      body: 'Neo4j is the one engine where edition matters. Enterprise supports hot online backups with neo4j-admin database backup while the database keeps serving. Community requires the database stopped for neo4j-admin database dump — so the safe pattern is a brief scheduled stop at a quiet hour, or dumping a secondary instance. Dockstash captures the resulting dump artifact, never the live /data directory.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). For Community-edition Neo4j, schedule the backup at your quietest hour to keep the brief dump window painless. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash captures the graph dump and the project files and streams everything into restic — you can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A Neo4j backup is only real once it has loaded back into a graph you can query. Dockstash restores never overwrite your live database by default — you restore to a fresh location first, load it into a scratch instance, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row holds a consistent neo4j-admin dump artifact plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The dump artifact and files land in the target path you choose, leaving the live project untouched.',
      },
      'verify-data': {
        title: 'Load and verify the restored graph',
        body: 'Start a scratch Neo4j container (same image and plugins as production), load the dump with neo4j-admin database load against the stopped target, start it, and spot-check with a few Cypher queries — node and relationship counts on your core labels are the quickest truth test.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored graph checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The dump step fails with "database is in use" on Community edition.',
      cause: 'neo4j-admin database dump requires the database stopped on Community; a live dump is not supported.',
      fix: 'Schedule the backup at a quiet hour with a brief stop, dump a secondary instance, or move to Enterprise for hot online backups with neo4j-admin database backup.',
    },
    {
      symptom: 'The restored database starts but queries relying on APOC or GDS fail.',
      cause: 'Plugins are part of the image and config, not the database dump — the restore-target image does not ship them.',
      fix: 'Restore into an image with the same NEO4J_PLUGINS (APOC, GDS) installed before loading the dump, then re-run the failing procedures.',
    },
    {
      symptom: 'neo4j-admin database load refuses to overwrite the target.',
      cause: 'The load command will not replace an existing database unless explicitly told to, and the target must be stopped.',
      fix: 'Stop the target database and pass --overwrite-destination=true (exactly what the documented restore command does), then start Neo4j.',
    },
    {
      symptom: 'Backups are much larger than the graph seems to warrant.',
      cause: 'The dump includes the full store; transaction log churn between dumps also reduces restic deduplication.',
      fix: 'Keep dumps on a daily schedule and rely on prune + retention to trim history; check the repo size trend on the project card to confirm retention is working.',
    },
  ],
  gotchas: [
    'On Community edition, `neo4j-admin database dump` requires the database to be stopped — dumping a live store is not supported and copying /data live is inconsistent.',
    'Enterprise edition supports online hot backups via `neo4j-admin database backup`; Community must schedule a brief stop or dump a secondary.',
    'The Bolt port (7687) is for clients; backups run through neo4j-admin inside the container, not over Bolt.',
  ],
  faq: [
    {
      question: 'Can I back up Neo4j without stopping it?',
      answer:
        'On Enterprise, yes — use `neo4j-admin database backup` for an online hot backup. On Community, the `database dump` command needs the database stopped, so Dockstash schedules a brief stop or dumps a replica.',
    },
    {
      question: 'Why not copy the /data/databases directory?',
      answer:
        'The graph store and transaction logs are written continuously. A live copy is inconsistent and may not load. neo4j-admin dump/backup produce a consistent, restorable artifact.',
    },
    {
      question: 'How do I restore a Neo4j dump?',
      answer:
        'Use `neo4j-admin database load ... --overwrite-destination=true` against a stopped target, then start Neo4j. Dockstash loads into a staging database before any overwrite.',
    },
    {
      question: 'Does the backup include installed plugins?',
      answer:
        'No — plugins (APOC, GDS) are part of the image/config, not the database dump. Ensure the restore-target image has the same plugins before loading.',
    },
    {
      question: 'How often should I back up Neo4j?',
      answer:
        'Daily is the practical default — pick your quietest hour if you run Community and need the brief stop window. Free runs manual backups only; Pro allows up to hourly schedules and Business any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. The dump artifact is encrypted before it leaves your server, and the repository password never leaves your hands.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and verifies the captured dump — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
