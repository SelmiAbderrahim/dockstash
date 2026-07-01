# Noyau de sauvegarde

Dockstash traite chaque projet sous `/var/www/<name>` comme un ensemble de
quatre couches à sauvegarder : les fichiers du projet, les bases de données,
les configurations du reverse-proxy et les métadonnées compose. Cette page
explique ce que `scanProject` détecte et comment une exécution se déroule.

## Ce que détecte `scanProject`

À partir d’un chemin de projet, `scanProject` :

1. Lit `<path>/docker-compose.yml`.
2. Parcourt chaque service. Pour chaque `image`, le registre d’adaptateurs
   (`postgres`, `mysql`, `mariadb`, `mongo`) la revendique et enregistre une
   couche de base de données avec un nom de conteneur résolu et une commande
   de dump en argv uniquement.
3. Note les chemins de configuration du reverse-proxy — `/etc/traefik` pour
   Traefik, `/etc/nginx` pour nginx.
4. Renvoie un `plan { paths, databases[], configs[] }` modifiable dans l’UI
   avant d’être sauvegardé sur le projet.

## La règle « dump puis restic »

Les fichiers de base de données en cours d’utilisation ne sont **jamais**
copiés depuis le disque. Pour chaque couche activée, Dockstash exécute
`docker exec <container> <dumpCmd>` et envoie le flux directement à
`restic backup --stdin`. Les options de cohérence sont intégrées à chaque
adaptateur : `mysqldump --single-transaction`, `mongodump --oplog`,
`pg_dumpall` sur le serveur en fonctionnement.

Chaque commande est un **tableau argv** — pas d’interpolation shell, pas de
`sh -c`. Une valeur d’environnement contenant `$(rm -rf /)` devient un jeton
littéral, jamais un sous-shell.

## La liste blanche `/var/www/*`

Chaque chemin — celui du projet, ceux ajoutés au plan, ceux envoyés via
l’API — est validé contre la liste blanche `/var/www/*`. Les chaînes vides,
les segments de traversée (`..`), les octets NUL, les raccourcis de liens
symboliques et tout chemin hors de `/var/www` sont rejetés avant d’atteindre
restic ou dockerode.

## Propriété

Les projets sont limités par utilisateur. Toutes les routes `/api/backups`
exigent un JWT, et toute ressource projet passe par un contrôle de propriété
qui renvoie `403` si l’appelant n’est pas propriétaire. Le mot de passe du
dépôt Restic est stocké chiffré en AES-256-GCM ; il n’est déchiffré qu’en
mémoire, au moment de l’exécution, et n’est jamais renvoyé au client.
