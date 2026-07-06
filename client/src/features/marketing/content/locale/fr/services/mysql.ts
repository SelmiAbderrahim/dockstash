// Copie française du guide MySQL. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.mysql walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MYSQL_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute MySQL',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service MySQL. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que MySQL a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image mysql et ajoute une couche base de données avec la bonne commande de dump — plus le nom du conteneur résolu et les clés d'environnement trouvées (MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le dump à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez le même dump que Dockstash exécutera. Vous devez voir du SQL défiler — des instructions CREATE DATABASE, CREATE TABLE et INSERT. C'est cette sortie qui est sauvegardée, jamais le répertoire vivant /var/lib/mysql.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon réglage par défaut pour la plupart des projets MySQL. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention pour élaguer automatiquement les anciens instantanés.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute mysqldump avec --single-transaction, --routines et --triggers dans le conteneur en cours d'exécution et envoie le dump directement dans restic — vous pouvez suivre la sortie restic en direct, ligne par ligne, dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde MySQL ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
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
        body: "Chargez le dump restauré dans un conteneur MySQL de test, lancez SHOW DATABASES pour confirmer que chaque schéma est revenu, puis sondez les tables dont dépend votre application. Le comptage de lignes et les enregistrements récents sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement, pour qu'une restauration ne soit jamais votre première répétition.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Le dump échoue avec « Access denied for user 'root'@'localhost' ».",
      cause: "Le MYSQL_ROOT_PASSWORD du compose ne correspond plus au mot de passe réel du volume de données — la variable ne fixe le mot de passe qu'à la première initialisation ; la changer ensuite dans le compose n'a aucun effet sur un volume existant.",
      fix: "Utilisez le mot de passe avec lequel le volume a été initialisé, ou réinitialisez le mot de passe root dans le conteneur, puis alignez l'env du compose pour que détection et dump concordent.",
    },
    {
      symptom: 'Le dump se termine mais certaines tables sont incohérentes après restauration.',
      cause: "Ces tables sont en MyISAM. --single-transaction ne garantit un instantané cohérent que pour les tables transactionnelles InnoDB ; les tables MyISAM sont lues hors de cette garantie.",
      fix: "Vérifiez le moteur avec SHOW TABLE STATUS. Migrez les tables MyISAM vers InnoDB (ALTER TABLE ... ENGINE=InnoDB) — le correctif durable — ou acceptez un bref verrou avec --lock-tables pour ces tables.",
    },
    {
      symptom: 'La restauration dans un conteneur de test échoue avec « Unknown collation: utf8mb4_0900_ai_ci ».',
      cause: "Le dump provient de MySQL 8.x mais vous restaurez dans une image 5.7 ; les collations par défaut de 8.0 n'existent pas dans les serveurs plus anciens.",
      fix: "Restaurez dans la même version majeure que celle du dump (par exemple mysql:8). Restaurer un dump ancien dans un serveur plus récent fonctionne ; l'inverse échoue souvent.",
    },
    {
      symptom: "Une sauvegarde échoue avec un verrou restic périmé après un crash ou un redémarrage.",
      cause: "Un job précédent est mort en cours d'exécution et a laissé le dépôt verrouillé.",
      fix: "Rien à faire manuellement : l'exécution suivante détecte le verrou orphelin et lance restic unlock automatiquement avant de continuer. Si les échecs persistent, consultez le panneau de logs en direct pour l'erreur sous-jacente.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire vivant /var/lib/mysql — des tablespaces InnoDB copiés en pleine écriture sont incohérents et feront échouer la récupération.",
    "--single-transaction ne donne un instantané cohérent que pour les tables transactionnelles (InnoDB) ; les tables MyISAM ne sont pas couvertes et exigent un verrou.",
    "Ajoutez --routines et --triggers, sinon procédures stockées et triggers disparaissent silencieusement du dump.",
  ],
  faq: [
    {
      question: 'Pourquoi --single-transaction est-il important ?',
      answer:
        "Sans lui, mysqldump lit les tables une par une et une écriture entre deux tables produit un dump incohérent. --single-transaction enveloppe tout dans une seule transaction InnoDB : le dump entier reflète un instant unique, sans verrou d'écriture.",
    },
    {
      question: 'Le dump inclut-il les procédures stockées et les triggers ?',
      answer:
        "Seulement si vous passez --routines et --triggers, ce que Dockstash inclut. Un mysqldump par défaut les omet — cause fréquente d'une base « restaurée mais cassée ».",
    },
    {
      question: 'Puis-je sauvegarder MySQL en copiant /var/lib/mysql ?',
      answer:
        "Non. Le tablespace InnoDB et les journaux redo sont écrits en continu ; une copie de fichiers en pleine écriture est incohérente. Dockstash exécute mysqldump dans le conteneur à la place.",
    },
    {
      question: 'Et si j’utilise des tables MyISAM ?',
      answer:
        "--single-transaction ne rend pas MyISAM cohérent car ce moteur n'est pas transactionnel. Si vous dépendez de MyISAM, un bref verrou (--lock-tables) est nécessaire — migrer ces tables vers InnoDB est le correctif durable.",
    },
    {
      question: 'À quelle fréquence sauvegarder MySQL ?',
      answer:
        "Quotidien est le bon défaut pour la plupart des projets ; horaire si perdre une journée d'écritures est inacceptable. Sur l'offre Free, les sauvegardes sont manuelles ; Pro autorise des planifications jusqu'à l'horaire, Business n'importe quel cron. Associez la planification à un exercice de restauration hebdomadaire pour une preuve fraîche chaque semaine.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie le dump restauré ligne à ligne — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
