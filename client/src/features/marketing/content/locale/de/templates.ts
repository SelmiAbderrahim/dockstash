// Deutsche Satzbausteine für den deterministischen Prosa-Generator
// (content/transform.ts). Fünf Intro-Strukturen — die Banklänge muss mit
// allen anderen Locales übereinstimmen, damit die Slug-Rotation ausgerichtet
// bleibt. Slots interpolieren universelle Fakten; Befehle und Pfade werden
// nie übersetzt.

import type { TemplateBank } from '../types';

export const TEMPLATES: TemplateBank = {
  intro: [
    'Um {{name}} unter Docker zu sichern, erstellen Sie mit `{{cmd}}` einen Dump aus dem laufenden Container und übergeben ihn an restic für verschlüsselte Off-Site-Speicherung. Führen Sie restic niemals direkt auf {{livePath}} aus: {{consistency}} Eine mitten im Schreibvorgang erstellte Datei-Kopie ist zerrissen und lässt sich nicht wiederherstellen.',
    'Der richtige Weg, einen {{name}}-Container zu sichern, ist ein logischer Dump, keine Datei-Kopie. Führen Sie `{{cmd}}` im Container aus und sichern Sie dessen Ausgabe. Das Kopieren von {{livePath}}, während {{alias}} schreibt, erzeugt einen inkonsistenten Schnappschuss; {{consistency}}',
    '{{name}} sicher zu sichern heißt eine Regel befolgen: dumpen, nicht kopieren. `{{cmd}}` erzeugt einen konsistenten, wiederherstellbaren Dump aus dem laufenden Container, den restic anschließend verschlüsselt off-site ablegt. {{consistency}} Alles, was {{livePath}} im laufenden Betrieb kopiert, riskiert ein nicht wiederherstellbares Backup.',
    '{{name}} braucht einen konsistenten Dump, bevor restic ins Spiel kommt. Dockstash führt `{{cmd}}` im Container aus, fängt die Ausgabe ab und speichert sie verschlüsselt off-site — {{livePath}} wird nie im laufenden Betrieb kopiert, denn {{consistencyLower}}',
    'Sie wollen ein {{name}}-Backup, das sich wirklich wiederherstellen lässt? Dumpen Sie es mit `{{cmd}}` aus dem Container heraus, statt {{livePath}} zu kopieren. {{consistency}} Dockstash übergibt den Dump dann an restic für verschlüsselte, deduplizierte Off-Site-Snapshots.',
  ],
  consistency: {
    postgres:
      'pg_dumpall liest einen konsistenten MVCC-Schnappschuss: Jede Datenbank wird zu einem einzigen Zeitpunkt erfasst, ohne Schreiber zu blockieren.',
    mysql:
      '--single-transaction kapselt den Dump in einer einzigen InnoDB-Transaktion und erfasst alle Tabellen an einem konsistenten Punkt ohne Schreibsperre.',
    mariadb:
      '--single-transaction kapselt den Dump in einer einzigen InnoDB-Transaktion und erfasst alle Tabellen an einem konsistenten Punkt ohne Schreibsperre.',
    mongodb:
      '--oplog zeichnet die Operationen während des Dumps auf, sodass mongorestore --oplogReplay einen zeitpunktkonsistenten Schnappschuss rekonstruieren kann.',
    redis:
      'ein SAVE/BGSAVE forkt einen zeitpunktgenauen RDB-Schnappschuss auf die Platte — gesichert wird also die fertige dump.rdb (plus AOF, falls aktiviert), nicht der flüchtige In-Memory-Zustand.',
    valkey:
      'ein SAVE/BGSAVE forkt einen zeitpunktgenauen RDB-Schnappschuss auf die Platte — gesichert wird also die fertige dump.rdb (plus AOF, falls aktiviert), nicht der flüchtige In-Memory-Zustand.',
    sqlite:
      'die Online-Backup-API von SQLite (sqlite3 ".backup" oder VACUUM INTO) liest eine konsistente Kopie, die WAL und laufende Transaktionen respektiert — was eine rohe Datei-Kopie nicht kann.',
    clickhouse:
      'die native BACKUP-Anweisung friert Tabellen-Parts konsistent ein, denn ClickHouse merged und mutiert Parts im Hintergrund, wo eine rohe Kopie zerreißen würde.',
    elasticsearch:
      'die Snapshot-API erfasst eine konsistente, inkrementelle Momentaufnahme jedes Index, während die Lucene-Segmente darunter weiter mergen.',
    rabbitmq:
      'der Definitions-Export erfasst die vollständige Broker-Topologie als JSON — den dauerhaften Teil von RabbitMQ —, während der Mnesia-Nachrichtenspeicher unter Last nicht zeitpunktkonsistent ist.',
    minio:
      'mc mirror kopiert jedes Objekt atomar über die S3-API und bewahrt Metadaten, die eine rohe /data-Kopie bei laufenden Multipart-Uploads verpassen kann.',
    influxdb:
      'der Backup-Befehl friert TSM-Shards und Metadaten über die Engine ein — die Hintergrund-Kompaktierung hinterlässt Ihnen so nie eine zerrissene Platten-Kopie.',
    neo4j:
      'neo4j-admin dump (oder das Enterprise-Online-Backup) erzeugt einen konsistenten Store-Schnappschuss, denn Graph-Store und Transaktionslogs werden kontinuierlich geschrieben.',
  },
};
