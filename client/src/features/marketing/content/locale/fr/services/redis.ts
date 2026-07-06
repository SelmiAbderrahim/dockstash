// Copie française du guide Redis. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.redis walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const REDIS_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute Redis',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service Redis. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que Redis a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image redis et ajoute une couche base de données avec la bonne stratégie de sauvegarde-puis-capture — plus le nom du conteneur résolu et les clés d'environnement trouvées (REDIS_PASSWORD, REDIS_ARGS). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: "Optionnel : testez l'instantané à la main",
      body: "Si vous voulez une preuve avant d'automatiser, déclenchez la même sauvegarde que Dockstash : lancez redis-cli BGSAVE dans le conteneur. Redis répond « Background saving started », forke et écrit un dump.rdb à instant précis dans /data. C'est ce fichier RDB terminé — jamais l'état vivant en mémoire — qui est sauvegardé.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Pour un Redis utilisé comme stockage principal (files d'attente, sessions), le quotidien est un plancher raisonnable et l'horaire est courant. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
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
      "Une sauvegarde Redis ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre instance vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
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
        body: "Placez le dump.rdb restauré dans le répertoire de données d'un conteneur Redis de test et démarrez-le — Redis charge le RDB au démarrage. Lancez redis-cli PING : vous devez recevoir PONG, puis sondez les clés dont dépend votre application avec DBSIZE et quelques GET.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite — et redémarrez le conteneur vivant pour qu'il charge le RDB restauré). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Le dump.rdb restauré ne se charge pas : « Short read or OOM loading DB » ou erreur de fichier tronqué.',
      cause: "Le RDB a été copié pendant que Redis le réécrivait — une capture en pleine réécriture produit un fichier partiel.",
      fix: "Déclenchez toujours SAVE ou BGSAVE et attendez la fin avant de capturer dump.rdb. Dockstash fait exactement cela : il déclenche la sauvegarde, attend la fin, puis sauvegarde le fichier terminé.",
    },
    {
      symptom: 'La restauration réussit mais les écritures les plus récentes manquent.',
      cause: "La persistance AOF est activée et appendonly.aof contenait des écritures plus récentes que l'instantané RDB — le RDB seul est en retard.",
      fix: "Sauvegardez les deux fichiers. Dockstash capture /data/dump.rdb et appendonly.aof ensemble dans la même exécution, pour que le point de restauration inclue les écritures les plus fraîches.",
    },
    {
      symptom: "Vous avez placé le dump.rdb restauré dans /data mais le Redis en marche sert toujours les anciennes données.",
      cause: "Redis ne lit le RDB qu'au démarrage — impossible de l'échanger à chaud dans une instance en marche. Et si appendonly est activé, Redis charge l'AOF au démarrage et ignore complètement le RDB.",
      fix: "Arrêtez le conteneur, placez le dump.rdb restauré (et l'AOF si vous en avez restauré un) dans le répertoire de données, puis redémarrez. Si vous n'avez restauré qu'un RDB dans une configuration AOF, mettez temporairement appendonly no pour le premier démarrage, puis réactivez.",
    },
    {
      symptom: "BGSAVE échoue avec « Can't save in background: fork: Cannot allocate memory ».",
      cause: "Le fork nécessaire à la sauvegarde en arrière-plan a été refusé par les heuristiques d'overcommit mémoire du noyau, sur un hôte avec un gros jeu de données Redis.",
      fix: "Réglez vm.overcommit_memory=1 sur l'hôte Docker (sysctl) — le réglage que Redis lui-même recommande au démarrage. Le fork utilise la copie sur écriture : il n'a pas besoin d'une seconde copie complète du jeu de données.",
    },
  ],
  gotchas: [
    "Copier un dump.rdb en cours de réécriture donne un fichier tronqué ; déclenchez SAVE (ou BGSAVE) d'abord, puis sauvegardez le RDB terminé.",
    "Si la persistance AOF est activée, sauvegardez aussi le(s) fichier(s) appendonly.aof — le RDB seul peut être en retard sur les dernières écritures.",
    "La restauration Redis exige un serveur arrêté ou redémarré pour charger le RDB ; impossible d'échanger dump.rdb à chaud dans une instance en marche.",
  ],
  faq: [
    {
      question: 'Redis vaut-il vraiment la peine d’être sauvegardé ?',
      answer:
        "Cela dépend de l'usage. En pur cache, un Redis perdu se repeuple tout seul. En stockage principal (files d'attente, sessions, sorted sets), oui — sauvegardez le RDB, et l'AOF si activé.",
    },
    {
      question: 'SAVE ou BGSAVE — lequel Dockstash utilise-t-il ?',
      answer:
        "BGSAVE forke et snapshotte en arrière-plan sans bloquer ; SAVE bloque jusqu'à la fin. Dockstash préfère la sauvegarde en arrière-plan puis sauvegarde le dump.rdb terminé une fois écrit.",
    },
    {
      question: "Et l'AOF (append-only file) ?",
      answer:
        "Si appendonly est activé, l'AOF contient les écritures les plus récentes que le RDB ne reflète peut-être pas encore. Dockstash capture /data/dump.rdb et appendonly.aof, pour ne perdre aucune donnée récente.",
    },
    {
      question: 'Puis-je copier dump.rdb pendant que Redis tourne ?',
      answer:
        "Seulement après un SAVE/BGSAVE terminé. Copier pendant une réécriture peut saisir un fichier partiel. Dockstash déclenche la sauvegarde et attend la fin avant de capturer.",
    },
    {
      question: 'À quelle fréquence sauvegarder Redis ?',
      answer:
        "Adaptez la planification à ce que Redis contient. Pour files d'attente et sessions, l'horaire est courant ; pour des données plus lentes, le quotidien suffit. Sur l'offre Free, les sauvegardes sont manuelles (Backup Now) ; Pro autorise jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: "Comment savoir qu'une sauvegarde Redis se restaure vraiment ?",
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie le dump capturé — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
