// Competitor dataset — single source of truth for every competitor page
// (alternative pages, vs pages, hub comparison matrix). Strengths are kept
// honest on purpose: real competitor wins build trust and avoid the
// "biased comparison" penalty that AI answer engines apply to one-sided pages.

import type { Competitor } from '../types';

export const COMPETITORS: Record<string, Competitor> = {
  backrest: {
    slug: 'backrest',
    name: 'Backrest',
    category: 'Open-source restic web UI',
    positioning:
      'Backrest is a free, open-source web UI and scheduler wrapped around restic. It is the closest tool to Dockstash and an excellent generic restic frontend. The gap: Backrest is not Docker-aware — it backs up paths, so a live Postgres data directory gets copied instead of dumped, and there is no restore-drill verification.',
    pricing: 'Free / open-source (self-hosted, no paid tier)',
    strengths: [
      'Genuinely free and open-source (MIT) with no paid tier or per-project metering',
      'Mature, well-maintained restic scheduler with a clean web UI',
      'First-class restic features: multiple repos, retention policies, prune, check',
      'Single self-contained Go binary — trivial to deploy anywhere',
      'No account, no billing, no phone-home — fully local and private',
    ],
    weaknesses: [
      'Not Docker-aware: backs up host paths, so it copies live database files instead of dumping them',
      'No database adapters — a live Postgres/MySQL heap file copied mid-write is unrestorable',
      'No Compose or reverse-proxy (Traefik/nginx) auto-detection — you author the path list by hand',
      'No automated restore-drill: a restic check verifies repo integrity, not that your data actually restores',
      'No per-project billing or multi-VPS fleet view for agencies',
    ],
    bestFor:
      'Self-hosters who back up plain files and directories and are comfortable adding their own pre-backup database dump hooks.',
    switchIf:
      'You run databases in Docker and want them dumped correctly (pg_dumpall, mysqldump --single-transaction, mongodump --oplog) and drill-verified — not copied live.',
    comparison: [
      {
        feature: 'Docker-aware database dumps',
        dockstash: 'Auto-detects Postgres/MySQL/MariaDB/Mongo and dumps from the running container',
        competitor: 'None — backs up whatever host paths you point it at, including live DB files',
        dockstashWins: true,
      },
      {
        feature: 'Compose + reverse-proxy detection',
        dockstash: 'Scans docker-compose.yml, .env, volumes, and Traefik/nginx config automatically',
        competitor: 'Manual — you list every path yourself',
        dockstashWins: true,
      },
      {
        feature: 'Automated restore-drill verification',
        dockstash: 'Scheduled restore-to-scratch + diff vs source proves the backup restores',
        competitor: 'restic check verifies repo integrity only, not restorability',
        dockstashWins: true,
      },
      {
        feature: 'Failure alerting',
        dockstash: 'Resend email alerts plus a dead-man’s-switch heartbeat catch silent stalls',
        competitor: 'Basic notification hooks; no heartbeat / dead-man’s-switch',
        dockstashWins: true,
      },
      {
        feature: 'Per-project billing for agencies',
        dockstash: 'Per-project metering and multi-VPS fleet view',
        competitor: 'None (not a product goal)',
        dockstashWins: true,
      },
      {
        feature: 'Underlying backup engine',
        dockstash: 'Restic (encrypted, deduplicated, incremental) — standard repos',
        competitor: 'Restic (same engine) — standard repos',
      },
      {
        feature: 'Price',
        dockstash: 'Free self-host tier; paid Pro/Business for scale + support',
        competitor: 'Free and open-source, no paid tier',
      },
      {
        feature: 'Lock-in',
        dockstash: 'Standard restic repos on your storage VPS — restore without Dockstash',
        competitor: 'Standard restic repos — restore without Backrest',
      },
    ],
    migrationNotes:
      'Both tools write standard restic repositories, so migration is low-risk: point Dockstash at your existing restic repo and it reads your snapshots directly. The one change worth making is to stop backing up live database data directories and let Dockstash’s adapters dump them from the container instead. Your retention and prune policies map across one-to-one.',
    faq: [
      {
        question: 'Is Dockstash a fork of Backrest?',
        answer:
          'No. Both use restic as the engine, but Dockstash is a separate MERN application built around Docker-project awareness: adapter-based database dumps, Compose/reverse-proxy detection, and automated restore drills. Backrest is a generic restic UI.',
      },
      {
        question: 'Backrest is free — why pay for Dockstash?',
        answer:
          'Dockstash has a free self-host tier too. You pay only when you want scheduling at scale, email alerts, more projects, or per-project billing for many client servers. The database-adapter and restore-drill correctness features are the reason to switch, not the price.',
      },
      {
        question: 'Can Backrest back up my Postgres container correctly?',
        answer:
          'Only if you add your own pre-backup hook that runs pg_dumpall and writes the dump to a path Backrest then backs up. Out of the box it copies the live data directory, which is not a consistent, restorable dump. Dockstash does the dump for you.',
      },
      {
        question: 'Will my existing restic repo work with Dockstash?',
        answer:
          'Yes. Dockstash reads standard restic repositories. Point it at the same repo and password and your Backrest-created snapshots are visible immediately.',
      },
      {
        question: 'Does Backrest verify that backups restore?',
        answer:
          'Backrest can run restic check, which validates repository integrity. It does not restore the data to a scratch location and diff it against the source. Dockstash runs that restore drill on a schedule so you know recovery works before you need it.',
      },
    ],
    lastReviewed: '2026-07',
  },

  simplebackups: {
    slug: 'simplebackups',
    name: 'SimpleBackups',
    category: 'Managed cloud backup SaaS',
    positioning:
      'SimpleBackups is a polished managed SaaS for scheduling database and server backups to cloud storage. It removes all setup effort and covers many non-Docker sources. The tradeoff is recurring cost and data sovereignty: your backup pipeline runs through their platform, whereas Dockstash keeps everything on your own VPS and storage.',
    pricing: 'Paid SaaS, monthly subscription tiers',
    strengths: [
      'Fully managed — no self-hosting, minimal setup, supported by a team',
      'Broad source coverage beyond Docker (managed databases, servers, SaaS apps, storage)',
      'Mature scheduling, retention, and notification features',
      'Good documentation and hands-on support',
    ],
    weaknesses: [
      'Recurring subscription cost that scales with usage',
      'Your backup credentials and pipeline flow through their platform (data-sovereignty tradeoff)',
      'Not Docker-Compose-native: no automatic volume/DB/reverse-proxy detection of a running stack',
      'You depend on their service staying online and in business',
    ],
    bestFor:
      'Teams that want a hands-off managed service and are happy to pay a subscription and route backups through a third-party platform.',
    switchIf:
      'You want backups that stay entirely on your own infrastructure, with no recurring per-source SaaS fee and no third party in the data path.',
    comparison: [
      {
        feature: 'Where backups run',
        dockstash: 'Entirely on your production VPS → your storage VPS over SSH',
        competitor: 'Orchestrated through the SimpleBackups platform',
        dockstashWins: true,
      },
      {
        feature: 'Data sovereignty',
        dockstash: 'You hold the repos and keys; nothing transits a vendor',
        competitor: 'Backup pipeline and credentials flow through their SaaS',
        dockstashWins: true,
      },
      {
        feature: 'Docker Compose stack detection',
        dockstash: 'Auto-scans volumes, DBs, compose/.env, reverse-proxy config',
        competitor: 'Source-oriented; not a Compose-stack scanner',
        dockstashWins: true,
      },
      {
        feature: 'Pricing model',
        dockstash: 'Free self-host tier; flat paid tiers for scale',
        competitor: 'Recurring SaaS subscription that scales with sources',
        dockstashWins: true,
      },
      {
        feature: 'Setup effort',
        dockstash: 'Self-host the agent, then auto-scan and confirm',
        competitor: 'No self-hosting — sign up and connect',
      },
      {
        feature: 'Restore verification',
        dockstash: 'Automated restore-drill diff against source',
        competitor: 'Backup monitoring and notifications',
        dockstashWins: true,
      },
      {
        feature: 'Non-Docker sources',
        dockstash: 'Focused on Docker projects on your VPS',
        competitor: 'Broad: managed DBs, servers, SaaS, storage',
      },
    ],
    migrationNotes:
      'Because SimpleBackups stores to your cloud buckets, migrating means standing up a Dockstash agent on the production VPS, pointing it at your storage VPS, and letting it auto-scan the Compose stack. Keep the SimpleBackups schedule running until Dockstash produces a passing restore drill, then decommission it. There is no repo format to convert — you start fresh restic repos you fully own.',
    faq: [
      {
        question: 'Is Dockstash cheaper than SimpleBackups?',
        answer:
          'For self-hosters, yes — the free tier runs without any paid provider and stores to your own VPS. You pay Dockstash only for scale and support, and you avoid per-source SaaS fees.',
      },
      {
        question: 'Does SimpleBackups hold my data?',
        answer:
          'Your backups land in storage you configure, but the scheduling and credentials run through their platform. Dockstash keeps the entire pipeline on your servers, so no third party sits in the data path.',
      },
      {
        question: 'Can SimpleBackups back up a full Docker Compose stack?',
        answer:
          'It backs up databases and servers you connect, but it does not scan a running Compose project to detect every volume, database, and reverse-proxy config the way Dockstash does.',
      },
      {
        question: 'What happens to my backups if I stop paying Dockstash?',
        answer:
          'They stay on your storage VPS as standard restic repos you can restore from with the restic CLI alone. There is no vendor to lose access to.',
      },
    ],
    lastReviewed: '2026-07',
  },

  duplicati: {
    slug: 'duplicati',
    name: 'Duplicati',
    category: 'Open-source GUI backup client',
    positioning:
      'Duplicati is a free, cross-platform backup client with a friendly web GUI and many storage backends. It is a capable file-and-folder backup tool for desktops and servers. For Dockerized production stacks it falls short: no database adapters, no Compose detection, and a long-standing reputation for restore edge-cases you do not want on recovery day.',
    pricing: 'Free / open-source',
    strengths: [
      'Free and open-source with a long history and large user base',
      'Friendly web GUI with scheduling and email notifications built in',
      'Wide range of storage backends (S3, B2, cloud drives, SFTP, and more)',
      'Client-side encryption and deduplication',
    ],
    weaknesses: [
      'Well-documented history of restore and database-consistency edge cases',
      'Not Docker-aware: no adapters, so live database files get copied instead of dumped',
      'No Compose/volume/reverse-proxy auto-detection of a running stack',
      'No automated restore-drill to prove a backup actually recovers',
    ],
    bestFor:
      'Individuals backing up files and folders from a desktop or server who want a free GUI with many storage targets.',
    switchIf:
      'You run production databases in Docker and need consistent dumps plus proof that a restore works, not a file-level copy you hope recovers.',
    comparison: [
      {
        feature: 'Database dump adapters',
        dockstash: 'Postgres/MySQL/MariaDB/Mongo dumped from the running container',
        competitor: 'None — file-level backup of whatever paths you select',
        dockstashWins: true,
      },
      {
        feature: 'Docker Compose detection',
        dockstash: 'Auto-scans the stack: volumes, DBs, compose/.env, proxy config',
        competitor: 'Manual source and folder selection',
        dockstashWins: true,
      },
      {
        feature: 'Restore reliability track record',
        dockstash: 'Restic engine plus automated restore-drill diff each schedule',
        competitor: 'Historically prone to restore/consistency edge cases',
        dockstashWins: true,
      },
      {
        feature: 'Backup engine',
        dockstash: 'Restic (widely audited, standard repo format)',
        competitor: 'Custom Duplicati block format',
        dockstashWins: true,
      },
      {
        feature: 'Failure alerting',
        dockstash: 'Email alerts + dead-man’s-switch heartbeat',
        competitor: 'Email notifications on job result',
      },
      {
        feature: 'Price',
        dockstash: 'Free self-host tier; paid tiers for scale',
        competitor: 'Free and open-source',
      },
      {
        feature: 'Storage backends',
        dockstash: 'Your storage VPS over SSH (restic)',
        competitor: 'Many cloud and remote backends',
      },
    ],
    migrationNotes:
      'Duplicati uses its own block/archive format, so there is no in-place repo conversion — you start fresh restic repos with Dockstash. Run both in parallel during the cutover: keep Duplicati until Dockstash produces a green restore drill, then retire it. Moving off Duplicati is also a good moment to switch database sources from file copies to container dumps.',
    faq: [
      {
        question: 'Can I reuse my Duplicati backups in Dockstash?',
        answer:
          'No — Duplicati uses its own archive format, while Dockstash writes standard restic repositories. You start new restic repos; run both tools in parallel until Dockstash’s restore drill passes.',
      },
      {
        question: 'Why does Duplicati’s restore reputation matter?',
        answer:
          'A backup is only as good as its restore. Duplicati has a documented history of restore and consistency edge cases. Dockstash uses restic and drills the restore automatically, so recovery is verified in advance.',
      },
      {
        question: 'Does Duplicati handle my Postgres container?',
        answer:
          'It can back up the files on disk, but copying a live Postgres data directory is not a consistent dump and may not restore. Dockstash runs pg_dumpall inside the container first.',
      },
      {
        question: 'Is Dockstash also free?',
        answer:
          'Yes, there is a free self-host tier that runs without any paid provider. Paid tiers add scheduling scale, alerts, and more projects.',
      },
    ],
    lastReviewed: '2026-07',
  },

  'restic-cron-scripts': {
    slug: 'restic-cron-scripts',
    name: 'Manual restic + cron scripts',
    category: 'DIY do-it-yourself backup scripts',
    positioning:
      'Hand-written restic plus cron plus pg_dump scripts are the real incumbent for most self-hosters. They are free, transparent, and fully under your control. The problem is everything you have to build and maintain yourself: consistent DB dumps, retention, encryption discipline, failure alerting, and restore testing — the parts that fail silently.',
    pricing: 'Free (your time is the cost)',
    strengths: [
      'Zero software cost and total transparency — you own every line',
      'Maximum flexibility: script exactly the behavior you want',
      'No dependency on any product or vendor staying alive',
      'Uses restic directly, so repos are standard and portable',
    ],
    weaknesses: [
      'You must hand-write consistent DB dumps and it is easy to get them subtly wrong',
      'No UI, no retention policy management, no scheduling dashboard',
      'Silent-stall risk: cron jobs stop running and nothing tells you',
      'No restore drill — most DIY scripts are never restore-tested until disaster',
      'Every new project and every VPS is another script to maintain',
    ],
    bestFor:
      'Engineers who enjoy owning their tooling, have one or two servers, and will genuinely maintain and restore-test their scripts.',
    switchIf:
      'Your scripts are fragile, you are unsure the dumps are consistent, or you have ever wondered whether a backup silently stopped running.',
    comparison: [
      {
        feature: 'Consistent database dumps',
        dockstash: 'Adapters run the correct dump per engine, verified by the restore drill',
        competitor: 'You write the dump command and hope the flags are right',
        dockstashWins: true,
      },
      {
        feature: 'Setup and maintenance effort',
        dockstash: 'Auto-scan the stack and confirm checkboxes; no script to maintain',
        competitor: 'Author and maintain scripts per project and per server',
        dockstashWins: true,
      },
      {
        feature: 'Silent-failure detection',
        dockstash: 'Dead-man’s-switch heartbeat + email alerts on any failure',
        competitor: 'None unless you build your own monitoring',
        dockstashWins: true,
      },
      {
        feature: 'Restore verification',
        dockstash: 'Automated restore-to-scratch diff against source',
        competitor: 'Manual, if ever — usually untested',
        dockstashWins: true,
      },
      {
        feature: 'Compose / reverse-proxy detection',
        dockstash: 'Automatic',
        competitor: 'You enumerate paths by hand',
        dockstashWins: true,
      },
      {
        feature: 'Backup engine',
        dockstash: 'Restic (same as your scripts)',
        competitor: 'Restic',
      },
      {
        feature: 'Cost',
        dockstash: 'Free self-host tier; paid for scale',
        competitor: 'Free, but costs your time',
      },
      {
        feature: 'Ownership / lock-in',
        dockstash: 'Standard restic repos on your storage VPS',
        competitor: 'Fully yours',
      },
    ],
    migrationNotes:
      'This is the easiest migration because you are already on restic. Point Dockstash at your existing repo and password and it reads your snapshots. Then let the adapters replace your hand-written dump commands so DB consistency and retention are handled for you, and enable the restore drill so you finally know the backups recover. Keep the cron script until the first green drill, then disable it.',
    faq: [
      {
        question: 'My restic + cron script already works — why switch?',
        answer:
          'It works until it does not: a version bump breaks a dump flag, cron silently stops, or the dump was never consistent and the restore fails. Dockstash hardens that script, alerts on failure, and proves restores with an automated drill.',
      },
      {
        question: 'Can Dockstash read the restic repo my script created?',
        answer:
          'Yes. Dockstash uses standard restic repositories. Give it the same repo path and password and your existing snapshots appear immediately.',
      },
      {
        question: 'Is my pg_dump command wrong?',
        answer:
          'Maybe not — but subtle issues (dumping a single DB instead of pg_dumpall, missing --single-transaction on MySQL, no --oplog on Mongo) produce torn dumps that only surface on restore. Dockstash uses the correct dump per engine and drill-tests it.',
      },
      {
        question: 'Do I lose control by switching?',
        answer:
          'No. The repos stay standard restic on your own storage VPS. If you ever leave, restore with the restic CLI directly — Dockstash adds no proprietary layer.',
      },
    ],
    lastReviewed: '2026-07',
  },

  'provider-snapshots': {
    slug: 'provider-snapshots',
    name: 'Provider volume snapshots',
    category: 'Whole-disk cloud snapshots',
    positioning:
      'Provider volume snapshots (Hetzner, DigitalOcean, AWS EBS, and similar) are whole-disk point-in-time copies taken at the hypervisor. They are cheap, one-click, and great for fast full-server rollback. They are not application- or database-consistent: a snapshot taken mid-write can capture a torn Postgres page, and you cannot restore a single project or table.',
    pricing: 'Cheap add-on billed per GB by your provider',
    strengths: [
      'One-click and fully managed by your cloud provider',
      'Fast whole-server rollback to a point in time',
      'No agent to install and almost no configuration',
      'Cheap per-GB pricing at most providers',
    ],
    weaknesses: [
      'Not application- or database-consistent — a mid-write snapshot can be a torn, unrestorable DB',
      'All-or-nothing: you cannot restore a single project, volume, or table',
      'Lives in the same provider account as the server it protects (weaker isolation)',
      'No dump adapters, no restore-drill diff, no per-project reporting',
    ],
    bestFor:
      'Fast full-machine rollback and a coarse safety net — best used alongside real application backups, not instead of them.',
    switchIf:
      'You need database-consistent, restorable, per-project backups that live off the production provider and are proven by a restore drill.',
    comparison: [
      {
        feature: 'Database consistency',
        dockstash: 'Consistent per-engine dumps (pg_dumpall, --single-transaction, --oplog)',
        competitor: 'Disk-level snapshot; can capture a torn DB mid-write',
        dockstashWins: true,
      },
      {
        feature: 'Granular restore',
        dockstash: 'Restore a single project, volume, or database snapshot',
        competitor: 'Whole-disk only — all or nothing',
        dockstashWins: true,
      },
      {
        feature: 'Off-provider isolation',
        dockstash: 'Stored on your separate storage VPS over SSH',
        competitor: 'Usually in the same provider account as the server',
        dockstashWins: true,
      },
      {
        feature: 'Restore verification',
        dockstash: 'Automated restore-drill diff against source',
        competitor: 'None — you assume the snapshot boots',
        dockstashWins: true,
      },
      {
        feature: 'Setup effort',
        dockstash: 'Install agent, auto-scan, confirm',
        competitor: 'One click in the provider console',
      },
      {
        feature: 'Cost',
        dockstash: 'Free self-host tier; you pay for your own storage',
        competitor: 'Cheap per-GB provider fee',
      },
      {
        feature: 'Encryption / ownership',
        dockstash: 'Restic-encrypted with your key on your storage',
        competitor: 'Managed by the provider',
      },
    ],
    migrationNotes:
      'Snapshots and Dockstash are complementary rather than mutually exclusive. Keep provider snapshots for fast whole-machine rollback, and add Dockstash for consistent, granular, off-provider, verified application backups. Install the agent, auto-scan the Compose projects, point at a storage VPS in a different account or region, and rely on the restore drill for the recovery guarantee snapshots cannot give.',
    faq: [
      {
        question: 'Are provider snapshots a real backup?',
        answer:
          'They are a coarse safety net, not an application backup. A whole-disk snapshot taken while Postgres is writing can capture a torn page that will not restore. Use them for fast rollback, and use Dockstash for consistent, restorable data backups.',
      },
      {
        question: 'Can I restore just one database from a snapshot?',
        answer:
          'No. Volume snapshots are all-or-nothing at the disk level. Dockstash restores a single project, volume, or database dump so you are not forced into a full-server rollback.',
      },
      {
        question: 'Should I stop taking snapshots if I use Dockstash?',
        answer:
          'No need. They are cheap and good for fast machine-level rollback. Run both: snapshots for the whole box, Dockstash for consistent, off-provider, verified application data.',
      },
      {
        question: 'Why does off-provider storage matter?',
        answer:
          'Snapshots usually live in the same provider account as the server. If that account or region is compromised or lost, so are the snapshots. Dockstash stores to a separate storage VPS you control.',
      },
    ],
    lastReviewed: '2026-07',
  },
};

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS[slug];
}
