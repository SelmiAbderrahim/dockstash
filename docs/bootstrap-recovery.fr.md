# Récupération de démarrage

Ce guide couvre le scénario « le VPS de production a disparu ». Il suppose
que seules trois choses ont survécu :

1. Le **VPS de stockage** (avec vos dépôts restic intacts).
2. La **`MASTER_ENCRYPTION_KEY`** (sauvegardée hors bande).
3. Votre **enveloppe d'export de configuration** sauvegardée
   (`dockstash-export-*.json`).

Sans ces trois éléments, les dépôts sont irrécupérables — l'enveloppe d'export
est inerte sans la clé maître, et la clé maître est inutile sans les dépôts
de stockage à pointer.

## 1. Mettre en place un nouvel agent

Provisionnez un VPS de production propre. Clonez le dépôt, remplissez `.env`,
et lancez la pile :

```bash
docker compose up -d
```

Les services `api`, `web`, `mongo`, `redis` et `docker-socket-proxy` démarrent
sur un Mongo vide. Aucun projet n'est visible pour le moment.

## 2. Fournir la même `MASTER_ENCRYPTION_KEY`

Remplissez `./secrets/master_encryption_key` avec la clé identique octet-pour-
octet de l'ancien agent. Ne **générez pas** de nouvelle clé — chaque texte
chiffré dans l'enveloppe d'export est lié à cette clé.

## 3. Importer l'enveloppe d'export

Connectez-vous en tant qu'utilisateur avec la même identité que l'ancien
propriétaire, puis POST l'enveloppe sauvegardée à `/api/recovery/import` :

```bash
curl -X POST http://localhost:8080/api/recovery/import \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d @dockstash-export-2026-07-01.json
```

L'import valide la forme de l'enveloppe (`.strict()` zod), refuse tout champ
ressemblant à un secret en clair, et déchiffre chaque texte chiffré avec
votre clé maître. Une enveloppe altérée, ou dont le `keyVersion` ne peut être
déchiffré par cet agent, est rejetée avec `HTTP 400`.

## 4. Confirmer l'accessibilité du stockage

Après l'import, `restic snapshots` s'exécute sur le dépôt de chaque projet
avec le mot de passe déchiffré. Une réponse verte confirme :

- Le VPS de stockage est joignable.
- Le mot de passe se déchiffre sous la `MASTER_ENCRYPTION_KEY` actuelle.
- Le dépôt n'est pas corrompu.

## 5. Restaurer

Déclenchez un test de restauration depuis le tableau de bord ou via le
planificateur. Les snapshots sont restaurés dans un espace de travail
temporaire et comparés octet/ligne avec les métadonnées attendues.

## L'invariant des trois éléments

**Perdre la clé maître ou les codes de récupération rend l'enveloppe d'export
inerte.** L'enveloppe ne contient que du texte chiffré AES-256-GCM. Elle est
sûre à stocker hors du serveur précisément parce qu'une copie entre les
mauvaises mains est inutile sans la clé.

Stockez `MASTER_ENCRYPTION_KEY` et les codes de récupération sur des supports
distincts, dans des lieux physiques distincts, et jamais dans la même
sauvegarde que l'enveloppe.
