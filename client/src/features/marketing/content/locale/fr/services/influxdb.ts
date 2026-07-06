// Copie française du guide InfluxDB. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.influxdb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const INFLUXDB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute InfluxDB',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service InfluxDB. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez qu’InfluxDB a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image influxdb et sa version majeure, puis ajoute une couche base de données avec la bonne commande de sauvegarde — influx backup pour la v2, influxd backup -portable pour la v1 — plus le nom du conteneur résolu et les clés d'environnement trouvées (DOCKER_INFLUXDB_INIT_USERNAME, DOCKER_INFLUXDB_INIT_PASSWORD, DOCKER_INFLUXDB_INIT_ORG). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez la commande de sauvegarde à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez influx backup vers un chemin temporaire dans le conteneur. Vous le verrez écrire fichiers de shards et de métadonnées en snapshotant chaque bucket via l'API HTTP — c'est cet instantané coordonné par le moteur qui est sauvegardé, jamais le répertoire TSM vivant.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Les séries temporelles s'accumulent vite : le quotidien est le bon défaut — l'horaire si vos métriques sont critiques. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute la commande adaptée à la version dans le conteneur — influx backup via l'API HTTP en v2, influxd backup -portable en v1 — et envoie l'instantané directement dans restic. Suivez la sortie restic en direct dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde InfluxDB ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais vos séries temporelles vivantes par défaut — vous restaurez d'abord vers un emplacement neuf, vérifiez les buckets, puis promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est un instantané cohérent au niveau moteur de vos shards TSM et métadonnées — buckets, politiques de rétention et utilisateurs — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Les fichiers de sauvegarde atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Chargez la sauvegarde restaurée dans un conteneur InfluxDB de test avec influx restore (ou influxd restore -portable en v1), puis listez les buckets. Chaque bucket attendu doit apparaître avec sa politique de rétention ; lancez une requête rapide sur une plage temporelle récente pour confirmer que les derniers points sont bien là.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'La commande de sauvegarde échoue avec « unknown command » ou des options non reconnues.',
      cause: "Les lignes de commande v1 et v2 sont totalement différentes : v2 utilise influx backup via l'API HTTP, v1 utilise influxd backup -portable. Lancer la commande d'une génération contre l'autre échoue immédiatement — fréquent après une montée de version du tag d'image.",
      fix: "Vérifiez la version majeure du conteneur (influxd version) puis utilisez la commande correspondante. Dockstash détecte la version majeure depuis l'image et choisit automatiquement la bonne ; relancez la détection sur l'onglet Plan après une mise à niveau.",
    },
    {
      symptom: "influx backup échoue avec « unauthorized » ou un 401 de l'API.",
      cause: "Les sauvegardes v2 passent par l'API HTTP et exigent un token opérateur (all-access). Un simple token de lecture — ou aucun token quand l'auth est activée — ne suffit pas.",
      fix: "Fournissez un token opérateur avec accès en lecture aux buckets. Si vous avez utilisé les clés DOCKER_INFLUXDB_INIT_*, le token admin d'init fonctionne ; sinon créez-en un avec influx auth create --all-access et ajoutez-le aux identifiants du plan.",
    },
    {
      symptom: "Une sauvegarde faite en copiant /var/lib/influxdb2 ne démarre pas, ou les requêtes renvoient des données partielles.",
      cause: "InfluxDB compacte les shards TSM en arrière-plan. Une copie brute du répertoire vivant attrape des shards en pleine compaction — certains fichiers d'avant, d'autres d'après — produisant un store déchiré et incohérent.",
      fix: "Ne copiez jamais le répertoire de données vivant. Utilisez la commande de sauvegarde du moteur, qui fige shards et métadonnées de façon cohérente — c'est ce que Dockstash exécute. Une copie brute déchirée est généralement irrécupérable ; restaurez depuis une vraie sauvegarde.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire TSM/WAL vivant — les shards sont compactés en arrière-plan, une copie brute est incohérente.",
    "InfluxDB v2 utilise `influx backup` (API HTTP + token) ; la v1 utilise `influxd backup -portable`. Dockstash détecte la version majeure.",
    "Les sauvegardes v2 exigent un token opérateur avec accès en lecture ; sans lui, l'appel de sauvegarde est non autorisé.",
  ],
  faq: [
    {
      question: 'Quelle commande sauvegarde correctement InfluxDB ?',
      answer:
        "Pour la v2, `influx backup` via l'API HTTP avec un token opérateur. Pour la v1, `influxd backup -portable`. Les deux figent shards TSM et métadonnées de façon cohérente. Dockstash détecte la version et exécute la bonne.",
    },
    {
      question: 'Puis-je copier les fichiers de shards directement ?',
      answer:
        "Non. InfluxDB compacte les shards TSM en arrière-plan : une copie du répertoire vivant est incohérente. Utilisez la commande de sauvegarde, qui coordonne un instantané cohérent via le moteur.",
    },
    {
      question: 'Quel token faut-il pour la sauvegarde v2 ?',
      answer:
        "Un token opérateur (all-access) avec permission de lecture sur les buckets. Dockstash détecte les clés d'env du token d'init ; fournissez un token si l'auth est activée.",
    },
    {
      question: 'Comment restaurer une sauvegarde de séries temporelles ?',
      answer:
        "Utilisez `influx restore` (v2) ou `influxd restore -portable` (v1) contre une instance neuve. Dockstash restaure d'abord vers une instance de staging avant tout écrasement.",
    },
    {
      question: 'À quelle fréquence sauvegarder InfluxDB ?',
      answer:
        "Le quotidien convient à la plupart des charges de métriques ; passez à l'horaire si perdre une heure de points ferait mal. Sur l'offre Free, les sauvegardes sont des Backup Now manuels ; Pro ajoute les planifications jusqu'à l'horaire, Business n'importe quelle expression cron. Associez un exercice de restauration hebdomadaire.",
    },
    {
      question: "La sauvegarde bloque-t-elle les écritures d'InfluxDB ?",
      answer:
        "Non. La commande de sauvegarde fige les shards via le moteur pendant que le serveur continue d'accepter les écritures — vos collecteurs et dashboards tournent pendant la sauvegarde.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie le dump restauré — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
