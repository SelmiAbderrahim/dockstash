// Copie française du guide MongoDB. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.mongodb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MONGODB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute MongoDB',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service MongoDB. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que MongoDB a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image mongo et ajoute une couche base de données avec la bonne commande de dump — plus le nom du conteneur résolu et les clés d'environnement trouvées (MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_DATABASE). Vous pouvez activer ou désactiver fichiers, bases de données et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le dump à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez le même dump que Dockstash exécutera — mongodump écrivant une archive unique sur stdout, redirigée vers un compteur d'octets. Un total d'octets élevé et non nul prouve que l'archive s'écoule proprement. C'est cette archive qui est sauvegardée, jamais le répertoire vivant /data/db.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon réglage par défaut pour la plupart des projets MongoDB. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention pour élaguer automatiquement les anciens instantanés.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute mongodump avec --archive et --oplog dans le conteneur en cours d'exécution et envoie l'archive directement dans restic — vous pouvez suivre la sortie restic en direct, ligne par ligne, dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde MongoDB ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement de staging neuf, y rejouez l'archive, vérifiez les données, puis promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est une archive mongodump complète — toutes les bases et collections, plus les entrées d'oplog capturées pendant le dump — accompagnée des fichiers du projet de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. L'archive et les fichiers atterrissent dans le chemin cible de votre choix ; passez l'archive à mongorestore avec --oplogReplay et --drop dans un conteneur de staging, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Dans le conteneur de test, listez les bases avec mongosh et confirmez que chacune est revenue, puis sondez les collections dont dépend votre application. Le comptage de documents et les enregistrements récents sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les données restaurées sont validées, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement, pour qu'une restauration ne soit jamais votre première répétition.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Le dump échoue avec « --oplog mode only supported on replica set members » (ou similaire).',
      cause: "Votre mongod tourne en standalone. --oplog a besoin d'un oplog à lire, et seuls les membres d'un replica set en tiennent un — sur un serveur standalone il n'y a rien à capturer.",
      fix: "Convertissez en replica set mono-nœud : démarrez mongod avec --replSet rs0 et exécutez rs.initiate() une fois. Même conteneur, mêmes données, et vous gagnez la garantie point-in-time.",
    },
    {
      symptom: 'mongodump échoue avec « Authentication failed » alors que compose définit MONGO_INITDB_ROOT_USERNAME.',
      cause: "Les variables MONGO_INITDB_* ne créent l'utilisateur qu'à la première initialisation d'un volume /data/db vide. Si le volume existait déjà, ou si les identifiants ont changé ensuite, les valeurs du compose ne reflètent plus la réalité.",
      fix: "Authentifiez-vous avec les identifiants réellement présents dans la base (vérifiez avec mongosh), ou recréez l'utilisateur, puis alignez l'env du compose.",
    },
    {
      symptom: "mongorestore dans un conteneur de test échoue avec une erreur de version non supportée ou d'archive invalide.",
      cause: "L'archive provient d'un serveur ou d'un mongodump plus récent que la cible de restauration — restaurer une archive mongo:7 dans mongo:5 n'est pas supporté.",
      fix: "Restaurez dans la même version majeure que celle du dump (par exemple mongo:7) et gardez mongodump/mongorestore de la même version des Database Tools. La montée de version se fait par le serveur après restauration, pas par mongorestore.",
    },
    {
      symptom: "Une sauvegarde échoue avec un verrou restic périmé après un crash ou un redémarrage.",
      cause: "Un job précédent est mort en cours d'exécution et a laissé le dépôt verrouillé.",
      fix: "Rien à faire manuellement : l'exécution suivante détecte le verrou orphelin et lance restic unlock automatiquement avant de continuer. Si les échecs persistent, consultez le panneau de logs en direct.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur les fichiers WiredTiger vivants de /data/db — copiés en plein checkpoint, ils sont incohérents et souvent irrécupérables.",
    "--oplog exige que le serveur soit membre d'un replica set (même mono-nœud) ; sur un mongod standalone c'est un no-op sans garantie point-in-time.",
    "À la restauration, --oplogReplay doit accompagner les dumps --oplog, sinon la cohérence point-in-time est perdue.",
  ],
  faq: [
    {
      question: 'Que fait --oplog exactement ?',
      answer:
        "Il enregistre les entrées du journal d'opérations produites pendant l'exécution de mongodump et les stocke dans l'archive. À la restauration, --oplogReplay les applique pour que le dump reflète un instant cohérent unique plutôt qu'un étalement sur la durée du dump.",
    },
    {
      question: 'Faut-il un replica set pour des sauvegardes cohérentes ?',
      answer:
        "Pour la cohérence point-in-time, oui — --oplog ne fonctionne que sur un membre de replica set. Beaucoup de déploiements mono-nœud tournent en replica set à un membre précisément pour cette garantie.",
    },
    {
      question: 'Pourquoi ne pas copier /data/db directement ?',
      answer:
        "WiredTiger écrit des checkpoints en continu. Une copie de fichiers en plein checkpoint capture un état incohérent qui souvent ne démarre pas. mongodump lit un instantané logique et restaurable.",
    },
    {
      question: 'Comment restaurer dans une base propre ?',
      answer:
        "mongorestore --archive --oplogReplay --drop supprime les collections existantes avant de restaurer, pour ne pas mélanger anciennes et nouvelles données. Dockstash restaure d'abord vers une cible de staging par défaut.",
    },
    {
      question: 'À quelle fréquence sauvegarder MongoDB ?',
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
