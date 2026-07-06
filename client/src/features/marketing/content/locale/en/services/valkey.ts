// English copy for the Valkey guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.valkey walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const VALKEY_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs Valkey',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your Valkey service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that Valkey was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the valkey/valkey image, and adds a database layer with the right save-and-capture strategy — plus the container name it resolved and the env keys it found (VALKEY_PASSWORD, VALKEY_ARGS, and the legacy REDIS_PASSWORD). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the snapshot by hand',
      body: 'If you want proof before automating, trigger the same save Dockstash will trigger: run valkey-cli BGSAVE inside the container. Valkey replies "Background saving started", forks, and writes a point-in-time dump.rdb in /data — the same RDB persistence it inherited from Redis. That finished file is what gets backed up, never the live in-memory state.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). For Valkey used as a primary store (queues, sessions), daily is a sane floor and hourly is common. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash triggers a background save, waits for the finished dump.rdb, then backs it up — along with appendonly.aof when AOF persistence is enabled — straight into restic. You can watch the live restic output line by line in the log panel while it runs.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A Valkey backup is only real once it has restored. Dockstash restores never overwrite your live instance by default — you restore to a fresh location first, check the data, and promote it deliberately.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row contains a complete point-in-time dump.rdb (plus the AOF when enabled) and the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The RDB and files land in the target path you choose, leaving the live instance untouched.',
      },
      'verify-data': {
        title: 'Verify the restored data',
        body: 'Place the restored dump.rdb in the data directory of a scratch Valkey container and start it — Valkey loads the RDB at startup. Run valkey-cli PING and you should get PONG back, then spot-check the keys your app depends on with DBSIZE and a few GETs.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in — and restart the live container so it loads the restored RDB). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The restored dump.rdb fails to load with a truncated-file or short-read error.',
      cause: 'The RDB was copied while Valkey was still rewriting it — the same mid-rewrite hazard as Redis, since Valkey keeps the identical RDB persistence model.',
      fix: 'Always trigger SAVE or BGSAVE and wait for it to finish before capturing dump.rdb. Dockstash does exactly this: it triggers the save, waits for completion, then backs up the finished file.',
    },
    {
      symptom: 'A manual test with redis-cli works but valkey-cli reports "not found" (or the other way around).',
      cause: 'The client binary differs by image: official valkey/valkey images ship valkey-cli, while some compatibility images symlink redis-cli instead.',
      fix: 'Use whichever binary the image ships — the protocol and commands are the same. Dockstash detects whichever client is present in the container automatically, so backups work either way.',
    },
    {
      symptom: 'You placed the restored dump.rdb in /data but the running Valkey still serves old data.',
      cause: 'Like Redis, Valkey only reads the RDB at startup — you cannot hot-swap dump.rdb into a running instance. And if appendonly is enabled, the AOF takes precedence at startup and the RDB is ignored.',
      fix: 'Stop the container, place the restored dump.rdb (and AOF, if you restored one) in the data directory, then start it again. If you restored only an RDB into an AOF-enabled setup, temporarily set appendonly no for the first start, then re-enable it.',
    },
    {
      symptom: 'A restore succeeds but the most recent writes are missing.',
      cause: 'AOF persistence is enabled and the appendonly.aof held newer writes than the RDB snapshot — the RDB alone trails behind.',
      fix: 'Back up both files. Dockstash captures /data/dump.rdb and appendonly.aof together in the same run so the restore point includes the freshest writes.',
    },
  ],
  gotchas: [
    'As with Redis, never grab a dump.rdb mid-rewrite — trigger SAVE/BGSAVE first and back up the finished file.',
    'valkey-cli is the client binary; on some compatibility images redis-cli is symlinked, so Dockstash detects whichever is present.',
    'Enable and capture the AOF when you need the freshest writes; the RDB alone can trail behind.',
  ],
  faq: [
    {
      question: 'How is backing up Valkey different from Redis?',
      answer:
        'It is not, meaningfully. Valkey forked from Redis and keeps the same RDB and AOF persistence model. The only practical difference is the client binary name (valkey-cli), which Dockstash detects automatically.',
    },
    {
      question: 'Can I restore a Redis RDB into Valkey?',
      answer:
        'Yes for current versions — the RDB format is shared across the fork point. As the projects diverge, keep restores within the same engine to be safe.',
    },
    {
      question: 'Does Dockstash detect Valkey automatically?',
      answer:
        'Yes. The valkey/valkey images and the valkey-cli binary are recognized, and both VALKEY_PASSWORD and the legacy REDIS_PASSWORD env keys are picked up.',
    },
    {
      question: 'Should I capture the AOF as well?',
      answer:
        'If appendonly is enabled and you cannot afford to lose the most recent seconds of writes, yes. Dockstash backs up both the RDB and the AOF files.',
    },
    {
      question: 'How often should I back up Valkey?',
      answer:
        'Match the schedule to what Valkey holds. For queues and sessions, hourly is a common choice; for slower-moving data, daily is fine. On the Free plan backups are manual (Backup Now); Pro allows schedules up to hourly, Business any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know a Valkey backup actually restores?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and verifies the captured dump — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
