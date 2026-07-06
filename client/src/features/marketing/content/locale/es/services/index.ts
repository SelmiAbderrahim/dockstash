// Textos de guías de servicio en español — un archivo por motor, ensamblados aquí.
// Las claves deben coincidir exactamente con SERVICE_GUIDE_SLUGS (content/guides.ts).

import type { ServiceGuideCopy } from '../../types';
import { POSTGRES_COPY } from './postgres';
import { MYSQL_COPY } from './mysql';
import { MARIADB_COPY } from './mariadb';
import { MONGODB_COPY } from './mongodb';
import { REDIS_COPY } from './redis';
import { VALKEY_COPY } from './valkey';
import { SQLITE_COPY } from './sqlite';
import { CLICKHOUSE_COPY } from './clickhouse';
import { ELASTICSEARCH_COPY } from './elasticsearch';
import { RABBITMQ_COPY } from './rabbitmq';
import { MINIO_COPY } from './minio';
import { INFLUXDB_COPY } from './influxdb';
import { NEO4J_COPY } from './neo4j';

export const SERVICES: Record<string, ServiceGuideCopy> = {
  postgres: POSTGRES_COPY,
  mysql: MYSQL_COPY,
  mariadb: MARIADB_COPY,
  mongodb: MONGODB_COPY,
  redis: REDIS_COPY,
  valkey: VALKEY_COPY,
  sqlite: SQLITE_COPY,
  clickhouse: CLICKHOUSE_COPY,
  elasticsearch: ELASTICSEARCH_COPY,
  rabbitmq: RABBITMQ_COPY,
  minio: MINIO_COPY,
  influxdb: INFLUXDB_COPY,
  neo4j: NEO4J_COPY,
};
