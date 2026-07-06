import type { Snapshot } from './types';

export type SnapshotKind =
  | { kind: 'database'; engine: string }
  | { kind: 'mirror' }
  | { kind: 'files' };

const DB_TAG_RE = /^db:[^:]+:(.+)$/; // db:<service>:<engine>

/**
 * Derive a snapshot's nature from its restic tags. DB-layer backups are tagged
 * `db:<service>:<engine>` and mirror backups `mirror`; plain filesystem/config
 * backups carry no tag, so an absent db/mirror tag means files.
 */
export function snapshotKind(s: Snapshot): SnapshotKind {
  const tags = s.tags ?? [];
  // A db tag is authoritative — it wins over a mirror tag regardless of order.
  for (const tag of tags) {
    const m = DB_TAG_RE.exec(tag);
    if (m) return { kind: 'database', engine: m[1] as string };
  }
  if (tags.includes('mirror')) return { kind: 'mirror' };
  return { kind: 'files' };
}

// Proper-noun engine labels (mirror DATABASE_TYPES in backups.model.ts). Brand
// names — intentionally not internationalized.
const ENGINE_LABELS: Record<string, string> = {
  postgres: 'Postgres',
  mysql: 'MySQL',
  mariadb: 'MariaDB',
  mongo: 'MongoDB',
  redis: 'Redis',
  valkey: 'Valkey',
  sqlite: 'SQLite',
  clickhouse: 'ClickHouse',
  elasticsearch: 'Elasticsearch',
  rabbitmq: 'RabbitMQ',
  minio: 'MinIO',
  influxdb: 'InfluxDB',
  neo4j: 'Neo4j',
};

export function engineLabel(engine: string): string {
  return ENGINE_LABELS[engine] ?? engine; // unknown engine → raw tag value
}
