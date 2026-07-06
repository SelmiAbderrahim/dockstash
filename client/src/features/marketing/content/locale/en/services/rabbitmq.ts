// English copy for the RabbitMQ guide. Step keys mirror
// content/guides.ts → SERVICE_GUIDES.rabbitmq walkthrough/restoreVerify ids.

import type { ServiceGuideCopy } from '../../types';

export const RABBITMQ_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Create your Dockstash account and open the dashboard',
      body: 'Sign up free at dockstash.com/register. The one-time setup wizard asks for your storage VPS (the machine that will hold the encrypted backups) and generates an encryption password — save that password in a password manager immediately, it is shown exactly once.',
    },
    'add-project': {
      title: 'Add the Docker project that runs RabbitMQ',
      body: 'On the Projects screen Dockstash auto-detects every Compose project folder on the server (by default under /var/www). Pick the project that contains your RabbitMQ service. Nothing is backed up yet — you are just telling Dockstash where the project lives.',
    },
    'review-detection': {
      title: 'Check that RabbitMQ was detected',
      body: 'Open the project and look at the Plan tab. Dockstash reads docker-compose.yml, recognizes the rabbitmq image, and adds a layer that exports broker definitions — plus the container name it resolved and the env keys it found (RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_VHOST). You can toggle files, databases, and proxy configs on or off before saving.',
    },
    'test-dump': {
      title: 'Optional: sanity-check the export by hand',
      body: 'If you want proof before automating, run rabbitmqctl export_definitions inside the container. It writes a JSON file describing your whole broker topology — vhosts, exchanges, queues, bindings, users, and policies. Open it and you will recognize every queue your app declares; that JSON is what gets backed up.',
    },
    'choose-destination': {
      title: 'Confirm your storage destination',
      body: 'Backups are stored as encrypted restic snapshots on your own storage VPS over SSH. If you completed the setup wizard this is already configured; you can change host, user, port, or the SSH key any time under Settings → Storage.',
    },
    'schedule': {
      title: 'Set a backup schedule',
      body: 'On the project’s Schedule tab pick daily, weekly, or a custom cron expression (validated inline). Daily is plenty for most brokers — topology changes when you deploy, not every minute. Add a weekly prune schedule with your retention policy so old snapshots are trimmed automatically.',
    },
    'run-first-backup': {
      title: 'Run the first backup now',
      body: 'Click Backup Now on the project card. Dockstash runs rabbitmqctl export_definitions inside the running container and restics the JSON along with your project files — you can watch the live restic output line by line in the log panel while it runs. Definitions export cleanly while the broker serves traffic; nothing is stopped or locked.',
    },
    'confirm-snapshot': {
      title: 'Confirm the snapshot exists',
      body: 'When the run finishes, the project card shows the new last-backup time, snapshot count, and repository size. Open the Snapshots screen and you will see the restore point in the timeline — that is your proof the backup landed off-site.',
    },
  },
  restoreVerify: {
    intro:
      'A RabbitMQ backup is only real once it has restored. Dockstash restores never overwrite your live broker by default — you restore to a fresh location first, verify the topology, and promote deliberately. Remember what you are restoring: the definitions JSON rebuilds your topology, not the messages that were sitting in queues.',
    steps: {
      'pick-snapshot': {
        title: 'Pick a restore point',
        body: 'Open Snapshots, select the project, and browse the timeline of restore points. Each row contains the exported definitions JSON — the complete broker topology at that moment — plus the project files captured in the same run.',
      },
      'restore-scratch': {
        title: 'Restore to a new location',
        body: 'Click Restore and keep the default "Restore to new location" mode. Type the project name to confirm — this is a deliberate, typed-confirm action. The definitions JSON and files land in the target path you choose, leaving the live broker untouched. Stand up a fresh RabbitMQ container and run rabbitmqctl import_definitions against it.',
      },
      'verify-data': {
        title: 'Verify the restored topology',
        body: 'Run rabbitmqctl list_queues on the scratch broker: it prints each queue name with its message count. Every queue your app declares should be listed (counts will be zero — messages are not part of the backup). Check exchanges, bindings, users, and policies the same way or through the management UI.',
      },
      'promote': {
        title: 'Promote when satisfied',
        body: 'Once the topology checks out, point your producers and consumers at the restored broker (or repeat the restore with "Overwrite existing" — an explicit opt-in). Better: let the weekly restore drill do this proof automatically so a restore is never your first rehearsal.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'The restore "worked" but all the queues are empty.',
      cause: 'Definitions and messages are different things. export_definitions captures topology — vhosts, exchanges, queues, bindings, users, policies — never the message bodies that were queued at backup time.',
      fix: 'This is expected. Treat queued messages as transient: design producers to republish and consumers to tolerate replay. If a message must survive a broker loss, persist it in a database, not in a queue.',
    },
    {
      symptom: 'A broker started from a copied /var/lib/rabbitmq/mnesia directory crashes or refuses to start.',
      cause: 'Mnesia is written continuously while the broker runs, so a live copy is internally inconsistent — and the store is also tied to the node name, so it breaks on a host with a different hostname.',
      fix: 'Do not copy Mnesia as a backup. Export definitions and import them into a fresh broker; that is the supported, restorable path.',
    },
    {
      symptom: 'import_definitions into a running broker errors or leaves a mix of old and new topology.',
      cause: 'The import merges into whatever already exists — conflicting queue arguments, existing users, or policies collide with entries in the JSON instead of replacing them.',
      fix: 'Import into a fresh broker whenever possible. If you must import into a running one, expect a merge, not a reset: resolve conflicts by deleting the clashing entities first, and verify the result with rabbitmqctl list_queues and the management UI.',
    },
  ],
  gotchas: [
    'Back up broker definitions (topology) via export_definitions — this is the durable, restorable part of RabbitMQ.',
    'The Mnesia message store holds in-flight messages and is not safe to copy live; treat persisted messages as transient and rely on producers/consumers to recover.',
    'Restoring definitions recreates topology but not the messages that were in queues at backup time.',
  ],
  faq: [
    {
      question: 'What part of RabbitMQ should I back up?',
      answer:
        'The definitions: vhosts, exchanges, queues, bindings, users, and policies. Exporting them as JSON captures your entire broker topology, which is what you actually need to rebuild after a loss.',
    },
    {
      question: 'Can I back up the messages sitting in queues?',
      answer:
        'Not reliably while the broker runs. The Mnesia store is not point-in-time consistent under load, and messages are meant to be transient. Design consumers to tolerate replay rather than relying on a message backup.',
    },
    {
      question: 'How do I restore a RabbitMQ broker?',
      answer:
        'Stand up a fresh broker and run rabbitmqctl import_definitions with your exported JSON. The full topology — exchanges, queues, bindings, users, policies — is recreated.',
    },
    {
      question: 'Is copying /var/lib/rabbitmq/mnesia a valid backup?',
      answer:
        'No. Mnesia is written continuously and a live copy is inconsistent. Export definitions instead; that is the supported, restorable backup path.',
    },
    {
      question: 'How often should I back up RabbitMQ?',
      answer:
        'Daily is plenty for most brokers — the definitions only change when you deploy new queues, users, or policies. On the Free plan backups are manual only (Backup Now); Pro unlocks schedules up to hourly, and Business allows any cron expression.',
    },
    {
      question: 'Where do the backups actually live?',
      answer:
        'On your own storage VPS, as encrypted restic snapshots pushed over SSH. Dockstash never holds your data on a third-party cloud — you point it at a box you control, and the repository is encrypted with a password only you have.',
    },
    {
      question: 'How do I know the backup is restorable without doing a manual restore?',
      answer:
        'Schedule a restore drill. Dockstash restores the latest snapshot into an isolated scratch workspace, byte-hashes every file against the source, and parses the restored definitions JSON — then stamps a pass/fail badge on the project. A weekly drill means you always have fresh proof.',
    },
  ],
};
