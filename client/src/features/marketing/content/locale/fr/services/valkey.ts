// Copie française du guide Valkey. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.valkey walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const VALKEY_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute Valkey',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service Valkey. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que Valkey a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image valkey/valkey et ajoute une couche base de données avec la bonne stratégie de sauvegarde-puis-capture — plus le nom du conteneur résolu et les clés d'environnement trouvées (VALKEY_PASSWORD, VALKEY_ARGS et l'ancienne REDIS_PASSWORD). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: "Optionnel : testez l'instantané à la main",
      body: "Si vous voulez une preuve avant d'automatiser, déclenchez la même sauvegarde que Dockstash : lancez valkey-cli BGSAVE dans le conteneur. Valkey répond « Background saving started », forke et écrit un dump.rdb à instant précis dans /data — la même persistance RDB héritée de Redis. C'est ce fichier terminé qui est sauvegardé, jamais l'état vivant en mémoire.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Pour un Valkey utilisé comme stockage principal (files d'attente, sessions), le quotidien est un plancher raisonnable et l'horaire est courant. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash déclenche une sauvegarde en arrière-plan, attend le dump.rdb terminé, puis le sauvegarde — avec appendonly.aof quand la persistance AOF est activée — directement dans restic. Vous pouvez suivre la sortie restic en direct dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde Valkey ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre instance vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne contient un dump.rdb complet à instant précis (plus l'AOF si activé) et les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Le RDB et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher à l'instance vivante.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Placez le dump.rdb restauré dans le répertoire de données d'un conteneur Valkey de test et démarrez-le — Valkey charge le RDB au démarrage. Lancez valkey-cli PING : vous devez recevoir PONG, puis sondez les clés dont dépend votre application avec DBSIZE et quelques GET.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite — et redémarrez le conteneur vivant pour qu'il charge le RDB restauré). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Le dump.rdb restauré ne se charge pas : erreur de fichier tronqué ou de lecture courte.',
      cause: "Le RDB a été copié pendant que Valkey le réécrivait — le même risque de mi-réécriture que Redis, puisque Valkey conserve un modèle de persistance RDB identique.",
      fix: "Déclenchez toujours SAVE ou BGSAVE et attendez la fin avant de capturer dump.rdb. Dockstash fait exactement cela : il déclenche la sauvegarde, attend la fin, puis sauvegarde le fichier terminé.",
    },
    {
      symptom: 'Un test manuel avec redis-cli fonctionne mais valkey-cli répond « not found » (ou inversement).',
      cause: "Le binaire client varie selon l'image : les images officielles valkey/valkey fournissent valkey-cli, tandis que certaines images de compatibilité créent un lien redis-cli.",
      fix: "Utilisez le binaire fourni par l'image — protocole et commandes sont identiques. Dockstash détecte automatiquement le client présent dans le conteneur, la sauvegarde fonctionne dans les deux cas.",
    },
    {
      symptom: "Vous avez placé le dump.rdb restauré dans /data mais le Valkey en marche sert toujours les anciennes données.",
      cause: "Comme Redis, Valkey ne lit le RDB qu'au démarrage — impossible de l'échanger à chaud. Et si appendonly est activé, l'AOF prime au démarrage et le RDB est ignoré.",
      fix: "Arrêtez le conteneur, placez le dump.rdb restauré (et l'AOF le cas échéant) dans le répertoire de données, puis redémarrez. Si vous n'avez restauré qu'un RDB dans une configuration AOF, mettez temporairement appendonly no pour le premier démarrage, puis réactivez.",
    },
    {
      symptom: 'La restauration réussit mais les écritures les plus récentes manquent.',
      cause: "La persistance AOF est activée et appendonly.aof contenait des écritures plus récentes que l'instantané RDB — le RDB seul est en retard.",
      fix: "Sauvegardez les deux fichiers. Dockstash capture /data/dump.rdb et appendonly.aof ensemble dans la même exécution.",
    },
  ],
  gotchas: [
    "Comme avec Redis, ne capturez jamais un dump.rdb en cours de réécriture — déclenchez SAVE/BGSAVE d'abord et sauvegardez le fichier terminé.",
    "valkey-cli est le binaire client ; sur certaines images de compatibilité, redis-cli est un lien symbolique — Dockstash détecte celui qui est présent.",
    "Activez et capturez l'AOF quand il vous faut les écritures les plus fraîches ; le RDB seul peut être en retard.",
  ],
  faq: [
    {
      question: 'En quoi sauvegarder Valkey diffère-t-il de Redis ?',
      answer:
        "En rien de significatif. Valkey est un fork de Redis et conserve le même modèle de persistance RDB et AOF. La seule différence pratique est le nom du binaire client (valkey-cli), que Dockstash détecte automatiquement.",
    },
    {
      question: 'Puis-je restaurer un RDB Redis dans Valkey ?',
      answer:
        "Oui pour les versions actuelles — le format RDB est partagé depuis le point de fork. À mesure que les projets divergent, gardez les restaurations dans le même moteur par prudence.",
    },
    {
      question: 'Dockstash détecte-t-il Valkey automatiquement ?',
      answer:
        "Oui. Les images valkey/valkey et le binaire valkey-cli sont reconnus, et les clés VALKEY_PASSWORD comme l'ancienne REDIS_PASSWORD sont détectées.",
    },
    {
      question: "Dois-je capturer l'AOF aussi ?",
      answer:
        "Si appendonly est activé et que vous ne pouvez pas perdre les dernières secondes d'écritures, oui. Dockstash sauvegarde le RDB et les fichiers AOF.",
    },
    {
      question: 'À quelle fréquence sauvegarder Valkey ?',
      answer:
        "Adaptez la planification au contenu. Pour files d'attente et sessions, l'horaire est courant ; pour des données plus lentes, le quotidien suffit. Sur l'offre Free, les sauvegardes sont manuelles (Backup Now) ; Pro autorise jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: "Comment savoir qu'une sauvegarde Valkey se restaure vraiment ?",
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie le dump capturé — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
