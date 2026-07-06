// Copie française du guide Elasticsearch. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.elasticsearch walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const ELASTICSEARCH_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute Elasticsearch',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service Elasticsearch. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez qu’Elasticsearch a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image elasticsearch et ajoute une couche base de données construite sur l'API de snapshots — plus le nom du conteneur résolu et les clés d'environnement trouvées (ELASTIC_PASSWORD, ELASTICSEARCH_USERNAME, discovery.type). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez le cluster à la main',
      body: "Si vous voulez une preuve avant d'automatiser, interrogez l'endpoint _cluster/health avec curl dans le conteneur. Un statut green ou yellow signifie que le cluster est prêt à snapshoter (yellow est normal en mono-nœud — les shards répliques n'ont nulle part où aller). Red signifie qu'au moins un shard primaire est indisponible ; corrigez cela avant de sauvegarder.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant, c'est déjà en place ; modifiable à tout moment dans Settings → Storage. Elasticsearch lui-même a besoin en plus d'un dépôt de snapshots enregistré — un chemin filesystem (un répertoire bind-monté est le plus simple) ou un object store — dans lequel l'API de snapshots écrit et que Dockstash confie à restic hors site.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Le quotidien est le bon défaut pour la plupart des clusters de recherche — les snapshots sont incrémentaux dans le dépôt, chaque exécution ne stocke donc que les nouveaux segments. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash déclenche un snapshot via l'API (PUT _snapshot/<repo>/<snap>) : Elasticsearch écrit une vue cohérente et datée de chaque index dans le dépôt, puis Dockstash confie ce répertoire à restic vers votre VPS de stockage — suivez la sortie restic en direct dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde Elasticsearch ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais votre cluster vivant par défaut — vous restaurez d'abord vers un emplacement neuf, vous vérifiez les index, puis vous promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne contient le dépôt de snapshots avec une vue cohérente et datée de chaque index, plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Le dépôt atterrit dans le chemin cible de votre choix, sans toucher au cluster vivant. Enregistrez-le dans un conteneur Elasticsearch de test et lancez POST _snapshot/<repo>/<snap>/_restore.",
      },
      'verify-data': {
        title: 'Vérifiez les données restaurées',
        body: "Interrogez _cat/indices?v sur le nœud de test et lisez le tableau : chaque index attendu doit apparaître en santé green ou yellow, au statut open, avec un docs.count conforme à la production. Sondez quelques documents avec une requête de recherche.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les index restaurés sont validés, pointez votre application sur le cluster de test (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Les appels de snapshot échouent avec repository_missing_exception ou une erreur de vérification du dépôt.",
      cause: "Aucun dépôt de snapshots n'est enregistré, ou le chemin n'est pas listé dans path.repo / pas accessible en écriture depuis le conteneur.",
      fix: "Bind-montez un répertoire dans le conteneur, ajoutez-le à path.repo dans elasticsearch.yml, redémarrez, puis enregistrez-le avec PUT _snapshot/<repo> en dépôt fs. Les snapshots n'opèrent que contre un dépôt enregistré et vérifié.",
    },
    {
      symptom: "La restauration est rejetée : « cannot restore index ... because an open index with same name already exists ».",
      cause: "L'API de snapshots refuse de restaurer dans un index actuellement ouvert — elle ne fusionne ni n'écrase silencieusement des données vivantes.",
      fix: "Fermez ou supprimez l'index existant d'abord, ou restaurez sous un autre nom avec rename_pattern/rename_replacement. Restaurer dans un nœud de test évite complètement la collision.",
    },
    {
      symptom: "La santé du cluster est red et les snapshots reviennent partiels ou échouent.",
      cause: "Au moins un shard primaire est non assigné ; un snapshot ne peut pas capturer des shards indisponibles.",
      fix: "Diagnostiquez avec _cluster/allocation/explain et remettez les primaires en ligne (watermark disque, nœud tombé, shard corrompu) avant de sauvegarder. Un cluster mono-nœud yellow est acceptable ; red non.",
    },
  ],
  gotchas: [
    "Ne lancez jamais restic sur le répertoire de données vivant — les segments Lucene sont écrits et fusionnés en continu, une copie de fichiers est incohérente.",
    "Vous devez enregistrer un dépôt de snapshots (chemin fs partagé ou object store) avant le premier snapshot ; un chemin bind-monté partagé avec le conteneur est le dépôt fs le plus simple.",
    "Restaurer un index déjà existant exige de le fermer ou de le supprimer d'abord, sinon la restauration est rejetée.",
  ],
  faq: [
    {
      question: "Pourquoi l'API de snapshots plutôt que copier le dossier de données ?",
      answer:
        "Elasticsearch écrit et fusionne des segments Lucene en permanence : une copie du répertoire vivant est incohérente et peut ne pas s'ouvrir. L'API de snapshots capture une vue cohérente, incrémentale et datée de chaque index.",
    },
    {
      question: 'Comment enregistrer un dépôt de snapshots ?',
      answer:
        "Configurez un dépôt filesystem pointant vers un chemin lisible par Elasticsearch et Dockstash (ou un object store), puis enregistrez-le avec un appel PUT _snapshot. Dockstash confie ce répertoire de dépôt à restic.",
    },
    {
      question: 'Les snapshots Elasticsearch sont-ils incrémentaux ?',
      answer:
        "Oui. Au sein d'un dépôt, chaque snapshot ne stocke que les segments absents : les snapshots répétés sont bon marché. La déduplication restic s'y ajoute.",
    },
    {
      question: 'Cela fonctionne-t-il aussi pour OpenSearch ?',
      answer:
        "Oui — OpenSearch est un fork d'Elasticsearch et garde le même modèle d'API de snapshots. Enregistrez un dépôt et snapshotez de la même façon.",
    },
    {
      question: 'À quelle fréquence sauvegarder Elasticsearch ?',
      answer:
        "Quotidien est le défaut pratique — les snapshots étant incrémentaux dans le dépôt, les exécutions quotidiennes restent bon marché même sur de gros index. Sur l'offre Free, sauvegardes manuelles (Backup Now) ; Pro débloque jusqu'à l'horaire, Business n'importe quelle expression cron.",
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
