// Banques de phrases françaises pour le générateur de prose déterministe
// (content/transform.ts). Cinq structures d'intro — la longueur de la banque
// doit rester identique à celle des autres locales pour que la rotation
// par slug reste alignée. Les slots interpolent des faits universels ;
// commandes et chemins ne sont jamais traduits.

import type { TemplateBank } from '../types';

export const TEMPLATES: TemplateBank = {
  intro: [
    "Pour sauvegarder {{name}} sous Docker, exportez un dump depuis le conteneur en cours d'exécution avec `{{cmd}}`, puis confiez ce dump à restic pour un stockage chiffré hors site. Ne lancez jamais restic directement sur {{livePath}} : {{consistency}} Une copie de fichiers vivants capturée en pleine écriture est déchirée et ne se restaurera pas.",
    "La bonne façon de sauvegarder un conteneur {{name}} est un dump logique, pas une copie de fichiers. Exécutez `{{cmd}}` dans le conteneur et sauvegardez sa sortie. Copier {{livePath}} pendant que {{alias}} écrit produit un instantané incohérent ; {{consistency}}",
    "Sauvegarder {{name}} en sécurité tient en une règle : dumper, ne pas copier. `{{cmd}}` produit un dump cohérent et restaurable depuis le conteneur en cours d'exécution, que restic chiffre ensuite hors site. {{consistency}} Tout ce qui copie {{livePath}} à chaud risque une sauvegarde irrécupérable.",
    "{{name}} exige un dump cohérent avant de toucher restic. Dockstash exécute `{{cmd}}` dans le conteneur, capture la sortie et la stocke chiffrée hors site — il ne copie jamais {{livePath}} à chaud, car {{consistencyLower}}",
    "Vous voulez une sauvegarde {{name}} qui se restaure vraiment ? Dumpez-la avec `{{cmd}}` depuis l'intérieur du conteneur au lieu de copier {{livePath}}. {{consistency}} Dockstash confie ensuite le dump à restic pour des instantanés chiffrés, dédupliqués et hors site.",
  ],
  consistency: {
    postgres:
      "pg_dumpall lit un instantané MVCC cohérent : chaque base est capturée à un instant unique sans bloquer les écritures.",
    mysql:
      "--single-transaction enveloppe le dump dans une seule transaction InnoDB, capturant toutes les tables à un point cohérent unique sans verrou d'écriture.",
    mariadb:
      "--single-transaction enveloppe le dump dans une seule transaction InnoDB, capturant toutes les tables à un point cohérent unique sans verrou d'écriture.",
    mongodb:
      "--oplog enregistre les opérations pendant le dump afin que mongorestore --oplogReplay reconstruise un instantané cohérent à un instant précis.",
    redis:
      "un SAVE/BGSAVE forke un instantané RDB à un instant précis sur le disque : vous sauvegardez donc le dump.rdb terminé (plus l'AOF si activé) plutôt que l'état volatil en mémoire.",
    valkey:
      "un SAVE/BGSAVE forke un instantané RDB à un instant précis sur le disque : vous sauvegardez donc le dump.rdb terminé (plus l'AOF si activé) plutôt que l'état volatil en mémoire.",
    sqlite:
      "l'API de sauvegarde en ligne de SQLite (sqlite3 \".backup\" ou VACUUM INTO) lit une copie cohérente qui respecte le WAL et les transactions en cours, ce qu'une copie brute de fichier ne peut pas faire.",
    clickhouse:
      "l'instruction native BACKUP fige les parts de tables de façon cohérente, car ClickHouse fusionne et modifie les parts en arrière-plan là où une copie brute serait déchirée.",
    elasticsearch:
      "l'API de snapshots capture une vue cohérente, incrémentale et datée de chaque index pendant que les segments Lucene continuent de fusionner en dessous.",
    rabbitmq:
      "l'export des définitions capture toute la topologie du broker en JSON — la partie durable de RabbitMQ — tandis que le magasin de messages Mnesia n'est pas cohérent à un instant précis sous charge.",
    minio:
      "mc mirror copie chaque objet de manière atomique via l'API S3, en préservant des métadonnées qu'une copie brute de /data peut manquer pendant des uploads multipart en cours.",
    influxdb:
      "la commande de sauvegarde fige les shards TSM et les métadonnées via le moteur : la compaction en arrière-plan ne vous laisse jamais une copie disque déchirée.",
    neo4j:
      "neo4j-admin dump (ou la sauvegarde en ligne de l'édition Enterprise) produit un instantané cohérent du store, car le store du graphe et les journaux de transactions sont écrits en continu.",
  },
};
