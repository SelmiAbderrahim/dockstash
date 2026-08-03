# Sauvegarde interne

L'orchestrateur sauvegarde **sa propre** Mongo — projets, plannings, secrets
chiffrés, historique de sauvegarde — vers le VPS de stockage dans un dépôt
restic dédié, distinct de chaque dépôt de projet utilisateur.

## Ce qui est capturé

- Documents `Project` (chemins, plan, mots de passe de dépôt chiffrés).
- Documents `Schedule` (cron, rétention, type).
- Secrets chiffrés (clé SSH de stockage, mots de passe des
  dépôts restic) — sous forme de texte chiffré, jamais en clair.
- Lignes d'historique de sauvegarde / vérification / test.

L'orchestrateur diffuse `mongodump --archive --oplog` directement dans
`restic backup --stdin` — aucun fichier temporaire n'est écrit. `--oplog`
garantit la cohérence à un instant donné sur toutes les collections.

## Le dépôt réservé

La sauvegarde interne écrit dans `SELF_BACKUP_REPO` (par défaut
`dockstash-self`) — un identifiant réservé qui n'entre jamais en conflit
avec un projet utilisateur. La file BullMQ par projet (prompt 05) sérialise
les ticks cron concurrents sur ce dépôt, de sorte que restic ne voit jamais
deux opérations simultanées sur le même dépôt.

## Planning

La cadence est `SELF_BACKUP_CRON` (par défaut la nuit à `0 3 * * *`),
enregistrée à côté des autres tâches cron. La ré-enregistration au démarrage
est idempotente — l'entrée cron est remplacée en place, jamais empilée.

## Sémantique d'échec

Chaque exécution persiste une ligne `SelfBackupRun` : `running` → `success`
à l'écriture, ou `running` → `failed` si une couche échoue. Il n'y a pas de
`success` partiel. Si `mongodump` échoue, `restic backup` n'est jamais
invoqué. Si `restic backup` échoue, le flux d'archive est détruit. L'échec
est stocké sur la ligne avec le message d'erreur.
