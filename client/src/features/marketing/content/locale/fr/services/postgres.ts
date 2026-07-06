// Copie française du guide PostgreSQL. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.postgres walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const POSTGRES_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute PostgreSQL',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service PostgreSQL. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que PostgreSQL a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image postgres et ajoute une couche base de données avec la bonne commande de dump — plus le nom du conteneur résolu et les clés d'environnement trouvées (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le dump à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez le même dump que Dockstash exécutera. Vous devez voir des instructions SQL défiler — c'est cette sortie qui est sauvegardée, jamais le répertoire de données vivant.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon réglage par défaut pour la plupart des projets PostgreSQL. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention pour élaguer automatiquement les anciens instantanés.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute pg_dumpall dans le conteneur en cours d'exécution et envoie le dump directement dans restic — vous pouvez suivre la sortie restic en direct, ligne par ligne, dans le panneau de logs pendant l'exécution.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde PostgreSQL ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est un dump complet et cohérent de toutes les bases du cluster, plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: 'Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Le dump et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.',
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Chargez le dump restauré dans un conteneur PostgreSQL de test avec psql, puis listez les bases et sondez les tables dont dépend votre application. Le comptage de lignes et les enregistrements récents sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement, pour qu'une restauration ne soit jamais votre première répétition.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Le dump échoue avec « role does not exist » ou des erreurs d'authentification.",
      cause: "La valeur POSTGRES_USER du compose ne correspond plus à un rôle réel dans la base — fréquent après un renommage manuel de rôle ou un volume restauré d'un autre projet.",
      fix: "Lancez psql dans le conteneur et vérifiez les rôles réels avec \\du, puis alignez l'env du compose (ou les identifiants de dump du plan) sur un rôle superutilisateur existant.",
    },
    {
      symptom: 'Le SQL restauré échoue avec « extension ... is not available ».',
      cause: "Le dump référence CREATE EXTENSION (PostGIS, pgvector, …) mais l'image cible de restauration n'embarque pas ces binaires d'extension.",
      fix: "Restaurez dans la même image que celle de votre service de production (par exemple postgis/postgis ou une build pgvector), pas dans une image postgres vanilla.",
    },
    {
      symptom: 'Les sauvegardes deviennent soudain beaucoup plus longues ou le dépôt grossit vite.',
      cause: "La sortie de pg_dumpall change en bloc quand de grosses tables bougent, ce qui réduit la déduplication restic.",
      fix: "Gardez la planification quotidienne et laissez prune + rétention élaguer l'historique ; pour les très gros clusters, vérifiez que la rétention (keep daily/weekly/monthly) élague réellement en surveillant la tendance de taille du dépôt sur la carte du projet.",
    },
    {
      symptom: "Une sauvegarde échoue avec un verrou restic périmé après un crash ou un redémarrage.",
      cause: "Un job précédent est mort en cours d'exécution et a laissé le dépôt verrouillé.",
      fix: "Rien à faire manuellement : l'exécution suivante détecte le verrou orphelin et lance restic unlock automatiquement avant de continuer. Si les échecs persistent, consultez le panneau de logs en direct pour l'erreur sous-jacente.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire vivant /var/lib/postgresql/data — une page de heap copiée en pleine écriture est déchirée et irrécupérable.",
    "pg_dumpall capture les rôles et toutes les bases ; un simple pg_dump manque les objets globaux comme les rôles et les tablespaces.",
    "Les extensions (PostGIS, pgvector) doivent être installées dans l'image cible avant la restauration, sinon le SQL échouera.",
  ],
  faq: [
    {
      question: 'Pourquoi pg_dumpall plutôt que copier le répertoire de données ?',
      answer:
        "Un répertoire de données Postgres vivant est écrit en permanence. Le copier capture un état déchiré et incohérent qui ne démarrera pas. pg_dumpall lit un instantané MVCC cohérent depuis le serveur en marche et produit un dump qui se restaure proprement.",
    },
    {
      question: 'Dockstash verrouille-t-il la base pendant la sauvegarde ?',
      answer:
        "Non. pg_dumpall utilise des instantanés MVCC : les lectures sont cohérentes sans bloquer les écritures. Votre application continue de servir le trafic pendant le dump.",
    },
    {
      question: 'À quelle fréquence sauvegarder PostgreSQL ?',
      answer:
        "Quotidien est le bon défaut pour la plupart des projets ; horaire si perdre une journée d'écritures est inacceptable (Pro autorise l'horaire, Business n'importe quel cron). Associez la planification à un exercice de restauration hebdomadaire pour obtenir chaque semaine la preuve que la sauvegarde se restaure vraiment.",
    },
    {
      question: 'Comment restaurer une seule base plutôt que toutes ?',
      answer:
        "Une archive pg_dumpall est du SQL brut ; vous pouvez restaurer tout le cluster avec psql, ou utiliser pg_dump/pg_restore par base si vous n'en voulez qu'une. Par défaut, Dockstash restaure l'instantané cohérent complet.",
    },
    {
      question: 'Et les extensions comme PostGIS ou pgvector ?',
      answer:
        "Le dump référence CREATE EXTENSION mais n'embarque pas les binaires. Assurez-vous que l'image cible de restauration dispose des mêmes extensions avant de restaurer.",
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
