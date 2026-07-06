// Copie française du guide MariaDB. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.mariadb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MARIADB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute MariaDB',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service MariaDB. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que MariaDB a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image mariadb et ajoute une couche base de données avec la bonne commande de dump — plus le nom du conteneur résolu et les clés d'environnement trouvées (MARIADB_ROOT_PASSWORD, ou l'ancienne MYSQL_ROOT_PASSWORD, plus MARIADB_DATABASE et MARIADB_USER). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le dump à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez le même dump que Dockstash exécutera — mariadb-dump avec --single-transaction. Vous devez voir du SQL défiler : CREATE DATABASE, CREATE TABLE et INSERT. C'est cette sortie qui est sauvegardée, jamais le répertoire vivant /var/lib/mysql.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon réglage par défaut pour la plupart des projets MariaDB. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention pour élaguer automatiquement les anciens instantanés.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute mariadb-dump avec --single-transaction, --routines et --triggers dans le conteneur en cours d'exécution et envoie le dump directement dans restic — vous pouvez suivre la sortie restic en direct, ligne par ligne, dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde MariaDB ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est un dump complet à instant unique de toutes les bases du serveur — schémas, données, routines et triggers — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: 'Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Le dump et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.',
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Chargez le dump restauré dans un conteneur MariaDB de test, lancez SHOW DATABASES via le client mariadb pour confirmer que chaque schéma est revenu, puis sondez les tables dont dépend votre application. Le comptage de lignes et les enregistrements récents sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement, pour qu'une restauration ne soit jamais votre première répétition.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Le dump manuel échoue avec « mariadb-dump: command not found ».',
      cause: "Les images MariaDB anciennes (10.4 et antérieures) n'embarquent que le binaire mysqldump ; mariadb-dump est arrivé plus tard, mysqldump restant un lien de compatibilité sur les images récentes.",
      fix: "Utilisez mysqldump avec les mêmes options sur les images anciennes — la sortie est identique. Dockstash détecte le binaire fourni par l'image et appelle automatiquement le bon.",
    },
    {
      symptom: "Le dump échoue avec « Access denied for user 'root'@'localhost' ».",
      cause: "La clé de mot de passe root du compose (MARIADB_ROOT_PASSWORD ou l'ancienne MYSQL_ROOT_PASSWORD) ne correspond plus au mot de passe réel du volume — la variable ne fixe le mot de passe qu'à la première initialisation.",
      fix: "Utilisez le mot de passe avec lequel le volume a été initialisé, ou réinitialisez le mot de passe root dans le conteneur, puis alignez l'env du compose.",
    },
    {
      symptom: 'La restauration du dump dans un conteneur MySQL échoue sur des erreurs de syntaxe.',
      cause: "MariaDB et MySQL ont divergé — les séquences MariaDB, certaines collations et options de stockage n'existent pas dans MySQL, donc une restauration croisée peut casser.",
      fix: "Restaurez dans une image MariaDB de la même version majeure que le dump. Ne tentez une migration MariaDB → MySQL que délibérément, après nettoyage du dump.",
    },
    {
      symptom: "Une sauvegarde échoue avec un verrou restic périmé après un crash ou un redémarrage.",
      cause: "Un job précédent est mort en cours d'exécution et a laissé le dépôt verrouillé.",
      fix: "Rien à faire manuellement : l'exécution suivante détecte le verrou orphelin et lance restic unlock automatiquement avant de continuer. Si les échecs persistent, consultez le panneau de logs en direct.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire vivant /var/lib/mysql — une copie InnoDB en pleine écriture est irrécupérable.",
    "Les images récentes fournissent mariadb-dump ; les anciennes utilisent mysqldump. Dockstash détecte le binaire fourni par l'image.",
    "MariaDB accepte MARIADB_ROOT_PASSWORD ou l'ancienne clé MYSQL_ROOT_PASSWORD : les deux sont détectées.",
  ],
  faq: [
    {
      question: 'MariaDB se sauvegarde-t-il comme MySQL ?',
      answer:
        "Presque à l'identique. Les deux utilisent --single-transaction pour un instantané InnoDB cohérent. La différence est le binaire client : les images MariaDB récentes fournissent mariadb-dump (mysqldump est un lien de compatibilité). Dockstash choisit le bon.",
    },
    {
      question: 'Quelle clé de mot de passe root Dockstash détecte-t-il ?',
      answer:
        "MARIADB_ROOT_PASSWORD comme l'ancienne MYSQL_ROOT_PASSWORD sont reconnues, puisque les images MariaDB acceptent l'une ou l'autre selon la version.",
    },
    {
      question: 'Puis-je restaurer un dump MariaDB dans MySQL, ou inversement ?',
      answer:
        "Souvent, mais pas toujours — la dérive de fonctionnalités et de syntaxe entre les deux casse des cas limites. Restaurez dans la même famille de moteur que le dump pour un résultat fiable.",
    },
    {
      question: 'Pourquoi ne pas simplement snapshoter le volume ?',
      answer:
        "Le volume /var/lib/mysql est écrit en continu. Un snapshot en pleine écriture est incohérent. Le dump logique via mariadb-dump est la voie restaurable.",
    },
    {
      question: 'À quelle fréquence sauvegarder MariaDB ?',
      answer:
        "Quotidien est le bon défaut pour la plupart des projets ; horaire si perdre une journée d'écritures est inacceptable. Sur l'offre Free, les sauvegardes sont manuelles ; Pro autorise des planifications jusqu'à l'horaire, Business n'importe quel cron. Associez la planification à un exercice de restauration hebdomadaire.",
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
