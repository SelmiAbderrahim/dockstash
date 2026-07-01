// Per-service backup guide dataset. Every field maps to the real Dockstash
// adapter behavior so pages are structurally unique by construction. The
// dump/restore commands are the correct, consistent way to back up each
// engine from inside a running container — never a live data-directory copy.

import type { ServiceGuide } from '../types';

export const SERVICE_GUIDES: Record<string, ServiceGuide> = {
  postgres: {
    slug: 'postgres',
    serviceName: 'PostgreSQL',
    aliases: ['Postgres', 'psql', 'pg'],
    dockerImages: ['postgres:16-alpine', 'postgres:16', 'postgres:15', 'postgres'],
    dumpCmd: 'pg_dumpall -U "$POSTGRES_USER"',
    restoreCmd: 'psql -U "$POSTGRES_USER"',
    consistencyNote:
      'pg_dumpall runs each database in a single consistent MVCC snapshot, so the dump is atomic per database even while writes continue.',
    defaultPort: 5432,
    envKeysDetected: ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB'],
    liveDataPaths: ['/var/lib/postgresql/data'],
    gotchas: [
      'Never restic the live /var/lib/postgresql/data directory — a heap page copied mid-write is torn and unrestorable.',
      'pg_dumpall captures roles and all databases; a single pg_dump misses global objects like roles and tablespaces.',
      'Extensions (PostGIS, pgvector) must be installed in the target image before restore or the SQL will error.',
    ],
    faq: [
      {
        question: 'Why pg_dumpall instead of copying the data directory?',
        answer:
          'A live Postgres data directory is being written to constantly. Copying it captures a torn, inconsistent state that will not start. pg_dumpall reads a consistent MVCC snapshot from the running server, producing a dump that restores cleanly.',
      },
      {
        question: 'Does Dockstash lock the database during backup?',
        answer:
          'No. pg_dumpall uses MVCC snapshots, so reads are consistent without blocking writes. Your application keeps serving traffic during the dump.',
      },
      {
        question: 'How do I restore a single database instead of all of them?',
        answer:
          'A pg_dumpall archive is plain SQL; you can restore the whole cluster with psql, or use per-database pg_dump/pg_restore if you only need one. Dockstash restores the full consistent snapshot by default.',
      },
      {
        question: 'What about extensions like PostGIS or pgvector?',
        answer:
          'The dump references CREATE EXTENSION but does not ship the extension binaries. Make sure the restore-target image has the same extensions available before restoring.',
      },
    ],
    relatedServices: ['mysql', 'mariadb', 'mongodb'],
    relatedUseCases: ['n8n', 'supabase', 'directus', 'plausible', 'metabase'],
    lastReviewed: '2026-07',
  },

  mysql: {
    slug: 'mysql',
    serviceName: 'MySQL',
    aliases: ['MySQL', 'mysqld'],
    dockerImages: ['mysql:8', 'mysql:8.0', 'mysql:5.7', 'mysql'],
    dumpCmd: 'mysqldump --all-databases --single-transaction --routines --triggers -uroot -p"$MYSQL_ROOT_PASSWORD"',
    restoreCmd: 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD"',
    consistencyNote:
      '--single-transaction wraps the dump in one transaction so InnoDB tables are captured at a single consistent point without locking writers.',
    defaultPort: 3306,
    envKeysDetected: ['MYSQL_ROOT_PASSWORD', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'],
    liveDataPaths: ['/var/lib/mysql'],
    gotchas: [
      'Never restic the live /var/lib/mysql directory — InnoDB tablespaces copied mid-write are inconsistent and will fail recovery.',
      '--single-transaction only gives a consistent snapshot for transactional (InnoDB) tables; MyISAM tables are not covered and need a lock.',
      'Add --routines and --triggers or stored procedures and triggers are silently dropped from the dump.',
    ],
    faq: [
      {
        question: 'Why is --single-transaction important?',
        answer:
          'Without it, mysqldump reads tables one at a time and a write between tables produces an inconsistent dump. --single-transaction wraps everything in one InnoDB transaction so the whole dump reflects a single point in time, with no write lock.',
      },
      {
        question: 'Does the dump include stored procedures and triggers?',
        answer:
          'Only if you pass --routines and --triggers, which Dockstash includes. A default mysqldump omits them, which is a common cause of a "restored but broken" database.',
      },
      {
        question: 'Can I back up MySQL by copying /var/lib/mysql?',
        answer:
          'No. The InnoDB tablespace and redo logs are written continuously; a file copy mid-write is inconsistent. Dockstash runs mysqldump inside the container instead.',
      },
      {
        question: 'What if I use MyISAM tables?',
        answer:
          '--single-transaction does not make MyISAM consistent because it is non-transactional. If you rely on MyISAM, a brief lock (--lock-tables) is required — migrating those tables to InnoDB is the durable fix.',
      },
    ],
    relatedServices: ['mariadb', 'postgres', 'mongodb'],
    relatedUseCases: ['wordpress', 'matomo', 'umami', 'nextcloud'],
    lastReviewed: '2026-07',
  },

  mariadb: {
    slug: 'mariadb',
    serviceName: 'MariaDB',
    aliases: ['MariaDB', 'mysql-compatible'],
    dockerImages: ['mariadb:11', 'mariadb:10.11', 'mariadb:10', 'mariadb'],
    dumpCmd: 'mariadb-dump --all-databases --single-transaction --routines --triggers -uroot -p"$MARIADB_ROOT_PASSWORD"',
    restoreCmd: 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD"',
    consistencyNote:
      '--single-transaction gives a consistent snapshot of InnoDB/Aria transactional tables at one point in time without blocking writers.',
    defaultPort: 3306,
    envKeysDetected: ['MARIADB_ROOT_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'MARIADB_DATABASE', 'MARIADB_USER'],
    liveDataPaths: ['/var/lib/mysql'],
    gotchas: [
      'Never restic the live /var/lib/mysql directory — a mid-write InnoDB copy is unrestorable.',
      'Newer images ship mariadb-dump; older ones use mysqldump. Dockstash detects which binary the image provides.',
      'MariaDB accepts either MARIADB_ROOT_PASSWORD or the legacy MYSQL_ROOT_PASSWORD env key, so both are detected.',
    ],
    faq: [
      {
        question: 'Is MariaDB backed up the same way as MySQL?',
        answer:
          'Almost identically. Both use --single-transaction for a consistent InnoDB snapshot. The difference is the client binary: recent MariaDB images ship mariadb-dump (mysqldump is a compatibility symlink). Dockstash picks the right one.',
      },
      {
        question: 'Which root password env key does Dockstash detect?',
        answer:
          'Both MARIADB_ROOT_PASSWORD and the older MYSQL_ROOT_PASSWORD are recognized, since MariaDB images accept either depending on version.',
      },
      {
        question: 'Can I restore a MariaDB dump into MySQL or vice versa?',
        answer:
          'Often, but not always — feature and syntax drift between the two can break edge cases. Restore into the same engine family the dump came from for a reliable result.',
      },
      {
        question: 'Why not just snapshot the volume?',
        answer:
          'The /var/lib/mysql volume is written continuously. A snapshot mid-write is inconsistent. A logical dump via mariadb-dump is the restorable path.',
      },
    ],
    relatedServices: ['mysql', 'postgres', 'mongodb'],
    relatedUseCases: ['appwrite', 'wordpress', 'nextcloud'],
    lastReviewed: '2026-07',
  },

  mongodb: {
    slug: 'mongodb',
    serviceName: 'MongoDB',
    aliases: ['Mongo', 'mongod'],
    dockerImages: ['mongo:7', 'mongo:6', 'mongo:5', 'mongo'],
    dumpCmd: 'mongodump --archive --oplog',
    restoreCmd: 'mongorestore --archive --oplogReplay --drop',
    consistencyNote:
      '--oplog captures the replica-set oplog during the dump so mongorestore can replay it and produce a point-in-time-consistent snapshot.',
    defaultPort: 27017,
    envKeysDetected: ['MONGO_INITDB_ROOT_USERNAME', 'MONGO_INITDB_ROOT_PASSWORD', 'MONGO_INITDB_DATABASE'],
    liveDataPaths: ['/data/db'],
    gotchas: [
      'Never restic the live /data/db WiredTiger files — copied mid-checkpoint they are inconsistent and often unrecoverable.',
      '--oplog requires the server to be a replica-set member (even a single-node replica set); on a standalone mongod it is a no-op with no point-in-time guarantee.',
      'On restore, --oplogReplay must accompany --oplog dumps or the point-in-time consistency is lost.',
    ],
    faq: [
      {
        question: 'What does --oplog actually do?',
        answer:
          'It records the operations log entries that occur while mongodump runs and stores them in the archive. On restore, --oplogReplay applies them so the dump reflects a single consistent point in time rather than a smear across the dump window.',
      },
      {
        question: 'Do I need a replica set for consistent backups?',
        answer:
          'For point-in-time consistency, yes — --oplog only works on a replica-set member. Many single-node deployments run as a one-member replica set specifically to get this guarantee.',
      },
      {
        question: 'Why not copy /data/db directly?',
        answer:
          'WiredTiger writes checkpoints continuously. A file copy mid-checkpoint captures an inconsistent state that frequently will not start. mongodump reads a logical, restorable snapshot.',
      },
      {
        question: 'How do I restore into a clean database?',
        answer:
          'mongorestore --archive --oplogReplay --drop drops existing collections before restoring so you do not merge old and new data. Dockstash restores to a staging target first by default.',
      },
    ],
    relatedServices: ['postgres', 'redis', 'elasticsearch'],
    relatedUseCases: ['n8n'],
    lastReviewed: '2026-07',
  },

  redis: {
    slug: 'redis',
    serviceName: 'Redis',
    aliases: ['redis', 'redis-server'],
    dockerImages: ['redis:7-alpine', 'redis:7', 'redis:6', 'redis'],
    dumpCmd: 'redis-cli SAVE  # then capture the resulting dump.rdb',
    restoreCmd: 'place dump.rdb in the data dir and start redis-server',
    consistencyNote:
      'SAVE forks a point-in-time RDB snapshot to dump.rdb; capturing that file (not the live in-memory state) is the consistent unit to back up.',
    defaultPort: 6379,
    envKeysDetected: ['REDIS_PASSWORD', 'REDIS_ARGS'],
    liveDataPaths: ['/data', '/data/dump.rdb', '/data/appendonly.aof'],
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
    ],
    relatedServices: ['valkey', 'mongodb', 'postgres'],
    relatedUseCases: ['mattermost', 'nocodb'],
    lastReviewed: '2026-07',
  },

  valkey: {
    slug: 'valkey',
    serviceName: 'Valkey',
    aliases: ['valkey', 'redis-fork'],
    dockerImages: ['valkey/valkey:8', 'valkey/valkey:7', 'valkey/valkey'],
    dumpCmd: 'valkey-cli SAVE  # then capture the resulting dump.rdb',
    restoreCmd: 'place dump.rdb in the data dir and start valkey-server',
    consistencyNote:
      'Valkey is a Redis fork and uses the same RDB/AOF persistence; SAVE forks a point-in-time RDB that is the consistent unit to back up.',
    defaultPort: 6379,
    envKeysDetected: ['VALKEY_PASSWORD', 'VALKEY_ARGS', 'REDIS_PASSWORD'],
    liveDataPaths: ['/data', '/data/dump.rdb', '/data/appendonly.aof'],
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
    ],
    relatedServices: ['redis', 'mongodb', 'postgres'],
    relatedUseCases: ['mattermost'],
    lastReviewed: '2026-07',
  },

  sqlite: {
    slug: 'sqlite',
    serviceName: 'SQLite',
    aliases: ['sqlite3', 'sqlite'],
    dockerImages: ['embedded (no dedicated image)', 'alpine + sqlite', 'app images bundling sqlite'],
    dumpCmd: 'sqlite3 /data/app.db ".backup \'/tmp/app-backup.db\'"',
    restoreCmd: 'copy the .backup file into place while the app is stopped, or use .restore',
    consistencyNote:
      'The .backup command (or VACUUM INTO) uses SQLite’s online backup API to produce a consistent copy that respects WAL and in-flight transactions.',
    defaultPort: 0,
    envKeysDetected: ['DATABASE_PATH', 'DATABASE_URL', 'DB_PATH'],
    liveDataPaths: ['/data/app.db', '/data/app.db-wal', '/data/app.db-shm'],
    gotchas: [
      'Never copy a live .db file while the app is running under WAL mode — you will miss the -wal/-shm sidecar files and capture a torn, unrestorable database.',
      'Use sqlite3 ".backup" or "VACUUM INTO", both of which use the online backup API and handle WAL correctly.',
      'A checkpoint (PRAGMA wal_checkpoint(TRUNCATE)) before a raw copy is not a substitute for the backup API under concurrent writes.',
    ],
    faq: [
      {
        question: 'Can I just copy the .db file?',
        answer:
          'Not safely while the app is writing. In WAL mode the newest data lives in the -wal sidecar; a plain cp of only the .db captures a stale, torn state. Use sqlite3 ".backup" or "VACUUM INTO" which read a consistent copy through the online backup API.',
      },
      {
        question: 'What is VACUUM INTO?',
        answer:
          'VACUUM INTO \'file.db\' writes a fresh, defragmented, transactionally consistent copy of the database to a new file. It is a clean way to snapshot a live SQLite database without stopping the app.',
      },
      {
        question: 'Do I need to back up the -wal and -shm files?',
        answer:
          'If you use the backup API you do not — it consolidates the WAL into the copy. If you insist on a raw file copy (not recommended live), you must include -wal and -shm, but that is still race-prone.',
      },
      {
        question: 'How do I restore a SQLite backup?',
        answer:
          'Stop the app, replace the database file with the .backup output, and start the app. Because the backup is a single consistent file, there are no sidecars to reconcile.',
      },
    ],
    relatedServices: ['postgres', 'mysql'],
    relatedUseCases: ['pocketbase', 'vaultwarden', 'uptime-kuma', 'gitea', 'ghost'],
    lastReviewed: '2026-07',
  },

  clickhouse: {
    slug: 'clickhouse',
    serviceName: 'ClickHouse',
    aliases: ['clickhouse', 'clickhouse-server'],
    dockerImages: ['clickhouse/clickhouse-server:24', 'clickhouse/clickhouse-server', 'yandex/clickhouse-server'],
    dumpCmd: 'clickhouse-client --query "BACKUP DATABASE default TO Disk(\'backups\', \'snapshot\')"',
    restoreCmd: 'clickhouse-client --query "RESTORE DATABASE default FROM Disk(\'backups\', \'snapshot\')"',
    consistencyNote:
      'The native BACKUP statement takes a consistent snapshot of table parts; clickhouse-backup is an alternative for freezing and shipping parts atomically.',
    defaultPort: 8123,
    envKeysDetected: ['CLICKHOUSE_USER', 'CLICKHOUSE_PASSWORD', 'CLICKHOUSE_DB'],
    liveDataPaths: ['/var/lib/clickhouse'],
    gotchas: [
      'Never restic the live /var/lib/clickhouse/store directory — parts are merged and mutated in the background, so a raw copy is inconsistent.',
      'The BACKUP/RESTORE SQL requires a configured backup disk in the server config; without it, use the clickhouse-backup tool which freezes parts via hardlinks.',
      'Large MergeTree tables produce large backups; incremental restic dedup helps but the initial BACKUP can be sizeable.',
    ],
    faq: [
      {
        question: 'What is the correct way to back up ClickHouse?',
        answer:
          'Use the native BACKUP statement (BACKUP DATABASE ... TO Disk(...)) or the clickhouse-backup tool. Both produce a consistent snapshot of table parts. Dockstash then restics the resulting backup directory.',
      },
      {
        question: 'Can I copy /var/lib/clickhouse instead?',
        answer:
          'No. ClickHouse continuously merges and mutates parts in the background, so a live directory copy is inconsistent. The BACKUP statement or clickhouse-backup freeze the parts safely.',
      },
      {
        question: 'BACKUP statement or clickhouse-backup — which should I use?',
        answer:
          'The native BACKUP statement is simplest when a backup disk is configured. clickhouse-backup is handy for freezing parts via hardlinks and shipping them, especially on older versions. Dockstash supports either output.',
      },
      {
        question: 'Are ClickHouse backups incremental?',
        answer:
          'The BACKUP statement supports incremental backups against a base, and restic adds its own deduplication on top, so repeated snapshots stay compact.',
      },
    ],
    relatedServices: ['postgres', 'elasticsearch', 'influxdb'],
    relatedUseCases: ['plausible'],
    lastReviewed: '2026-07',
  },

  elasticsearch: {
    slug: 'elasticsearch',
    serviceName: 'Elasticsearch',
    aliases: ['elastic', 'es', 'opensearch'],
    dockerImages: ['elasticsearch:8.13.0', 'elasticsearch:8', 'docker.elastic.co/elasticsearch/elasticsearch'],
    dumpCmd: 'PUT _snapshot/<repo>/<snap> via the snapshot API (register a repository first)',
    restoreCmd: 'POST _snapshot/<repo>/<snap>/_restore via the snapshot API',
    consistencyNote:
      'The snapshot API captures a consistent view of each index at a point in time and is incremental across snapshots in the same repository.',
    defaultPort: 9200,
    envKeysDetected: ['ELASTIC_PASSWORD', 'ELASTICSEARCH_USERNAME', 'discovery.type'],
    liveDataPaths: ['/usr/share/elasticsearch/data'],
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
    ],
    relatedServices: ['clickhouse', 'mongodb', 'influxdb'],
    relatedUseCases: [],
    lastReviewed: '2026-07',
  },

  rabbitmq: {
    slug: 'rabbitmq',
    serviceName: 'RabbitMQ',
    aliases: ['rabbit', 'amqp'],
    dockerImages: ['rabbitmq:3.13-management', 'rabbitmq:3-management', 'rabbitmq'],
    dumpCmd: 'rabbitmqctl export_definitions /tmp/definitions.json',
    restoreCmd: 'rabbitmqctl import_definitions /tmp/definitions.json',
    consistencyNote:
      'Definitions (vhosts, exchanges, queues, bindings, users, policies) export cleanly as JSON; the Mnesia message store is not point-in-time consistent while the broker runs.',
    defaultPort: 5672,
    envKeysDetected: ['RABBITMQ_DEFAULT_USER', 'RABBITMQ_DEFAULT_PASS', 'RABBITMQ_DEFAULT_VHOST'],
    liveDataPaths: ['/var/lib/rabbitmq/mnesia'],
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
    ],
    relatedServices: ['redis', 'mongodb'],
    relatedUseCases: [],
    lastReviewed: '2026-07',
  },

  minio: {
    slug: 'minio',
    serviceName: 'MinIO',
    aliases: ['minio', 's3-compatible'],
    dockerImages: ['minio/minio:latest', 'minio/minio', 'quay.io/minio/minio'],
    dumpCmd: 'mc mirror local/<bucket> /backup/<bucket>',
    restoreCmd: 'mc mirror /backup/<bucket> local/<bucket>',
    consistencyNote:
      'mc mirror copies objects through the S3 API, capturing each object atomically; object stores have no cross-object transaction so mirroring is the consistent unit.',
    defaultPort: 9000,
    envKeysDetected: ['MINIO_ROOT_USER', 'MINIO_ROOT_PASSWORD', 'MINIO_ACCESS_KEY', 'MINIO_SECRET_KEY'],
    liveDataPaths: ['/data'],
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
    ],
    relatedServices: ['postgres', 'elasticsearch'],
    relatedUseCases: ['supabase'],
    lastReviewed: '2026-07',
  },

  influxdb: {
    slug: 'influxdb',
    serviceName: 'InfluxDB',
    aliases: ['influx', 'influxd'],
    dockerImages: ['influxdb:2.7', 'influxdb:2', 'influxdb:1.8', 'influxdb'],
    dumpCmd: 'influx backup /backup/influx  # (v2; v1 uses influxd backup -portable /backup)',
    restoreCmd: 'influx restore /backup/influx  # (v1 uses influxd restore -portable /backup)',
    consistencyNote:
      'The backup command snapshots the TSM shards and metadata consistently through the engine, so the on-disk shard files are never copied live.',
    defaultPort: 8086,
    envKeysDetected: ['DOCKER_INFLUXDB_INIT_USERNAME', 'DOCKER_INFLUXDB_INIT_PASSWORD', 'DOCKER_INFLUXDB_INIT_ORG', 'INFLUXDB_HTTP_AUTH_ENABLED'],
    liveDataPaths: ['/var/lib/influxdb2', '/var/lib/influxdb'],
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
    ],
    relatedServices: ['clickhouse', 'elasticsearch', 'postgres'],
    relatedUseCases: [],
    lastReviewed: '2026-07',
  },

  neo4j: {
    slug: 'neo4j',
    serviceName: 'Neo4j',
    aliases: ['neo4j', 'graph-db'],
    dockerImages: ['neo4j:5', 'neo4j:5-community', 'neo4j:5-enterprise', 'neo4j'],
    dumpCmd: 'neo4j-admin database dump neo4j --to-path=/backup',
    restoreCmd: 'neo4j-admin database load neo4j --from-path=/backup --overwrite-destination=true',
    consistencyNote:
      'neo4j-admin database dump produces a consistent offline dump of the database store; the Enterprise `backup` command adds hot online backups.',
    defaultPort: 7687,
    envKeysDetected: ['NEO4J_AUTH', 'NEO4J_dbms_default__database', 'NEO4J_PLUGINS'],
    liveDataPaths: ['/data', '/data/databases', '/data/transactions'],
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
    ],
    relatedServices: ['mongodb', 'postgres', 'elasticsearch'],
    relatedUseCases: [],
    lastReviewed: '2026-07',
  },
};

export function getServiceGuide(slug: string): ServiceGuide | undefined {
  return SERVICE_GUIDES[slug];
}

export const SERVICE_GUIDE_SLUGS: string[] = Object.keys(SERVICE_GUIDES);
