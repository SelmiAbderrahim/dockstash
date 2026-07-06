// English copy for the Redis guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.redis walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const REDIS_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs Redis',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your Redis service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that Redis was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the redis image, and adds a database layer with the right save-and-capture strategy — plus the container name it resolved and the env keys it found (REDIS_PASSWORD, REDIS_ARGS). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the snapshot by hand',
      body: 'If you want proof before automating, trigger the same save Dockstash will trigger: run redis-cli BGSAVE inside the container. Redis replies "Background saving started", forks, and writes a point-in-time dump.rdb in /data. That finished RDB file — never the live in-memory state — is what gets backed up.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). For Redis used as a primary store (queues, sessions), daily is a sane floor and hourly is common. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
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
      'A Redis backup is only real once it has restored. Dockstash restores never overwrite your live instance by default — you restore to a fresh location first, check the data, and promote it deliberately.',
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
        body: 'Place the restored dump.rdb in the data directory of a scratch Redis container and start it — Redis loads the RDB at startup. Run redis-cli PING and you should get PONG back, then spot-check the keys your app depends on with DBSIZE and a few GETs.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the restored data checks out, point your app at it (or repeat the restore with "Overwrite existing" — an explicit opt-in — and restart the live container so it loads the restored RDB). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The restored dump.rdb fails to load with "Short read or OOM loading DB" or a truncated-file error.',
      cause: 'The RDB was copied while Redis was still rewriting it — a mid-rewrite grab produces a partial file.',
      fix: 'Always trigger SAVE or BGSAVE and wait for it to finish before capturing dump.rdb. Dockstash does exactly this: it triggers the save, waits for completion, then backs up the finished file.',
    },
    {
      symptom: 'A restore succeeds but the most recent writes are missing.',
      cause: 'AOF persistence is enabled and the appendonly.aof held newer writes than the RDB snapshot — the RDB alone lags behind.',
      fix: 'Back up both files. Dockstash captures /data/dump.rdb and appendonly.aof together in the same run so the restore point includes the freshest writes.',
    },
    {
      symptom: 'You placed the restored dump.rdb in /data but the running Redis still serves old data.',
      cause: 'Redis only reads the RDB at startup — you cannot hot-swap dump.rdb into a running instance. And if appendonly is enabled, Redis loads the AOF at startup and ignores the RDB entirely.',
      fix: 'Stop the container, place the restored dump.rdb (and AOF, if you restored one) in the data directory, then start it again. If you restored only an RDB into an AOF-enabled setup, temporarily set appendonly no for the first start, then re-enable it.',
    },
    {
      symptom: 'BGSAVE fails with "Can\'t save in background: fork: Cannot allocate memory".',
      cause: 'The fork needed for a background save was denied by the kernel’s memory overcommit heuristics on a host with a large Redis dataset.',
      fix: 'Set vm.overcommit_memory=1 on the Docker host (sysctl), the setting Redis itself recommends at startup. The fork uses copy-on-write, so it does not actually need a full second copy of the dataset.',
    },
  ],
  gotchas: [
    'Copying an in-progress dump.rdb while Redis rewrites it yields a truncated file; trigger SAVE (or BGSAVE) first, then back up the finished RDB.',
    'If AOF persistence is enabled, back up the appendonly.aof file(s) too — the RDB alone may lag behind the latest writes.',
    'Redis restore requires the server to be stopped or restarted to load the RDB; you cannot hot-swap dump.rdb into a running instance.',
  ],
  faq: [
    {
      question: 'Is Redis worth backing up at all?',
      answer:
        'It depends on your use. As a pure cache, a lost Redis is repopulated automatically. As a primary store (queues, sessions, sorted-set data), yes — back up the RDB, and the AOF if enabled.',
    },
    {
      question: 'SAVE vs BGSAVE — which does Dockstash use?',
      answer:
        'BGSAVE forks and snapshots in the background without blocking; SAVE blocks until done. Dockstash prefers a background save and then backs up the finished dump.rdb once it is written.',
    },
    {
      question: 'What about AOF (append-only file)?',
      answer:
        'If appendonly is enabled, the AOF holds the most recent writes that the RDB may not yet reflect. Dockstash captures both /data/dump.rdb and appendonly.aof so no recent data is lost.',
    },
    {
      question: 'Can I copy dump.rdb while Redis is running?',
      answer:
        'Only after a completed SAVE/BGSAVE. Copying while a rewrite is in progress can grab a partial file. Dockstash triggers the save and waits for it to finish before backing up.',
    },
    {
      question: 'How often should I back up Redis?',
      answer:
        'Match the schedule to what Redis holds. For queues and sessions, hourly is a common choice; for slower-moving data, daily is fine. On the Free plan backups are manual (Backup Now); Pro allows schedules up to hourly, Business any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know a Redis backup actually restores?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and verifies the captured dump — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
