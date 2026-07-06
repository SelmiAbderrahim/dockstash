// Per-service backup guide dataset — the UNIVERSAL facts layer. Every field
// maps to the real Dockstash adapter behavior so pages are structurally
// unique by construction. The dump/restore commands are the correct,
// consistent way to back up each engine from inside a running container —
// never a live data-directory copy.
//
// Localized prose (walkthrough step titles/bodies, gotchas, troubleshooting,
// FAQ) lives in content/locale/guides.<locale>.ts, keyed by the slug and the
// step ids declared here. Commands stay in this file and are never
// translated.
//
// The `slug: 'x',` line format is load-bearing: server/src/modules/seo/
// seo.parity.test.ts extracts slugs by regex to keep the sitemap in sync.

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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <postgres-container> sh -c \'pg_dumpall -U "$POSTGRES_USER"\' | head -n 20',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <postgres-container> sh -c \'psql -U "$POSTGRES_USER" -c "\\l"\'',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <mysql-container> sh -c \'mysqldump --all-databases --single-transaction -uroot -p"$MYSQL_ROOT_PASSWORD"\' | head -n 20',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <mysql-container> sh -c \'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "SHOW DATABASES;"\'',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <mariadb-container> sh -c \'mariadb-dump --all-databases --single-transaction -uroot -p"$MARIADB_ROOT_PASSWORD"\' | head -n 20',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <mariadb-container> sh -c \'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "SHOW DATABASES;"\'',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <mongo-container> sh -c \'mongodump --archive --oplog\' | wc -c',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <mongo-container> mongosh --quiet --eval "db.adminCommand({ listDatabases: 1 })"',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <redis-container> redis-cli BGSAVE',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <redis-container> redis-cli PING',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <valkey-container> valkey-cli BGSAVE',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <valkey-container> valkey-cli PING',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <app-container> sqlite3 /data/app.db ".backup \'/tmp/app-backup.db\'"',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <app-container> sqlite3 /tmp/app-backup.db "PRAGMA integrity_check;"',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <clickhouse-container> clickhouse-client --query "SHOW DATABASES"',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <clickhouse-container> clickhouse-client --query "SELECT count() FROM system.tables"',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <es-container> curl -s http://localhost:9200/_cluster/health?pretty',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <es-container> curl -s "http://localhost:9200/_cat/indices?v"',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <rabbitmq-container> rabbitmqctl export_definitions /tmp/definitions.json',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <rabbitmq-container> rabbitmqctl list_queues',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <minio-container> mc ls local',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <minio-container> mc ls local/<bucket>',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      {
        id: 'test-dump',
        cmd: 'docker exec <influxdb-container> influx backup /tmp/influx-test',
      },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      {
        id: 'verify-data',
        cmd: 'docker exec <influxdb-container> influx bucket list',
      },
      { id: 'promote' },
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
    walkthrough: [
      { id: 'add-server' },
      { id: 'add-project' },
      { id: 'review-detection' },
      { id: 'test-dump' },
      { id: 'choose-destination' },
      { id: 'schedule' },
      { id: 'run-first-backup' },
      { id: 'confirm-snapshot' },
    ],
    restoreVerify: [
      { id: 'pick-snapshot' },
      { id: 'restore-scratch' },
      { id: 'verify-data' },
      { id: 'promote' },
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
