// English copy for the platform guides (using Dockstash itself). Step keys
// mirror content/platform-guides.ts. Facts are sourced from the product docs
// (docs/fleet-agents.en.md, docs/schedules-live-logs.en.md,
// docs/backup-verification.en.md, docs/alerts-audit-and-health.en.md,
// docs/using-the-dashboard.en.md, docs/plans-and-limits.en.md).

import type { PlatformGuideCopy } from '../types';

export const PLATFORM: Record<string, PlatformGuideCopy> = {
  'connect-fleet-agent': {
    intro:
      'A fleet agent is a small daemon you run on another VPS so Dockstash can back up the containers on that host too. The agent phones home over HTTPS — no inbound ports are opened on your machine — and runs the same dump-then-restic pipeline as the primary server. Multi-VPS fleet is a Business-tier feature.',
    steps: {
      'open-fleet': {
        title: 'Open the Fleet screen',
        body: 'In the dashboard go to Fleet. This screen lists every registered agent with its online/offline status, version, and last heartbeat.',
      },
      'register-agent': {
        title: 'Register the agent',
        body: 'Click Register agent and give it a name and the host it will run on. In the same dialog, set the Project directories field to where your Compose projects live on that VPS (default /var/www) — the agent will only ever discover, back up, and restore inside those directories.',
      },
      'copy-token': {
        title: 'Copy the one-time token',
        body: 'Registration mints a token shaped dsa_<agentId>.<secret> and shows it exactly once — it is stored only as a keyed HMAC on the server and can never be retrieved again. Copy it now. If you ever lose it, use Rotate key on the agent’s row; the old token stops working the moment a new one is minted.',
      },
      'install-agent': {
        title: 'Install the agent on the VPS',
        body: 'The register dialog shows a copy-paste docker-compose block, pre-filled with your token and project directories. Paste it on the target VPS and bring it up. The bundled docker-socket-proxy grants the agent least-privilege access to Docker (containers + exec only) — it never touches the raw socket.',
      },
      'set-project-roots': {
        title: 'Check the project directories are mounted',
        body: 'Every directory you listed must also be bind-mounted read-write in the compose file (same path inside and outside the container) — restores write files back. To add a directory later, open the agent’s Setup dialog, add it, and re-run the printed compose command.',
      },
      'verify-online': {
        title: 'Verify the agent is online',
        body: 'Within about 30 seconds the agent’s first heartbeat lands and the Fleet row flips to online. If it stays offline, check that both containers are up and that your Dockstash URL is reachable from the VPS.',
      },
      'assign-project': {
        title: 'Assign a project to the agent',
        body: 'Open a project’s Plan tab and set "Runs on" to the new agent (the default is "This server (local)"). From then on, scheduled and on-demand backups for that project are claimed and executed by the agent, streaming live logs back to your dashboard.',
      },
    },
    faq: [
      {
        question: 'Does the Dockstash server connect into my VPS?',
        answer:
          'No. Connectivity is outbound-only: the agent polls and heartbeats over HTTPS with a Bearer token. You never open an inbound port, and the server never dials your machine.',
      },
      {
        question: 'What can the agent see on my server?',
        answer:
          'Only what you allow. Filesystem access is limited to the project directories you configured (and they must be explicitly bind-mounted), and Docker access goes through a socket proxy that exposes only container listing and exec — no image builds, no volume mounts, no host root.',
      },
      {
        question: 'What happens if the agent dies mid-backup?',
        answer:
          'Every job has a lease (default 15 minutes, renewed while logs stream). If the lease expires the job is marked failed and an alert is sent — it is never silently retried, so you always know a run did not finish.',
      },
      {
        question: 'Do restore drills run on fleet agents?',
        answer:
          'Not yet — drills still run on the primary server. Backup, verify (restic check), prune, and restore all run remotely on the agent.',
      },
      {
        question: 'I rotated the key and now the agent gets 401s. What do I do?',
        answer:
          'The running container still holds the old token. Update DOCKSTASH_AGENT_TOKEN in docker-compose.agent.yml and recreate the container. Rotation invalidates the old token immediately by design.',
      },
    ],
  },

  'schedule-backups': {
    intro:
      'Dockstash schedules four job kinds per project — backup, prune, check, and drill — each on its own cron expression, executed through a serialized queue that guarantees one job per repository at a time. Set a daily backup, a weekly prune with your retention policy, and a weekly drill, and the platform runs and verifies your backups without you.',
    steps: {
      'open-schedule': {
        title: 'Open the project’s Schedule tab',
        body: 'Go to the project detail screen and open the Schedule tab. Scheduling requires a paid tier: Free runs manual backups only, Pro allows up to hourly schedules, Business allows any cron expression.',
      },
      'pick-frequency': {
        title: 'Pick the backup frequency',
        body: 'Choose daily, weekly, or a custom cron expression — cron syntax is validated inline as you type (0 3 * * * = daily at 03:00). Daily at a quiet hour is the right default; go hourly only when losing a day of writes is unacceptable.',
      },
      'add-prune': {
        title: 'Add a prune schedule with retention',
        body: 'Prune is a separate job kind on purpose — it holds the repository lock and deletes data, so it never runs inline with a backup. Add a weekly prune and set your retention policy (keep N daily / weekly / monthly snapshots); it maps directly to restic forget --prune.',
      },
      'add-check-drill': {
        title: 'Add integrity checks and a restore drill',
        body: 'Schedule a check (restic check — structural integrity, cheap, daily is fine) and a drill (full restore into a scratch workspace with byte and row diffs — expensive, weekly is the sweet spot). The drill is what turns "backup exists" into "backup restores".',
      },
      'save-and-watch': {
        title: 'Save and watch the first scheduled run',
        body: 'Save the schedule and let it fire. Every running job streams its restic output live into the dashboard log panel. Two schedules that collide on the same repository are serialized automatically — restic corrupts repos under concurrent access, so the queue is the correctness contract, not an optimization.',
      },
    },
    faq: [
      {
        question: 'Why can’t prune run as part of the backup job?',
        answer:
          'Prune holds the repo lock and is destructive. If a combined job failed halfway you could end up with neither a fresh backup nor a completed prune. Separate schedules mean each operation succeeds or fails alone.',
      },
      {
        question: 'What happens when two schedules fire at the same time?',
        answer:
          'Same repository: they are serialized — the second waits for the first. Different repositories run in parallel. A repo never sees two concurrent restic operations.',
      },
      {
        question: 'What cron frequencies does my plan allow?',
        answer:
          'Free has no schedules (manual Backup Now only). Pro allows up to hourly. Business allows any cron expression. The schedule form rejects anything above your tier’s ceiling.',
      },
      {
        question: 'Do scheduled runs retry on failure?',
        answer:
          'Yes, with capped exponential backoff. Repeated failures mark the schedule failed and fire an alert email — failures are loud by design.',
      },
      {
        question: 'Can I watch a scheduled backup while it runs?',
        answer:
          'Yes. Every job streams restic stdout/stderr line by line to the project’s log panel over a live socket, exactly like a manual Backup Now.',
      },
    ],
  },

  'restore-a-backup': {
    intro:
      'Restoring in Dockstash is deliberately safe: pick a snapshot on the Snapshots screen, type the project name to confirm, and restore to a new location by default — overwriting the live project is a separate, explicit opt-in. Restic output streams live while the restore runs.',
    steps: {
      'open-snapshots': {
        title: 'Open the Snapshots screen',
        body: 'Pick your project on the Snapshots screen. You get a timeline of restore points — every successful backup run is one snapshot holding the project files, database dumps, and configs captured together.',
      },
      'pick-restore-point': {
        title: 'Choose the restore point',
        body: 'Click Restore on the snapshot row you want. Usually that is the latest one; after a bad deploy or data corruption, pick the last snapshot from before the incident.',
      },
      'typed-confirm': {
        title: 'Type the project name to confirm',
        body: 'A confirmation dialog requires you to type the exact project name. This is intentional friction — restores are consequential, and a typed confirm eliminates wrong-project accidents.',
      },
      'choose-mode': {
        title: 'Choose the restore mode',
        body: 'Keep the default "Restore to new location" and enter a target path: the snapshot is materialized there and the live project is untouched. "Overwrite existing" replaces the live project and is an explicit opt-in — use it only after you have validated the restored data once.',
      },
      'watch-logs': {
        title: 'Watch the restore stream',
        body: 'Restic output streams into the log panel below the table while files and dumps are materialized. When it completes, the target path holds the project files plus the database dump from that snapshot.',
      },
      'validate-result': {
        title: 'Validate before switching over',
        body: 'Load the restored dump into a scratch database container and spot-check the tables your app depends on. Only then repoint your app or repeat the restore in overwrite mode. If you want this proof continuously, schedule a restore drill.',
      },
    },
    faq: [
      {
        question: 'Will restoring overwrite my running project?',
        answer:
          'Not unless you explicitly choose "Overwrite existing". The default mode restores into a new location you specify, leaving the live project untouched.',
      },
      {
        question: 'Can I restore a single file or just the database?',
        answer:
          'The snapshot contains files, dumps, and configs together. Restore to a new location and take what you need from the restored tree — that is the safest way to cherry-pick.',
      },
      {
        question: 'How do I restore onto a brand-new server?',
        answer:
          'Stand up a fresh Dockstash, point it at the same storage VPS, and import your configuration export envelope with the same master encryption key. Repositories then decrypt and every snapshot is restorable. See the bootstrap recovery runbook in the docs.',
      },
      {
        question: 'How fast is a restore?',
        answer:
          'Restic restores stream at roughly your network and disk speed; the dashboard shows live progress line by line. Restore-to-new-location also means the app stays up while the restore runs.',
      },
    ],
  },

  'restore-drills': {
    intro:
      'A backup is unproven until it restores. A restore drill restores your latest snapshot into an isolated scratch workspace, byte-hashes every restored file against the source, row-diffs the restored database dumps, and stamps a pass/fail badge on the project — automatically, on a schedule. It is the difference between believing your backups and knowing.',
    steps: {
      'schedule-drill': {
        title: 'Schedule a weekly drill',
        body: 'On the project’s Schedule tab add a drill schedule. Weekly is the recommended cadence: drills are the expensive proof (a real restore), while the cheap structural check (restic check) can run daily alongside.',
      },
      'run-drill-now': {
        title: 'Or trigger one now',
        body: 'The Restore drill tab on the project detail screen shows the last drill result and lets you fire one immediately. The drill restores into a scratch workspace — your live project and repository are never touched.',
      },
      'read-report': {
        title: 'Read the drill report',
        body: 'A drill passes only when the mismatch count is zero: every file byte-identical, every database dump row-consistent. The project shows lastDrillAt and a pass/fail badge — "Verified" means a real restore succeeded, not that a backup merely exists.',
      },
      'fix-failures': {
        title: 'Treat a failed drill as an incident',
        body: 'A failed drill fires an alert email with the mismatch detail. Common causes: torn dumps from a service that bypassed the adapter, files changed by a concurrent deploy during backup, or repository corruption (run a check with read-data to confirm). Fix the cause, run Backup Now, then re-drill.',
      },
    },
    faq: [
      {
        question: 'What exactly does a drill compare?',
        answer:
          'Every source path and config is byte-hashed against its restored mirror, and every enabled database layer’s restored dump is row-diffed (or parsed) against the source. Any mismatch fails the drill — there is no partial pass.',
      },
      {
        question: 'Can a drill break my live project?',
        answer:
          'No. Drills restore into an isolated scratch workspace and clean it up afterwards even when the drill throws. The live project, containers, and repository are read-only participants.',
      },
      {
        question: 'How is a drill different from restic check?',
        answer:
          'restic check proves the repository is structurally well-formed (no missing packs, no index rot). Only a drill proves the repository actually restores into working data. Run checks daily, drills weekly.',
      },
      {
        question: 'Do drills run on fleet agents?',
        answer:
          'Not yet — drills execute on the primary server. Remote projects still get backup, check, prune, and restore on their agent.',
      },
    ],
  },

  'notifications-alerts': {
    intro:
      'Dockstash makes failure loud. Any failed backup, restore, or drill triggers an immediate alert email to the project owner, and a dead-man’s-switch heartbeat catches the silent case where nothing errored because nothing ran. Every alert carries the project, the error, the last-good timestamp, and a deep link.',
    steps: {
      'understand-triggers': {
        title: 'Know what fires an alert',
        body: 'Four kinds: a failed backup (any layer — dump, restic, disk space), a failed restore, a failed restore drill (byte or row mismatch), and a heartbeat alert when a project has had no successful backup inside the heartbeat window. You do not configure per-failure rules — failures always alert.',
      },
      'set-heartbeat': {
        title: 'Tune the heartbeat window',
        body: 'The heartbeat threshold (default 24 hours) is the "silence is failure" window: if a project’s last successful backup is older, you get an alert — including projects that have never succeeded. Alerts dedupe within the window and reset the moment a backup succeeds.',
      },
      'add-webhook': {
        title: 'Add a webhook for your on-call flow',
        body: 'Set an alert webhook URL and every alert also POSTs its JSON payload there — plug it into Slack, PagerDuty, or your own bot. Email and webhook carry the same payload, so automations see exactly what you see.',
      },
      'review-audit': {
        title: 'Use the audit trail',
        body: 'Destructive and billable actions (backup runs, restore triggers, schedule deletes, plan changes) append to an immutable audit log with actor, action, target, IP, and timestamp — there is no update or delete path. Review it from your account or via the audit API.',
      },
    },
    faq: [
      {
        question: 'Will I get spammed if a project keeps failing?',
        answer:
          'Heartbeat alerts dedupe for the length of the window before re-alerting, and a successful backup clears the dedupe immediately. Failure alerts fire per failed run — if runs keep failing, that is signal, not spam.',
      },
      {
        question: 'What is in the alert payload?',
        answer:
          'The project name, the error detail, the last-good timestamp, and a deep link to the project dashboard. The webhook receives the same fields as JSON.',
      },
      {
        question: 'Why did I get an alert when nothing failed?',
        answer:
          'That is the heartbeat: no successful backup landed inside the window. A paused schedule, a stopped agent, or a project that never ran all look identical to silence — the dead-man’s switch exists exactly for those cases.',
      },
      {
        question: 'Can external monitoring watch Dockstash itself?',
        answer:
          'Yes — point your uptime monitor at the unauthenticated health endpoint (200 when the stack is healthy, 503 when degraded). Aggregate counters are exposed on a metrics endpoint with no PII.',
      },
    ],
  },

  'retention-policy': {
    intro:
      'Retention decides how much history you keep: N daily, N weekly, and N monthly snapshots per project. Dockstash maps your policy directly onto restic forget --prune, run by a scheduled prune job — so old snapshots are trimmed automatically and the repository stays compact without ever touching recent restore points.',
    steps: {
      'open-retention': {
        title: 'Open Settings → Retention',
        body: 'Retention is configured centrally under Settings. Your plan caps the window: Free keeps 7 days, Pro 30, Business 90 — the policy you set is clamped to your tier’s ceiling.',
      },
      'choose-keep': {
        title: 'Choose the keep counts',
        body: 'A solid default: keep 7 daily, 4 weekly, 6 monthly. That gives you day-granular restores for a week, week-granular for a month, and month-granular for half a year — while the repository stays small thanks to restic deduplication.',
      },
      'schedule-prune': {
        title: 'Schedule the prune job',
        body: 'Add a weekly prune schedule on each project. Your keep counts translate one-to-one into restic forget flags — the command below is exactly what a 7/4/6 policy runs. Prune is its own job kind because it locks the repo and deletes data; it never piggybacks on a backup.',
      },
      'verify-prune': {
        title: 'Verify pruning works',
        body: 'After the first prune completes, check the project card: the snapshot count should flatten out and repo size should stabilize instead of growing forever. The Snapshots timeline shows exactly which restore points remain.',
      },
    },
    faq: [
      {
        question: 'Does pruning ever delete my only recent backup?',
        answer:
          'No. Keep-counts always preserve the most recent snapshots in each bucket — pruning trims the old tail, never the fresh head. A 7-daily policy always retains the last seven daily snapshots.',
      },
      {
        question: 'What happens to retention if I downgrade my plan?',
        answer:
          'The retention cap of the new tier applies going forward, and existing backups are never deleted on downgrade — over-cap projects are paused (read-only), not purged.',
      },
      {
        question: 'Why is my repository still large after pruning?',
        answer:
          'restic forget removes snapshots; the --prune pass then repacks and frees unreferenced data. Space drops after prune completes, not after forget alone — check the prune job’s log for the repacking summary.',
      },
      {
        question: 'Do I need prune if I have few snapshots?',
        answer:
          'Eventually, yes. Without prune every snapshot lives forever and the repo grows without bound. A weekly prune with sane keep-counts is cheap insurance against a full storage disk — which is itself a backup failure mode.',
      },
    ],
  },

  'storage-destinations': {
    intro:
      'Dockstash stores backups on a machine you control: a storage VPS reached over SSH, holding encrypted restic repositories. No third-party cloud sits between your data and you — the setup is one SSH identity plus one encryption password, and both stay in your hands.',
    steps: {
      'prepare-vps': {
        title: 'Prepare a storage box',
        body: 'Any Linux VPS or home server reachable over SSH works — it needs disk space and an SSH user, nothing else installed. Use a different machine (ideally a different provider or location) than the one running your projects: a backup on the same box dies with the box.',
      },
      'add-ssh-key': {
        title: 'Add the SSH connection',
        body: 'In the setup wizard (or Settings → Storage later) enter host, user, port, and an SSH private key. The key is write-only — after saving it is never displayed again. Dockstash pushes restic snapshots over SFTP with that identity.',
      },
      'save-encryption-password': {
        title: 'Save the encryption password — it is shown once',
        body: 'The wizard generates a strong repository encryption password and shows it exactly once. Copy it to a password manager before clicking Done. This is not recoverable: losing it means the repositories cannot be decrypted, by anyone, ever.',
      },
      'verify-connection': {
        title: 'Verify with a first backup',
        body: 'Run Backup Now on any project. A green run proves the storage VPS is reachable, the SSH identity works, and the repository initialized and encrypted correctly. The project card then shows the repo size growing on the storage box.',
      },
      'plan-recovery': {
        title: 'Plan for total-loss recovery',
        body: 'Keep three things in separate places: the storage VPS (your repos), your master encryption key, and your configuration export envelope. With all three, a destroyed production server is a rebuild, not a data loss — the bootstrap recovery runbook walks through it.',
      },
    },
    faq: [
      {
        question: 'Can I use any provider as the storage destination?',
        answer:
          'Anything you can SSH into: a cheap storage VPS, a Hetzner storage box, a NAS at another site. If it speaks SSH/SFTP and has disk, restic can keep repositories on it.',
      },
      {
        question: 'Who can read my backups on the storage box?',
        answer:
          'Nobody without your encryption password. Repositories are AES-encrypted by restic before leaving your server; the storage box only ever sees ciphertext.',
      },
      {
        question: 'What if I lose the encryption password?',
        answer:
          'The repositories are unrecoverable — that is the point of real encryption. Store the password in a password manager the moment the wizard shows it, and keep the master key and export envelope backed up separately.',
      },
      {
        question: 'Can I rotate the encryption password or the SSH key?',
        answer:
          'Yes. Settings → Encryption password rotates the repo password (with an explicit "I have saved it" confirmation), and Settings → Storage accepts a new SSH key any time.',
      },
    ],
  },

  'troubleshooting-backups': {
    intro:
      'When a backup fails, Dockstash tells you loudly and shows you exactly where: an alert email with the error, a status badge on the project card, and the full restic output in the live log panel. This guide walks the common failure shapes — from red runs to offline agents to the silence alarm — and their fixes.',
    steps: {
      'check-status': {
        title: 'Start at the project card',
        body: 'The Projects screen shows a status badge, last backup time, and size per project. A failed run also arrives as an alert email carrying the error and a deep link — start from either. The project detail view surfaces the last failure detail directly.',
      },
      'read-live-logs': {
        title: 'Read the run’s restic output',
        body: 'Open the log panel for the failing run. The last lines almost always name the cause: authentication failed (SSH key or DB credentials), no space left on device (storage box full), connection refused (storage VPS unreachable), or a dump command error from inside the container.',
      },
      'stale-lock': {
        title: 'Stale restic locks fix themselves',
        body: 'If a run crashed or the server rebooted mid-backup, the repository can be left locked. You do not need to intervene: the next run detects the orphaned lock and runs restic unlock automatically. A live-held lock from a genuinely running job is never broken.',
      },
      'agent-offline': {
        title: 'Agent projects: check the agent first',
        body: 'If a fleet-agent project stops backing up, check the Fleet screen. An offline agent means heartbeats stopped: on the VPS confirm both agent containers are up, the Dockstash URL is reachable, and the token was not rotated without updating the container. Repeated 401s in the logs mean an old container somewhere still uses a revoked token.',
      },
      'heartbeat-alerts': {
        title: 'Understand "no backup ran" alerts',
        body: 'A heartbeat alert means no successful backup landed inside the window — nothing errored, nothing ran. Usual suspects: the schedule was disabled, the plan tier does not allow schedules, the project was paused after a downgrade, or the assigned agent is offline. Fix the cause and the next green run clears the alarm.',
      },
    },
    faq: [
      {
        question: 'A backup failed once and succeeded on retry. Should I care?',
        answer:
          'Look at the failure reason. Jobs retry with capped exponential backoff, so transient network blips self-heal. Recurring retries on the same error — disk filling up, flaky SSH — deserve a real fix before they become a hard failure.',
      },
      {
        question: 'Why does my second schedule wait instead of running?',
        answer:
          'One job per repository at a time, always. Concurrent restic operations corrupt repositories, so colliding schedules on the same repo are serialized deliberately. Different repos run in parallel.',
      },
      {
        question: 'The Add-Project picker for my agent is empty. Why?',
        answer:
          'The picker reads the snapshot the agent pushed on its last heartbeat. Empty means the agent has not reported yet, a project root is not actually mounted into the agent container, or the Docker socket proxy is unreachable — the picker banner tells you which. Fix it, then hit Refresh now instead of waiting for the next discovery cycle.',
      },
      {
        question: 'How do I prove the repository itself is healthy?',
        answer:
          'Run a check job. restic check verifies repository structure; with a read-data subset percentage it also reads and verifies actual pack contents. Pass requires a zero exit code — there are no false greens.',
      },
      {
        question: 'Where do I see why a drill failed?',
        answer:
          'The drill result stores a detail message including the mismatch count, shown on the Restore drill tab and in the alert email. Byte mismatches point at files changing during backup; row mismatches point at dump consistency — both mean treat the backup as unproven until a re-run passes.',
      },
    ],
  },
};
