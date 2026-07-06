// Copie française du guide RabbitMQ. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.rabbitmq walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const RABBITMQ_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute RabbitMQ',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service RabbitMQ. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que RabbitMQ a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image rabbitmq et ajoute une couche qui exporte les définitions du broker — plus le nom du conteneur résolu et les clés d'environnement trouvées (RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_VHOST). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: "Optionnel : testez l'export à la main",
      body: "Si vous voulez une preuve avant d'automatiser, lancez rabbitmqctl export_definitions dans le conteneur. Il écrit un fichier JSON décrivant toute la topologie du broker — vhosts, exchanges, queues, bindings, utilisateurs et policies. Ouvrez-le : vous reconnaîtrez chaque queue déclarée par votre application ; c'est ce JSON qui est sauvegardé.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Le quotidien suffit largement pour la plupart des brokers — la topologie change au déploiement, pas chaque minute. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute rabbitmqctl export_definitions dans le conteneur en marche et confie le JSON à restic avec les fichiers du projet — suivez la sortie restic en direct dans le panneau de logs. Les définitions s'exportent proprement pendant que le broker sert le trafic ; rien n'est arrêté ni verrouillé.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde RabbitMQ ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre broker vivant par défaut — vous restaurez d'abord vers un emplacement neuf, vérifiez la topologie, puis promouvez délibérément. Gardez en tête ce que vous restaurez : le JSON de définitions reconstruit la topologie, pas les messages qui attendaient dans les queues.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne contient le JSON de définitions exporté — la topologie complète du broker à cet instant — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Le JSON de définitions et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au broker vivant. Montez un conteneur RabbitMQ neuf et lancez rabbitmqctl import_definitions dessus.",
      },
      'verify-data': {
        title: 'Vérifiez la topologie restaurée',
        body: "Lancez rabbitmqctl list_queues sur le broker de test : il affiche chaque nom de queue avec son nombre de messages. Chaque queue déclarée par votre application doit apparaître (les compteurs seront à zéro — les messages ne font pas partie de la sauvegarde). Vérifiez exchanges, bindings, utilisateurs et policies de la même façon ou via l'interface de management.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand la topologie est validée, pointez vos producteurs et consommateurs sur le broker restauré (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'La restauration « a fonctionné » mais toutes les queues sont vides.',
      cause: "Définitions et messages sont deux choses différentes. export_definitions capture la topologie — vhosts, exchanges, queues, bindings, utilisateurs, policies — jamais les corps de messages en file au moment de la sauvegarde.",
      fix: "C'est attendu. Traitez les messages en file comme transitoires : concevez des producteurs qui republient et des consommateurs qui tolèrent le rejeu. Un message qui doit survivre à la perte d'un broker se persiste en base, pas dans une queue.",
    },
    {
      symptom: "Un broker démarré depuis une copie du répertoire /var/lib/rabbitmq/mnesia plante ou refuse de démarrer.",
      cause: "Mnesia est écrit en continu pendant que le broker tourne : une copie à chaud est incohérente en interne — et le store est aussi lié au nom du nœud, il casse donc sur un hôte au hostname différent.",
      fix: "Ne copiez pas Mnesia comme sauvegarde. Exportez les définitions et importez-les dans un broker neuf ; c'est la voie supportée et restaurable.",
    },
    {
      symptom: "import_definitions dans un broker en marche échoue ou laisse un mélange d'ancienne et de nouvelle topologie.",
      cause: "L'import fusionne avec l'existant — arguments de queues en conflit, utilisateurs déjà présents ou policies entrent en collision avec les entrées du JSON au lieu de les remplacer.",
      fix: "Importez dans un broker neuf autant que possible. S'il faut importer dans un broker en marche, attendez-vous à une fusion, pas à une réinitialisation : supprimez d'abord les entités en conflit, puis vérifiez le résultat avec rabbitmqctl list_queues et l'interface de management.",
    },
  ],
  gotchas: [
    "Sauvegardez les définitions du broker (topologie) via export_definitions — c'est la partie durable et restaurable de RabbitMQ.",
    "Le magasin de messages Mnesia contient les messages en vol et n'est pas sûr à copier à chaud ; traitez les messages persistés comme transitoires et comptez sur producteurs/consommateurs pour récupérer.",
    "Restaurer les définitions recrée la topologie mais pas les messages présents dans les queues au moment de la sauvegarde.",
  ],
  faq: [
    {
      question: 'Quelle partie de RabbitMQ dois-je sauvegarder ?',
      answer:
        "Les définitions : vhosts, exchanges, queues, bindings, utilisateurs et policies. Les exporter en JSON capture toute la topologie du broker — ce dont vous avez réellement besoin pour reconstruire après une perte.",
    },
    {
      question: 'Puis-je sauvegarder les messages en attente dans les queues ?',
      answer:
        "Pas de façon fiable pendant que le broker tourne. Le store Mnesia n'est pas cohérent à un instant précis sous charge, et les messages sont conçus comme transitoires. Concevez des consommateurs qui tolèrent le rejeu plutôt que de compter sur une sauvegarde de messages.",
    },
    {
      question: 'Comment restaurer un broker RabbitMQ ?',
      answer:
        "Montez un broker neuf et lancez rabbitmqctl import_definitions avec votre JSON exporté. Toute la topologie — exchanges, queues, bindings, utilisateurs, policies — est recréée.",
    },
    {
      question: 'Copier /var/lib/rabbitmq/mnesia est-il une sauvegarde valable ?',
      answer:
        "Non. Mnesia est écrit en continu et une copie à chaud est incohérente. Exportez les définitions à la place ; c'est la voie de sauvegarde supportée et restaurable.",
    },
    {
      question: 'À quelle fréquence sauvegarder RabbitMQ ?',
      answer:
        "Le quotidien suffit largement pour la plupart des brokers — les définitions ne changent qu'au déploiement de nouvelles queues, utilisateurs ou policies. Sur l'offre Free, sauvegardes manuelles (Backup Now) ; Pro débloque jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et parse le JSON de définitions restauré — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
