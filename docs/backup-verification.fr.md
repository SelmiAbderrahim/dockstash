# Vérification des sauvegardes

Une sauvegarde n'est pas prouvée tant qu'elle n'a pas été restaurée. Dockstash
le prouve de deux façons :

## `restic check` — intégrité de la structure

Lance `restic check` sur le dépôt. Détecte les fichiers de packs manquants,
les entrées d'index corrompues et la dérive des références de blobs. Lorsque
vous passez `readDataSubset` (pourcentage 1–100), Dockstash ajoute
`--read-data-subset=<pct>%` pour que restic lise réellement les packs.

- `POST /api/backups/:id/check` à la demande.
- Programmé par la couche file d'attente via `runScheduledChecks`.
- Persiste `lastCheckAt`, `lastCheckStatus` (`pass` / `fail`) et un
  `lastCheckDetail` localisé.
- `pass` exige un code de sortie zéro — tout autre code est `fail`.

## Test de restauration — la vraie garantie

`restic check` prouve que le dépôt est *bien formé*. Seule une restauration
prouve qu'il *restaure*. `runRestoreDrill` :

1. Lit le dernier snapshot.
2. Le restaure dans un espace scratch isolé.
3. Parcourt chaque chemin source et diff-byte contre le miroir restauré.
4. Pour chaque couche de base de données, diff-lignes du dump restauré
   contre la source.
5. Agrège les divergences. `pass` seulement à zéro divergence.
6. Persiste `lastDrillAt`, `lastDrillStatus` et `lastDrillDetail`.
7. Nettoie le scratch dans `finally`.

## Cadence

- Vérification structurelle : peu coûteuse ; à chaque sauvegarde + quotidien.
- Test de restauration : coûteux ; au moins hebdomadaire par projet.
