// English sentence banks for the deterministic prose generator
// (content/transform.ts). Five intro structures — bank length must match
// every other locale's bank so slug-seeded rotation stays aligned.
// Slots interpolate universal facts; commands/paths are never translated.

import type { TemplateBank } from '../types';

export const TEMPLATES: TemplateBank = {
  intro: [
    'To back up {{name}} in Docker, dump it from the running container with `{{cmd}}`, then hand the dump to restic for encrypted, off-site storage. Never restic {{livePath}} directly: {{consistency}} A live-file copy captured mid-write is torn and will not restore.',
    'The correct way to back up a {{name}} container is a logical dump, not a file copy. Run `{{cmd}}` inside the container and back up its output. Copying {{livePath}} while {{alias}} is writing produces an inconsistent snapshot; {{consistency}}',
    "Backing up {{name}} safely means one rule: dump, don't copy. `{{cmd}}` produces a consistent, restorable dump from the running container, which restic then encrypts off-site. {{consistency}} Anything that copies {{livePath}} live risks an unrestorable backup.",
    '{{name}} needs a consistent dump before it touches restic. Dockstash runs `{{cmd}}` inside the container, captures the output, and stores it encrypted off-site — it never copies {{livePath}} live, because {{consistencyLower}}',
    'Want a {{name}} backup that actually restores? Dump it with `{{cmd}}` from inside the container instead of copying {{livePath}}. {{consistency}} Dockstash then restics the dump for encrypted, deduplicated, off-site snapshots.',
  ],
  consistency: {
    postgres:
      'pg_dumpall reads a consistent MVCC snapshot, so every database is captured at one point in time without blocking writers.',
    mysql:
      '--single-transaction wraps the dump in one InnoDB transaction, capturing every table at a single consistent point without a write lock.',
    mariadb:
      '--single-transaction wraps the dump in one InnoDB transaction, capturing every table at a single consistent point without a write lock.',
    mongodb:
      '--oplog records operations during the dump so mongorestore --oplogReplay can rebuild a point-in-time-consistent snapshot.',
    redis:
      'a SAVE/BGSAVE forks a point-in-time RDB snapshot to disk, so you back up the finished dump.rdb (plus the AOF if enabled) rather than volatile in-memory state.',
    valkey:
      'a SAVE/BGSAVE forks a point-in-time RDB snapshot to disk, so you back up the finished dump.rdb (plus the AOF if enabled) rather than volatile in-memory state.',
    sqlite:
      'the SQLite online backup API (sqlite3 ".backup" or VACUUM INTO) reads a consistent copy that respects WAL and in-flight transactions, which a raw file copy cannot.',
    clickhouse:
      'the native BACKUP statement freezes table parts consistently, because ClickHouse merges and mutates parts in the background where a raw copy would tear.',
    elasticsearch:
      'the snapshot API captures a consistent, incremental point-in-time view of each index while Lucene segments keep merging underneath.',
    rabbitmq:
      'exporting definitions captures the full broker topology as JSON, the durable part of RabbitMQ, while the live Mnesia message store is not point-in-time consistent under load.',
    minio:
      'mc mirror copies each object atomically through the S3 API, preserving metadata that a raw /data copy can miss during in-flight multipart uploads.',
    influxdb:
      'the backup command snapshots TSM shards and metadata through the engine, so background compaction never leaves you with a torn on-disk copy.',
    neo4j:
      'neo4j-admin dump (or the Enterprise online backup) produces a consistent store snapshot, since the live graph store and transaction logs are written continuously.',
  },
};
