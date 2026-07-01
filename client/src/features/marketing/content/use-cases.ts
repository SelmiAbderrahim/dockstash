// Per-app use-case backup dataset. Each record composes ServiceGuide slugs
// (the databases the app runs) with the app's own volumes and config, and
// specifies an ordered, real backup plan: dump every database the correct
// way, capture the data volumes, then capture compose + .env config.

import type { UseCaseApp } from '../types';

export const USE_CASES: Record<string, UseCaseApp> = {
  wordpress: {
    slug: 'wordpress',
    appName: 'WordPress',
    category: 'CMS',
    composeServices: ['wordpress', 'mysql'],
    detectedDbs: ['mysql'],
    detectedVolumes: ['wp_data (/var/www/html)', 'db_data (/var/lib/mysql)'],
    configPaths: ['docker-compose.yml', '.env', 'wp-content', 'uploads.ini'],
    backupPlan: [
      {
        title: 'Dump the MySQL database',
        detail:
          'Run mysqldump --all-databases --single-transaction --routines --triggers inside the db container so the WordPress schema and content are captured at one consistent point without locking writers.',
      },
      {
        title: 'Capture the wp-content volume',
        detail:
          'Restic the wp_data volume (themes, plugins, and the uploads directory). This is where all media and customizations live outside the database.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml, .env (DB credentials, salts), and any php/uploads.ini overrides so the stack rebuilds identically.',
      },
    ],
    restoreNotes:
      'Restore the mysqldump into a staging database first, then swap it in; restore wp-content alongside so media URLs resolve. Keep the .env salts consistent or existing sessions and encrypted values break.',
    faq: [
      {
        question: 'Is backing up the MySQL database enough for WordPress?',
        answer:
          'No. WordPress stores posts and settings in MySQL but keeps themes, plugins, and all uploaded media in wp-content on disk. You need both the database dump and the wp-content volume to fully restore.',
      },
      {
        question: 'Why not just copy the MySQL data directory?',
        answer:
          'A live /var/lib/mysql copy is inconsistent and often will not restore. Dockstash runs mysqldump --single-transaction inside the container for a consistent, restorable dump.',
      },
      {
        question: 'Do I need to back up wp-config.php?',
        answer:
          'Yes — capture it via the project directory or .env. It holds the database credentials and authentication salts your restored site needs to match.',
      },
    ],
    relatedGuides: ['mysql', 'mariadb'],
    lastReviewed: '2026-07',
  },

  ghost: {
    slug: 'ghost',
    appName: 'Ghost',
    category: 'Publishing / Blog',
    composeServices: ['ghost', 'mysql'],
    detectedDbs: ['mysql', 'sqlite'],
    detectedVolumes: ['ghost_content (/var/lib/ghost/content)', 'db_data (/var/lib/mysql)'],
    configPaths: ['docker-compose.yml', '.env', 'config.production.json'],
    backupPlan: [
      {
        title: 'Dump the database',
        detail:
          'For a MySQL-backed Ghost, run mysqldump --single-transaction. For the SQLite default, use sqlite3 ".backup" on the content/data/ghost.db file through the online backup API.',
      },
      {
        title: 'Capture the content directory',
        detail:
          'Restic the ghost_content volume: images, themes, and member data under /var/lib/ghost/content live outside the database.',
      },
      {
        title: 'Capture compose and config',
        detail:
          'Restic docker-compose.yml, .env, and config.production.json so mail, URL, and database settings are preserved.',
      },
    ],
    restoreNotes:
      'Restore the database dump to staging, then restore the content directory so image references resolve. If using SQLite, replace ghost.db while Ghost is stopped to avoid WAL races.',
    faq: [
      {
        question: 'Does Ghost use MySQL or SQLite?',
        answer:
          'Both are supported. Production Ghost typically uses MySQL; smaller installs default to SQLite. Dockstash detects which is configured and dumps it the correct way — mysqldump or sqlite3 ".backup".',
      },
      {
        question: 'What is in the Ghost content directory?',
        answer:
          'Uploaded images, installed themes, and member/media assets. It lives on disk separate from the database, so it must be backed up alongside the DB dump.',
      },
      {
        question: 'Can I copy the SQLite ghost.db while Ghost runs?',
        answer:
          'Not safely under WAL — you would miss the -wal sidecar and capture a torn file. Dockstash uses the SQLite online backup API instead.',
      },
    ],
    relatedGuides: ['mysql', 'sqlite'],
    lastReviewed: '2026-07',
  },

  n8n: {
    slug: 'n8n',
    appName: 'n8n',
    category: 'Workflow automation',
    composeServices: ['n8n', 'postgres'],
    detectedDbs: ['postgres'],
    detectedVolumes: ['n8n_data (/home/node/.n8n)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Dump the PostgreSQL database',
        detail:
          'Run pg_dumpall -U "$POSTGRES_USER" inside the db container to capture all workflows, credentials, and execution history in one consistent snapshot.',
      },
      {
        title: 'Capture the n8n data volume',
        detail:
          'Restic the /home/node/.n8n volume, which holds the encryption key and local files. Without the encryption key the restored credentials cannot be decrypted.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env — the N8N_ENCRYPTION_KEY and database settings must match on restore or stored credentials are unreadable.',
      },
    ],
    restoreNotes:
      'The N8N_ENCRYPTION_KEY (in .env or the .n8n data dir) is critical: restore it exactly, or every stored credential becomes undecryptable even with a perfect database restore.',
    faq: [
      {
        question: 'Why is the n8n encryption key so important to back up?',
        answer:
          'n8n encrypts stored credentials with N8N_ENCRYPTION_KEY. If you restore the Postgres database but lose the key, none of your workflow credentials can be decrypted. Back up the key and the database together.',
      },
      {
        question: 'Where does n8n store workflows?',
        answer:
          'In PostgreSQL (or SQLite for small setups). Dockstash runs pg_dumpall for a consistent snapshot of workflows, credentials metadata, and execution history.',
      },
      {
        question: 'Do I need the .n8n data volume too?',
        answer:
          'Yes — it holds the encryption key and any local binary data. Capture it alongside the database dump for a complete restore.',
      },
    ],
    relatedGuides: ['postgres', 'sqlite'],
    lastReviewed: '2026-07',
  },

  supabase: {
    slug: 'supabase',
    appName: 'Supabase',
    category: 'Backend-as-a-Service',
    composeServices: ['supabase-db (postgres)', 'storage', 'kong', 'auth', 'rest'],
    detectedDbs: ['postgres'],
    detectedVolumes: ['db_data (/var/lib/postgresql/data)', 'storage_data (uploaded files)'],
    configPaths: ['docker-compose.yml', '.env', 'volumes/api/kong.yml'],
    backupPlan: [
      {
        title: 'Dump the PostgreSQL cluster',
        detail:
          'Run pg_dumpall -U "$POSTGRES_USER" against the supabase-db container to capture auth, storage metadata, and all your application schemas including roles.',
      },
      {
        title: 'Capture the storage volume',
        detail:
          'Restic the storage volume that holds uploaded files. Supabase Storage keeps object metadata in Postgres but the binary objects live on disk (or in the bundled MinIO/S3).',
      },
      {
        title: 'Capture compose, .env, and gateway config',
        detail:
          'Restic docker-compose.yml, .env (JWT secret, service keys), and kong.yml so the API gateway and auth secrets match on restore.',
      },
    ],
    restoreNotes:
      'Restore pg_dumpall (which includes roles used by RLS policies) to staging, then restore the storage volume so object rows and files stay in sync. The JWT secret in .env must be preserved or issued tokens and auth break.',
    faq: [
      {
        question: 'What makes Supabase backups more than just Postgres?',
        answer:
          'Supabase is Postgres plus auth, storage, and an API gateway. You need pg_dumpall (including roles for row-level security), the storage volume for uploaded files, and the .env secrets (JWT) for auth to work after restore.',
      },
      {
        question: 'Why pg_dumpall instead of pg_dump for Supabase?',
        answer:
          'Supabase relies heavily on Postgres roles for row-level security. pg_dumpall captures global objects like roles; a plain pg_dump would omit them and break RLS on restore.',
      },
      {
        question: 'Where are uploaded files stored?',
        answer:
          'Supabase Storage keeps metadata in Postgres and the binary objects on disk (or in bundled object storage). Back up both so file references resolve after a restore.',
      },
    ],
    relatedGuides: ['postgres', 'minio'],
    lastReviewed: '2026-07',
  },

  nextcloud: {
    slug: 'nextcloud',
    appName: 'Nextcloud',
    category: 'File sync / Collaboration',
    composeServices: ['nextcloud', 'mariadb', 'redis'],
    detectedDbs: ['mariadb', 'postgres', 'mysql'],
    detectedVolumes: ['nextcloud_data (/var/www/html/data)', 'db_data (/var/lib/mysql)'],
    configPaths: ['docker-compose.yml', '.env', 'config/config.php'],
    backupPlan: [
      {
        title: 'Enable maintenance mode (recommended)',
        detail:
          'Put Nextcloud into maintenance mode (occ maintenance:mode --on) so files and database stay consistent with each other during the backup window.',
      },
      {
        title: 'Dump the database',
        detail:
          'Run mariadb-dump/mysqldump --single-transaction (or pg_dumpall for a Postgres backend) to capture file metadata, shares, and user accounts consistently.',
      },
      {
        title: 'Capture the data directory and config',
        detail:
          'Restic the nextcloud_data volume (all user files) and config/config.php plus .env. File contents on disk must match the metadata in the database dump.',
      },
    ],
    restoreNotes:
      'Nextcloud file metadata in the database must match the files on disk — back up both under maintenance mode. Restore config.php with the same instanceid, secret, and passwordsalt or the instance rejects the data.',
    faq: [
      {
        question: 'Do Nextcloud files and database need to be consistent?',
        answer:
          'Yes. The database holds file metadata, shares, and sync state; the data directory holds the actual files. If they drift, sync breaks. Back them up together, ideally under maintenance mode.',
      },
      {
        question: 'Which database does Nextcloud use?',
        answer:
          'Commonly MariaDB or MySQL, sometimes PostgreSQL. Dockstash detects which and dumps it correctly — --single-transaction for MariaDB/MySQL or pg_dumpall for Postgres.',
      },
      {
        question: 'What in config.php matters for restore?',
        answer:
          'The instanceid, secret, and passwordsalt values. Restore them exactly or Nextcloud will not decrypt existing data or accept the restored database.',
      },
    ],
    relatedGuides: ['mariadb', 'mysql', 'postgres'],
    lastReviewed: '2026-07',
  },

  gitea: {
    slug: 'gitea',
    appName: 'Gitea',
    category: 'Git hosting',
    composeServices: ['gitea', 'postgres'],
    detectedDbs: ['postgres', 'mysql', 'sqlite'],
    detectedVolumes: ['gitea_data (/data)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env', 'gitea/conf/app.ini'],
    backupPlan: [
      {
        title: 'Dump the database',
        detail:
          'Run pg_dumpall (or mysqldump --single-transaction, or sqlite3 ".backup") to capture users, issues, pull requests, and repository metadata consistently.',
      },
      {
        title: 'Capture the Gitea data directory',
        detail:
          'Restic the /data volume, which holds the actual git repositories, LFS objects, avatars, and attachments — the repos live here, not in the database.',
      },
      {
        title: 'Capture compose and app.ini',
        detail:
          'Restic docker-compose.yml, .env, and gitea/conf/app.ini so the SECRET_KEY and INTERNAL_TOKEN match; they are needed to decrypt stored secrets on restore.',
      },
    ],
    restoreNotes:
      'The database holds issues and metadata while /data holds the actual git repositories — restore both. Preserve SECRET_KEY and INTERNAL_TOKEN from app.ini or 2FA secrets and tokens break.',
    faq: [
      {
        question: 'Are my git repositories in the database?',
        answer:
          'No. Gitea stores repository metadata (users, issues, PRs) in the database but keeps the actual git repositories, LFS objects, and attachments in the /data directory. You need both.',
      },
      {
        question: 'Which databases does Gitea support?',
        answer:
          'PostgreSQL, MySQL/MariaDB, and SQLite. Dockstash detects the configured backend and dumps it the correct way for that engine.',
      },
      {
        question: 'What is app.ini and why back it up?',
        answer:
          'It is Gitea’s config, including SECRET_KEY and INTERNAL_TOKEN used to encrypt stored secrets and sign tokens. Restore it or 2FA and stored credentials break.',
      },
    ],
    relatedGuides: ['postgres', 'mysql', 'sqlite'],
    lastReviewed: '2026-07',
  },

  plausible: {
    slug: 'plausible',
    appName: 'Plausible Analytics',
    category: 'Analytics',
    composeServices: ['plausible', 'postgres', 'clickhouse'],
    detectedDbs: ['postgres', 'clickhouse'],
    detectedVolumes: ['pg_data (/var/lib/postgresql/data)', 'clickhouse_data (/var/lib/clickhouse)'],
    configPaths: ['docker-compose.yml', '.env', 'clickhouse/clickhouse-config.xml'],
    backupPlan: [
      {
        title: 'Dump the PostgreSQL metadata database',
        detail:
          'Run pg_dumpall -U "$POSTGRES_USER" to capture sites, users, and configuration. Postgres holds account and site metadata, not the event stream.',
      },
      {
        title: 'Back up the ClickHouse event store',
        detail:
          'Use the ClickHouse BACKUP statement (or clickhouse-backup) to snapshot the analytics events table consistently — never copy /var/lib/clickhouse live.',
      },
      {
        title: 'Capture compose and config',
        detail:
          'Restic docker-compose.yml, .env (SECRET_KEY_BASE), and the clickhouse config so both databases reconnect correctly on restore.',
      },
    ],
    restoreNotes:
      'Plausible splits data across two databases: Postgres for metadata and ClickHouse for the raw event stream. Restore both — a Postgres-only restore loses all analytics history. Preserve SECRET_KEY_BASE in .env.',
    faq: [
      {
        question: 'Why does Plausible use two databases?',
        answer:
          'PostgreSQL stores account, site, and configuration metadata; ClickHouse stores the high-volume analytics event stream. A complete backup dumps both — miss ClickHouse and you lose all historical stats.',
      },
      {
        question: 'How do I back up the ClickHouse part?',
        answer:
          'Use the native BACKUP statement or clickhouse-backup for a consistent snapshot of the events table. Copying /var/lib/clickhouse live is inconsistent because parts merge in the background.',
      },
      {
        question: 'Is the Postgres backup alone enough?',
        answer:
          'No. It only captures metadata. Without the ClickHouse backup you would restore your site list but none of the collected analytics data.',
      },
    ],
    relatedGuides: ['postgres', 'clickhouse'],
    lastReviewed: '2026-07',
  },

  umami: {
    slug: 'umami',
    appName: 'Umami',
    category: 'Analytics',
    composeServices: ['umami', 'postgres'],
    detectedDbs: ['postgres', 'mysql'],
    detectedVolumes: ['db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Dump the database',
        detail:
          'Run pg_dumpall -U "$POSTGRES_USER" (or mysqldump --single-transaction for a MySQL backend) to capture websites, sessions, and all pageview events in one consistent snapshot.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env. The APP_SECRET signs sessions and must match on restore, and DATABASE_URL must point at the restored database.',
      },
    ],
    restoreNotes:
      'Umami keeps everything — websites, sessions, and events — in a single relational database, so a consistent dump is the whole backup. Preserve APP_SECRET or existing login sessions are invalidated.',
    faq: [
      {
        question: 'Is a single database dump enough for Umami?',
        answer:
          'Yes. Umami stores all its data — sites, sessions, and pageview events — in one relational database. A consistent pg_dumpall or mysqldump --single-transaction captures everything.',
      },
      {
        question: 'Does Umami use Postgres or MySQL?',
        answer:
          'Either. Dockstash detects the configured backend from DATABASE_URL and runs the correct dump command for that engine.',
      },
      {
        question: 'What does APP_SECRET do?',
        answer:
          'It signs authentication tokens. Preserve it in .env on restore or all existing user sessions become invalid.',
      },
    ],
    relatedGuides: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  directus: {
    slug: 'directus',
    appName: 'Directus',
    category: 'Headless CMS',
    composeServices: ['directus', 'postgres', 'redis'],
    detectedDbs: ['postgres', 'mysql'],
    detectedVolumes: ['directus_uploads (/directus/uploads)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env', 'extensions'],
    backupPlan: [
      {
        title: 'Dump the database',
        detail:
          'Run pg_dumpall (or mysqldump --single-transaction) to capture collections, fields, roles, permissions, and file metadata consistently.',
      },
      {
        title: 'Capture the uploads directory',
        detail:
          'Restic the /directus/uploads volume. Directus stores file metadata in the database but the binary assets live on disk (or configured object storage).',
      },
      {
        title: 'Capture compose, .env, and extensions',
        detail:
          'Restic docker-compose.yml, .env (KEY and SECRET), and the extensions directory so custom endpoints and hooks are restored.',
      },
    ],
    restoreNotes:
      'File metadata in the database must match the assets in /directus/uploads — restore both. Preserve the KEY and SECRET from .env or session tokens and cached data become invalid.',
    faq: [
      {
        question: 'Where does Directus store uploaded files?',
        answer:
          'File metadata lives in the database, but the actual assets are stored in /directus/uploads (or configured object storage). Back up both so file references resolve after restore.',
      },
      {
        question: 'What database backends does Directus support?',
        answer:
          'PostgreSQL and MySQL/MariaDB are the common choices. Dockstash detects the backend and dumps it consistently for that engine.',
      },
      {
        question: 'Why back up the KEY and SECRET env values?',
        answer:
          'They sign and encrypt tokens. Restoring the database without matching KEY/SECRET invalidates sessions and any encrypted values.',
      },
    ],
    relatedGuides: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  strapi: {
    slug: 'strapi',
    appName: 'Strapi',
    category: 'Headless CMS',
    composeServices: ['strapi', 'postgres'],
    detectedDbs: ['postgres', 'mysql', 'sqlite'],
    detectedVolumes: ['strapi_uploads (/opt/app/public/uploads)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env', 'config'],
    backupPlan: [
      {
        title: 'Dump the database',
        detail:
          'Run pg_dumpall (or mysqldump --single-transaction, or sqlite3 ".backup") to capture content types, entries, users, and permissions consistently.',
      },
      {
        title: 'Capture the uploads directory',
        detail:
          'Restic the public/uploads volume where Strapi’s media library stores files. The database holds metadata; the files live on disk.',
      },
      {
        title: 'Capture compose, .env, and config',
        detail:
          'Restic docker-compose.yml, .env (APP_KEYS, JWT_SECRET, API_TOKEN_SALT), and the config directory so authentication and encryption survive restore.',
      },
    ],
    restoreNotes:
      'Restore the database and the uploads directory together so media references resolve. The APP_KEYS, JWT_SECRET, and API_TOKEN_SALT in .env must be preserved or tokens and admin sessions break.',
    faq: [
      {
        question: 'Does Strapi keep media in the database?',
        answer:
          'No — only file metadata. The actual media files live in public/uploads (or configured provider storage). Back up both the database dump and the uploads volume.',
      },
      {
        question: 'Which database does Strapi use?',
        answer:
          'PostgreSQL, MySQL/MariaDB, or SQLite. Dockstash detects the configured connection and dumps it the correct way for that engine.',
      },
      {
        question: 'What secrets must I preserve for Strapi?',
        answer:
          'APP_KEYS, JWT_SECRET, and API_TOKEN_SALT from .env. Without matching values, admin sessions and API tokens are invalidated after restore.',
      },
    ],
    relatedGuides: ['postgres', 'mysql', 'sqlite'],
    lastReviewed: '2026-07',
  },

  appwrite: {
    slug: 'appwrite',
    appName: 'Appwrite',
    category: 'Backend-as-a-Service',
    composeServices: ['appwrite', 'mariadb', 'redis'],
    detectedDbs: ['mariadb'],
    detectedVolumes: ['appwrite_uploads (/storage/uploads)', 'appwrite_cache', 'db_data (/var/lib/mysql)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Dump the MariaDB database',
        detail:
          'Run mariadb-dump --all-databases --single-transaction inside the db container to capture projects, collections, documents, and user accounts consistently.',
      },
      {
        title: 'Capture the storage volumes',
        detail:
          'Restic the uploads and functions volumes under /storage. Appwrite stores uploaded files, function code, and certificates on disk, separate from the database.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env (_APP_OPENSSL_KEY_V1) so encrypted values in the database can be decrypted after restore.',
      },
    ],
    restoreNotes:
      'The _APP_OPENSSL_KEY_V1 in .env encrypts secrets stored in MariaDB — restore it exactly or encrypted data is unreadable. Restore the storage volumes alongside the database so file documents resolve.',
    faq: [
      {
        question: 'What database does Appwrite use?',
        answer:
          'MariaDB. Dockstash runs mariadb-dump --single-transaction for a consistent snapshot of projects, collections, documents, and users.',
      },
      {
        question: 'Where are Appwrite files and functions stored?',
        answer:
          'Under /storage volumes on disk — uploads, function code, and certificates. Back these up alongside the database dump for a complete restore.',
      },
      {
        question: 'Why is _APP_OPENSSL_KEY_V1 critical?',
        answer:
          'It encrypts sensitive values stored in the database. Restore the database without the matching key and those values cannot be decrypted.',
      },
    ],
    relatedGuides: ['mariadb', 'mysql'],
    lastReviewed: '2026-07',
  },

  pocketbase: {
    slug: 'pocketbase',
    appName: 'PocketBase',
    category: 'Backend-as-a-Service',
    composeServices: ['pocketbase'],
    detectedDbs: ['sqlite'],
    detectedVolumes: ['pb_data (/pb/pb_data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Back up the SQLite database consistently',
        detail:
          'Use sqlite3 ".backup" (or PocketBase’s built-in backup) on pb_data/data.db through the online backup API — never copy the live .db under WAL.',
      },
      {
        title: 'Capture the pb_data storage',
        detail:
          'Restic the pb_data directory, which holds the database plus uploaded file storage under pb_data/storage. Both live in one volume.',
      },
      {
        title: 'Capture compose config',
        detail:
          'Restic docker-compose.yml and .env so environment settings and the deployment shape are preserved.',
      },
    ],
    restoreNotes:
      'PocketBase keeps its SQLite database and uploaded files together under pb_data. Use the online backup API or PocketBase’s built-in backup, then restore the whole pb_data directory with the app stopped to avoid WAL races.',
    faq: [
      {
        question: 'Can I just copy pb_data to back up PocketBase?',
        answer:
          'Not while it is running — the SQLite database uses WAL, so a live copy can be torn. Use sqlite3 ".backup" or PocketBase’s built-in backup for the database, then capture the storage subdirectory.',
      },
      {
        question: 'Is everything PocketBase needs in one directory?',
        answer:
          'Yes. pb_data holds both the SQLite database and uploaded file storage. Back up the whole directory (with a consistent DB snapshot) for a complete restore.',
      },
      {
        question: 'Does PocketBase have a built-in backup?',
        answer:
          'Yes, it can create a consistent backup archive of pb_data. Dockstash can invoke it or use the SQLite online backup API directly, then restic the result off-site.',
      },
    ],
    relatedGuides: ['sqlite'],
    lastReviewed: '2026-07',
  },

  matomo: {
    slug: 'matomo',
    appName: 'Matomo',
    category: 'Analytics',
    composeServices: ['matomo', 'mysql'],
    detectedDbs: ['mysql', 'mariadb'],
    detectedVolumes: ['matomo_data (/var/www/html)', 'db_data (/var/lib/mysql)'],
    configPaths: ['docker-compose.yml', '.env', 'config/config.ini.php'],
    backupPlan: [
      {
        title: 'Dump the MySQL database',
        detail:
          'Run mysqldump --all-databases --single-transaction inside the db container to capture visits, actions, and all reporting archives consistently — this is the bulk of Matomo data.',
      },
      {
        title: 'Capture the Matomo files and config',
        detail:
          'Restic the matomo_data volume (plugins, GeoIP databases, custom logos) and config/config.ini.php which holds the database credentials and salt.',
      },
      {
        title: 'Capture compose and .env',
        detail:
          'Restic docker-compose.yml and .env so the stack and database connection settings rebuild identically.',
      },
    ],
    restoreNotes:
      'Almost all Matomo data lives in MySQL, so the consistent dump is the core of the backup. Preserve the salt in config.ini.php or stored credentials and API tokens break after restore.',
    faq: [
      {
        question: 'Where does Matomo store its analytics data?',
        answer:
          'In MySQL/MariaDB — visits, actions, and pre-computed report archives. A consistent mysqldump --single-transaction captures the bulk of your Matomo data.',
      },
      {
        question: 'Do I need the file volume as well?',
        answer:
          'Yes, for plugins, GeoIP databases, custom assets, and config.ini.php. The database is the core, but config and plugins are needed for a clean restore.',
      },
      {
        question: 'What in config.ini.php matters?',
        answer:
          'The database credentials and the salt used for token generation. Restore it so API tokens and stored secrets remain valid.',
      },
    ],
    relatedGuides: ['mysql', 'mariadb'],
    lastReviewed: '2026-07',
  },

  mattermost: {
    slug: 'mattermost',
    appName: 'Mattermost',
    category: 'Team chat',
    composeServices: ['mattermost', 'postgres'],
    detectedDbs: ['postgres', 'mysql'],
    detectedVolumes: ['mattermost_data (/mattermost/data)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env', 'config/config.json'],
    backupPlan: [
      {
        title: 'Dump the PostgreSQL database',
        detail:
          'Run pg_dumpall -U "$POSTGRES_USER" to capture channels, posts, users, and team metadata consistently.',
      },
      {
        title: 'Capture the data directory',
        detail:
          'Restic the /mattermost/data volume, which holds file attachments and uploaded images referenced by posts in the database.',
      },
      {
        title: 'Capture compose, .env, and config.json',
        detail:
          'Restic docker-compose.yml, .env, and config/config.json which contains the AtRestEncryptKey and SQL settings needed on restore.',
      },
    ],
    restoreNotes:
      'Posts and metadata are in Postgres while file attachments are under /mattermost/data — restore both so attachments resolve. Preserve config.json (AtRestEncryptKey) or encrypted fields cannot be read.',
    faq: [
      {
        question: 'Are Mattermost file attachments in the database?',
        answer:
          'No. The database holds messages, channels, and users; uploaded files and images live under /mattermost/data. Both are required for a full restore.',
      },
      {
        question: 'Which database does Mattermost use?',
        answer:
          'PostgreSQL is recommended; MySQL is also supported. Dockstash detects the backend and dumps it consistently for that engine.',
      },
      {
        question: 'Why back up config.json?',
        answer:
          'It holds the AtRestEncryptKey and SQL/connection settings. Without the matching key, encrypted fields in the restored database are unreadable.',
      },
    ],
    relatedGuides: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  vaultwarden: {
    slug: 'vaultwarden',
    appName: 'Vaultwarden',
    category: 'Password manager',
    composeServices: ['vaultwarden'],
    detectedDbs: ['sqlite', 'postgres', 'mysql'],
    detectedVolumes: ['vw_data (/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Back up the database consistently',
        detail:
          'For the SQLite default, use sqlite3 ".backup" on /data/db.sqlite3 through the online backup API. For a Postgres/MySQL backend, run pg_dumpall or mysqldump --single-transaction.',
      },
      {
        title: 'Capture the data directory (keys and attachments)',
        detail:
          'Restic the /data volume: rsa_key files, attachments, sends, icon cache, and config.json. The rsa_key is required to issue and validate tokens after restore.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env, including any ADMIN_TOKEN, so the admin panel and settings match on restore.',
      },
    ],
    restoreNotes:
      'The rsa_key files in /data are as important as the database — without them the restored instance cannot validate existing sessions. Vault data is client-side encrypted, but you must still restore the database and keys together. Never copy db.sqlite3 live under WAL.',
    faq: [
      {
        question: 'What must I back up besides the Vaultwarden database?',
        answer:
          'The rsa_key files, attachments, and sends in /data. The rsa_key signs authentication tokens — lose it and the restored server cannot validate sessions even with a perfect database restore.',
      },
      {
        question: 'Is a live copy of db.sqlite3 safe?',
        answer:
          'No — under WAL you can capture a torn file. Use sqlite3 ".backup" via the online backup API, or dump the Postgres/MySQL backend if you configured one.',
      },
      {
        question: 'Are my passwords exposed in the backup?',
        answer:
          'Vault contents are end-to-end encrypted with the user’s master password, so the database stores ciphertext. Still, protect the backup — restic encrypts it at rest with your key.',
      },
    ],
    relatedGuides: ['sqlite', 'postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  'uptime-kuma': {
    slug: 'uptime-kuma',
    appName: 'Uptime Kuma',
    category: 'Monitoring',
    composeServices: ['uptime-kuma'],
    detectedDbs: ['sqlite'],
    detectedVolumes: ['uptime_kuma_data (/app/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Back up the SQLite database consistently',
        detail:
          'Use sqlite3 ".backup" on /app/data/kuma.db through the online backup API — never copy the live .db under WAL, or you miss the -wal sidecar and capture a torn file.',
      },
      {
        title: 'Capture the data directory',
        detail:
          'Restic the /app/data volume, which holds the database plus uploaded icons and TLS certificate info for monitored endpoints.',
      },
      {
        title: 'Capture compose config',
        detail:
          'Restic docker-compose.yml and .env so the deployment and notification settings are preserved.',
      },
    ],
    restoreNotes:
      'Uptime Kuma stores everything — monitors, heartbeat history, and notification config — in one SQLite database under /app/data. Use the online backup API, then restore the whole data directory with the app stopped.',
    faq: [
      {
        question: 'Where does Uptime Kuma keep its data?',
        answer:
          'In a single SQLite database under /app/data, alongside uploaded icons. Monitors, heartbeat history, and notifications all live there, so a consistent DB snapshot plus the data directory is the whole backup.',
      },
      {
        question: 'Can I copy kuma.db directly?',
        answer:
          'Not while it is running — WAL mode means a live copy can be torn. Use sqlite3 ".backup" through the online backup API for a consistent snapshot.',
      },
      {
        question: 'Will I lose heartbeat history on restore?',
        answer:
          'No — heartbeat history is in the SQLite database. A consistent dump preserves it in full.',
      },
    ],
    relatedGuides: ['sqlite'],
    lastReviewed: '2026-07',
  },

  metabase: {
    slug: 'metabase',
    appName: 'Metabase',
    category: 'Business intelligence',
    composeServices: ['metabase', 'postgres'],
    detectedDbs: ['postgres', 'mysql'],
    detectedVolumes: ['metabase_data (application db)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Dump the Metabase application database',
        detail:
          'Run pg_dumpall (or mysqldump --single-transaction) against the Metabase app database to capture dashboards, questions, users, and data-source connection settings consistently.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env, including MB_ENCRYPTION_SECRET_KEY, which encrypts stored data-source credentials in the app database.',
      },
    ],
    restoreNotes:
      'Metabase stores dashboards, questions, and encrypted data-source credentials in its application database. Preserve MB_ENCRYPTION_SECRET_KEY from .env or the connection credentials in the restored database cannot be decrypted. Do not confuse the app DB with the analytics databases Metabase queries — only the app DB needs backing up here.',
    faq: [
      {
        question: 'What does the Metabase application database contain?',
        answer:
          'Dashboards, saved questions, collections, users, and encrypted connection settings for the databases Metabase queries. A consistent dump of this app database is the backup.',
      },
      {
        question: 'Do I need to back up the databases Metabase connects to?',
        answer:
          'Those are separate data sources with their own backups. For Metabase itself you only back up its application database plus the encryption key.',
      },
      {
        question: 'Why is MB_ENCRYPTION_SECRET_KEY important?',
        answer:
          'It encrypts stored data-source credentials in the app database. Restore the database without the matching key and Metabase cannot reconnect to your data sources.',
      },
    ],
    relatedGuides: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },

  nocodb: {
    slug: 'nocodb',
    appName: 'NocoDB',
    category: 'No-code database',
    composeServices: ['nocodb', 'postgres'],
    detectedDbs: ['postgres', 'mysql'],
    detectedVolumes: ['nc_data (/usr/app/data)', 'db_data (/var/lib/postgresql/data)'],
    configPaths: ['docker-compose.yml', '.env'],
    backupPlan: [
      {
        title: 'Dump the metadata database',
        detail:
          'Run pg_dumpall (or mysqldump --single-transaction) against the NocoDB metadata database to capture bases, views, and user/project configuration consistently.',
      },
      {
        title: 'Capture the NocoDB data directory',
        detail:
          'Restic the /usr/app/data volume, which holds uploaded attachments and, for SQLite-backed setups, the metadata database file itself.',
      },
      {
        title: 'Capture compose and .env config',
        detail:
          'Restic docker-compose.yml and .env, including NC_AUTH_JWT_SECRET, so authentication tokens remain valid after restore.',
      },
    ],
    restoreNotes:
      'NocoDB stores project metadata in its metadata database and uploaded attachments under /usr/app/data — restore both. Preserve NC_AUTH_JWT_SECRET or existing sessions and shared-view tokens break. If NocoDB connects to external databases, those have their own backups.',
    faq: [
      {
        question: 'What does NocoDB store in its metadata database?',
        answer:
          'Base definitions, views, grid/gallery configs, users, and project settings. A consistent dump of this metadata database captures the structure of your NocoDB workspace.',
      },
      {
        question: 'Where are uploaded attachments?',
        answer:
          'In the /usr/app/data volume (or configured object storage). Back it up alongside the metadata database so attachment references resolve.',
      },
      {
        question: 'What about the databases NocoDB connects to?',
        answer:
          'Those external data sources are backed up independently. For NocoDB itself, back up the metadata database, the data volume, and the JWT secret.',
      },
    ],
    relatedGuides: ['postgres', 'mysql'],
    lastReviewed: '2026-07',
  },
};

export function getUseCase(slug: string): UseCaseApp | undefined {
  return USE_CASES[slug];
}

export const USE_CASE_SLUGS: string[] = Object.keys(USE_CASES);
