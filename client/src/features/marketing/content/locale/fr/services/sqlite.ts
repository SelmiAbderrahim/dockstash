// Copie française du guide SQLite. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.sqlite walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const SQLITE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui embarque SQLite',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet dont l'application stocke ses données dans un fichier SQLite — PocketBase, Vaultwarden, Uptime Kuma, Gitea et Ghost le font tous. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que SQLite a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. SQLite n'a pas de conteneur dédié — il vit dans l'image de votre application — donc Dockstash le repère via les clés d'environnement qui pointent vers le fichier de base (DATABASE_PATH, DATABASE_URL, DB_PATH) et ajoute une couche base de données qui le snapshotte avec l'API de sauvegarde en ligne. Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez la sauvegarde à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez la même commande que Dockstash : sqlite3 /data/app.db \".backup '/tmp/app-backup.db'\" dans le conteneur applicatif. Elle n'affiche rien en cas de succès et laisse une copie complète et cohérente dans /tmp/app-backup.db — contenu du WAL inclus. C'est cette copie qui est sauvegardée, jamais le fichier .db vivant.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon défaut pour la plupart des applications adossées à SQLite. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute la commande .backup dans le conteneur applicatif pour produire une copie cohérente de la base, puis envoie cette copie — avec les fichiers du projet — dans restic. Vous pouvez suivre la sortie restic en direct dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde SQLite ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les données, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne contient une copie mono-fichier cohérente de la base — produite via l'API de sauvegarde en ligne, donc sans sidecars -wal ni -shm à réconcilier — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. La copie de la base et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Lancez sqlite3 <fichier-restauré> \"PRAGMA integrity_check;\" — une base saine répond un unique « ok ». Ouvrez ensuite le fichier avec sqlite3 et sondez les tables dont dépend votre application : comptage de lignes et enregistrements récents sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, arrêtez l'application, remplacez son fichier de base par la copie restaurée et redémarrez (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "La base restaurée s'ouvre mais les lignes les plus récentes manquent.",
      cause: "La sauvegarde était une copie brute du seul fichier .db pendant que l'application tournait en mode WAL — les écritures les plus récentes étaient encore dans le sidecar -wal et n'ont jamais rejoint la copie.",
      fix: "Ne copiez jamais à cru une base WAL vivante. Utilisez sqlite3 \".backup\" ou VACUUM INTO, qui passent par l'API de sauvegarde en ligne et replient le WAL dans la copie. Dockstash utilise l'API de sauvegarde précisément pour cela.",
    },
    {
      symptom: 'La commande .backup échoue avec « database is locked ».',
      cause: "Une transaction d'écriture longue (ou un writer bloqué) détient le verrou de la base, et sqlite3 a abandonné avant sa libération.",
      fix: "Définissez un busy timeout (sqlite3 -cmd \".timeout 30000\" ou PRAGMA busy_timeout) pour que la sauvegarde attende au lieu d'échouer, et planifiez les sauvegardes à une heure creuse. Si le verrou ne se libère jamais, cherchez un processus writer bloqué dans le conteneur.",
    },
    {
      symptom: 'PRAGMA integrity_check sur un fichier copié répond « database disk image is malformed ».',
      cause: "Le fichier a été copié pendant que l'application y écrivait — une capture de page déchirée qu'aucun outil de réparation ne corrige de façon fiable.",
      fix: "Jetez la copie déchirée et restaurez depuis un instantané produit par l'API de sauvegarde. Chaque instantané Dockstash est pris avec \".backup\" : integrity_check doit répondre « ok » — c'est exactement ce que vérifie l'étape de vérification.",
    },
    {
      symptom: "Vous avez lancé PRAGMA wal_checkpoint(TRUNCATE) avant une copie brute, mais la copie reste incohérente.",
      cause: "Un checkpoint replie les pages WAL dans le fichier principal à un instant donné, mais des writers peuvent ajouter de nouvelles trames WAL dès qu'il se termine — checkpoint puis cp n'est pas un instantané atomique sous écritures concurrentes.",
      fix: "Considérez « checkpoint puis copie » comme une idée reçue, pas une technique. Le seul instantané sûr à chaud est l'API de sauvegarde en ligne (\".backup\" ou VACUUM INTO) ; la copie brute n'est sûre qu'application arrêtée.",
    },
  ],
  gotchas: [
    "Ne copiez jamais un fichier .db vivant pendant que l'application tourne en mode WAL — vous manquerez les sidecars -wal/-shm et capturerez une base déchirée, irrécupérable.",
    "Utilisez sqlite3 \".backup\" ou « VACUUM INTO », qui passent tous deux par l'API de sauvegarde en ligne et gèrent correctement le WAL.",
    "Un checkpoint (PRAGMA wal_checkpoint(TRUNCATE)) avant une copie brute ne remplace pas l'API de sauvegarde sous écritures concurrentes.",
  ],
  faq: [
    {
      question: 'Puis-je simplement copier le fichier .db ?',
      answer:
        "Pas en sécurité pendant que l'application écrit. En mode WAL, les données les plus récentes vivent dans le sidecar -wal ; un simple cp du seul .db capture un état périmé et déchiré. Utilisez sqlite3 \".backup\" ou « VACUUM INTO », qui lisent une copie cohérente via l'API de sauvegarde en ligne.",
    },
    {
      question: "Qu'est-ce que VACUUM INTO ?",
      answer:
        "VACUUM INTO 'file.db' écrit une copie fraîche, défragmentée et transactionnellement cohérente de la base dans un nouveau fichier. C'est une façon propre de snapshoter une base SQLite vivante sans arrêter l'application.",
    },
    {
      question: 'Dois-je sauvegarder les fichiers -wal et -shm ?',
      answer:
        "Avec l'API de sauvegarde, non — elle consolide le WAL dans la copie. Si vous tenez à une copie brute (déconseillée à chaud), il faut inclure -wal et -shm, et cela reste sujet aux courses.",
    },
    {
      question: 'Comment restaurer une sauvegarde SQLite ?',
      answer:
        "Arrêtez l'application, remplacez le fichier de base par la sortie de .backup, puis redémarrez. La sauvegarde étant un fichier unique cohérent, il n'y a aucun sidecar à réconcilier.",
    },
    {
      question: 'Mon application embarque SQLite (PocketBase, Vaultwarden, Uptime Kuma) — Dockstash la trouvera-t-il ?',
      answer:
        "Oui. Il n'y a pas de conteneur SQLite séparé à repérer : Dockstash lit la config compose et les clés d'environnement de l'application (DATABASE_PATH, DATABASE_URL, DB_PATH) pour localiser le fichier, puis le snapshotte via l'API de sauvegarde. Vérifiez le chemin détecté dans l'onglet Plan avant la première exécution.",
    },
    {
      question: 'À quelle fréquence sauvegarder SQLite ?',
      answer:
        "Quotidien est le bon défaut pour la plupart des applications mono-fichier ; horaire si perdre une journée d'écritures est inacceptable. Sur l'offre Free, les sauvegardes sont manuelles (Backup Now) ; Pro autorise jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos données sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie la base restaurée — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
