// Bancos de frases en español para el generador determinista de prosa
// (content/transform.ts). Cinco estructuras de introducción — la longitud
// del banco debe coincidir con la de las demás locales para que la rotación
// por slug quede alineada. Los slots interpolan hechos universales;
// comandos y rutas nunca se traducen.

import type { TemplateBank } from '../types';

export const TEMPLATES: TemplateBank = {
  intro: [
    'Para respaldar {{name}} en Docker, genera un volcado desde el contenedor en ejecución con `{{cmd}}` y entrégaselo a restic para un almacenamiento cifrado fuera del servidor. Nunca ejecutes restic directamente sobre {{livePath}}: {{consistency}} Una copia de archivos vivos capturada en plena escritura queda rota y no se restaurará.',
    'La forma correcta de respaldar un contenedor {{name}} es un volcado lógico, no una copia de archivos. Ejecuta `{{cmd}}` dentro del contenedor y respalda su salida. Copiar {{livePath}} mientras {{alias}} escribe produce una instantánea inconsistente; {{consistency}}',
    'Respaldar {{name}} con seguridad se resume en una regla: volcar, no copiar. `{{cmd}}` produce un volcado consistente y restaurable desde el contenedor en ejecución, que restic cifra después fuera del servidor. {{consistency}} Todo lo que copie {{livePath}} en caliente arriesga un respaldo irrecuperable.',
    '{{name}} necesita un volcado consistente antes de tocar restic. Dockstash ejecuta `{{cmd}}` dentro del contenedor, captura la salida y la guarda cifrada fuera del servidor — nunca copia {{livePath}} en caliente, porque {{consistencyLower}}',
    '¿Quieres un respaldo de {{name}} que de verdad se restaure? Vuélcalo con `{{cmd}}` desde dentro del contenedor en lugar de copiar {{livePath}}. {{consistency}} Dockstash entrega luego el volcado a restic para instantáneas cifradas, deduplicadas y fuera del servidor.',
  ],
  consistency: {
    postgres:
      'pg_dumpall lee una instantánea MVCC consistente: cada base de datos se captura en un único instante sin bloquear las escrituras.',
    mysql:
      '--single-transaction envuelve el volcado en una sola transacción InnoDB, capturando todas las tablas en un punto consistente único sin bloqueo de escritura.',
    mariadb:
      '--single-transaction envuelve el volcado en una sola transacción InnoDB, capturando todas las tablas en un punto consistente único sin bloqueo de escritura.',
    mongodb:
      '--oplog registra las operaciones durante el volcado para que mongorestore --oplogReplay reconstruya una instantánea consistente a un instante preciso.',
    redis:
      'un SAVE/BGSAVE bifurca una instantánea RDB a un instante preciso en disco: respaldas el dump.rdb terminado (más el AOF si está activado), no el estado volátil en memoria.',
    valkey:
      'un SAVE/BGSAVE bifurca una instantánea RDB a un instante preciso en disco: respaldas el dump.rdb terminado (más el AOF si está activado), no el estado volátil en memoria.',
    sqlite:
      'la API de respaldo en línea de SQLite (sqlite3 ".backup" o VACUUM INTO) lee una copia consistente que respeta el WAL y las transacciones en curso, algo que una copia cruda de archivo no puede hacer.',
    clickhouse:
      'la sentencia nativa BACKUP congela las partes de tablas de forma consistente, porque ClickHouse fusiona y muta partes en segundo plano donde una copia cruda quedaría rota.',
    elasticsearch:
      'la API de snapshots captura una vista consistente, incremental y datada de cada índice mientras los segmentos Lucene siguen fusionándose por debajo.',
    rabbitmq:
      'exportar las definiciones captura toda la topología del broker como JSON — la parte duradera de RabbitMQ — mientras que el almacén de mensajes Mnesia no es consistente a un instante preciso bajo carga.',
    minio:
      'mc mirror copia cada objeto de forma atómica a través de la API S3, preservando metadatos que una copia cruda de /data puede perder durante subidas multipart en curso.',
    influxdb:
      'el comando de respaldo congela los shards TSM y los metadatos a través del motor: la compactación en segundo plano nunca te deja una copia en disco rota.',
    neo4j:
      'neo4j-admin dump (o el respaldo en línea de la edición Enterprise) produce una instantánea consistente del almacén, porque el almacén del grafo y los registros de transacciones se escriben continuamente.',
  },
};
