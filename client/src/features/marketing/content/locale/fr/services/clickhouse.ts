// Copie française du guide ClickHouse. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.clickhouse walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const CLICKHOUSE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute ClickHouse',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service ClickHouse. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que ClickHouse a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image clickhouse/clickhouse-server et ajoute une couche base de données avec la bonne commande de sauvegarde — plus le nom du conteneur résolu et les clés d'environnement trouvées (CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DB). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le serveur à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez clickhouse-client avec SHOW DATABASES dans le conteneur. Vous devez voir vos bases listées (default, system et celles créées par votre application) — ce sont elles que l'instruction native BACKUP DATABASE va snapshoter en parts de tables cohérentes.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon défaut pour la plupart des charges analytiques — les données ClickHouse arrivent généralement en masse, l'horaire apporte donc peu. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute l'instruction native BACKUP DATABASE dans le conteneur pour produire un instantané cohérent des parts de tables, puis confie le résultat à restic vers votre VPS de stockage — suivez la sortie restic en direct dans le panneau de logs. La première exécution sur une grosse table MergeTree peut être longue ; les suivantes dédupliquent contre elle.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde ClickHouse ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est un BACKUP cohérent de votre base ClickHouse — des parts de tables figées, pas une copie de fichiers déchirée — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. La sauvegarde atterrit dans le chemin cible de votre choix, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Lancez RESTORE DATABASE dans un conteneur ClickHouse de test, puis interrogez-le : SELECT count() FROM system.tables confirme le retour des tables, et un count() sur votre plus grosse table MergeTree comparé à la production est le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "BACKUP DATABASE échoue avec une erreur de disque inconnu ou manquant.",
      cause: "L'instruction native BACKUP écrit sur un disque de sauvegarde nommé, et aucun disque de sauvegarde n'est déclaré dans la configuration du serveur.",
      fix: "Ajoutez un disque backups sous <storage_configuration> (ou une entrée de disque autorisé <backups>) dans la config ClickHouse puis redémarrez, ou passez à l'outil clickhouse-backup, qui fige les parts via des hardlinks sans disque configuré.",
    },
    {
      symptom: "Une copie brute de /var/lib/clickhouse restaurée donne un serveur signalant des parts cassées ou manquantes.",
      cause: "ClickHouse fusionne et modifie les parts de tables en continu en arrière-plan ; une copie de fichiers prise pendant les fusions capture des répertoires en pleine réécriture.",
      fix: "Ne copiez jamais le répertoire de données vivant. Utilisez BACKUP DATABASE ou clickhouse-backup — les deux figent d'abord un ensemble cohérent de parts — et laissez Dockstash confier cette sortie à restic.",
    },
    {
      symptom: "La première sauvegarde est énorme et bien plus longue que prévu.",
      cause: "Avec de grosses tables MergeTree, le BACKUP initial matérialise chaque part une fois ; il n'existe pas de point de départ plus petit.",
      fix: "Laissez la première exécution se terminer — la déduplication restic et le mode incrémental de BACKUP gardent toutes les exécutions suivantes petites. Suivez la progression dans le panneau de logs et la tendance de taille du dépôt sur la carte du projet.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire vivant /var/lib/clickhouse/store — les parts sont fusionnées et modifiées en arrière-plan, une copie brute est incohérente.",
    "Le SQL BACKUP/RESTORE exige un disque de sauvegarde configuré dans la config serveur ; à défaut, utilisez l'outil clickhouse-backup qui fige les parts via des hardlinks.",
    "Les grosses tables MergeTree produisent de grosses sauvegardes ; la déduplication restic incrémentale aide, mais le BACKUP initial peut être volumineux.",
  ],
  faq: [
    {
      question: 'Quelle est la bonne façon de sauvegarder ClickHouse ?',
      answer:
        "Utilisez l'instruction native BACKUP (BACKUP DATABASE ... TO Disk(...)) ou l'outil clickhouse-backup. Les deux produisent un instantané cohérent des parts de tables. Dockstash confie ensuite le répertoire de sauvegarde résultant à restic.",
    },
    {
      question: 'Puis-je copier /var/lib/clickhouse à la place ?',
      answer:
        "Non. ClickHouse fusionne et modifie les parts en continu en arrière-plan : une copie du répertoire vivant est incohérente. L'instruction BACKUP ou clickhouse-backup figent les parts en sécurité.",
    },
    {
      question: 'Instruction BACKUP ou clickhouse-backup — lequel choisir ?',
      answer:
        "L'instruction native BACKUP est la plus simple quand un disque de sauvegarde est configuré. clickhouse-backup est pratique pour figer les parts via hardlinks et les expédier, surtout sur d'anciennes versions. Dockstash accepte l'une ou l'autre sortie.",
    },
    {
      question: 'Les sauvegardes ClickHouse sont-elles incrémentales ?',
      answer:
        "L'instruction BACKUP supporte les sauvegardes incrémentales par rapport à une base, et restic ajoute sa propre déduplication par-dessus : les instantanés répétés restent compacts.",
    },
    {
      question: 'À quelle fréquence sauvegarder ClickHouse ?',
      answer:
        "Quotidien est le défaut pratique — les données analytiques arrivent en masse, et la déduplication restic rend les instantanés quotidiens bon marché. Sur l'offre Free, les sauvegardes sont manuelles (Backup Now) ; Pro débloque les planifications jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie la sortie restaurée — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
