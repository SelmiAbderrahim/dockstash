// Copie française du guide Neo4j. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.neo4j walkthrough/restoreVerify.
// Note : les étapes 'test-dump' et 'verify-data' de neo4j n'ont pas de
// commande — le dump en édition Community exige la base arrêtée, les corps
// expliquent donc le schéma sûr plutôt qu'une commande à chaud.

import type { ServiceGuideCopy } from '../../types';

export const NEO4J_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute Neo4j',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service Neo4j. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que Neo4j a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image neo4j et enregistre le conteneur résolu ainsi que les clés d'environnement trouvées (NEO4J_AUTH, NEO4J_PLUGINS). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Comprenez comment fonctionne le dump Neo4j',
      body: "Neo4j est le seul moteur où l'édition compte. Enterprise permet des sauvegardes en ligne à chaud avec neo4j-admin database backup pendant que la base continue de servir. Community exige la base arrêtée pour neo4j-admin database dump — le schéma sûr est donc un bref arrêt planifié à une heure creuse, ou le dump d'une instance secondaire. Dockstash capture l'artefact de dump résultant, jamais le répertoire /data vivant.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Pour Neo4j en édition Community, planifiez la sauvegarde à votre heure la plus calme pour rendre indolore la brève fenêtre de dump. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash capture le dump du graphe et les fichiers du projet et envoie le tout dans restic — vous pouvez suivre la sortie restic en direct, ligne par ligne, dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde Neo4j ne devient réelle qu'une fois rechargée dans un graphe interrogeable. Les restaurations Dockstash n'écrasent jamais votre base vivante par défaut — vous restaurez d'abord vers un emplacement neuf, chargez dans une instance de test, puis promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne contient un artefact de dump neo4j-admin cohérent plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. L'artefact de dump et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Chargez et vérifiez le graphe restauré',
        body: "Démarrez un conteneur Neo4j de test (même image et mêmes plugins que la production), chargez le dump avec neo4j-admin database load sur la cible arrêtée, démarrez, puis sondez avec quelques requêtes Cypher — les comptages de nœuds et de relations sur vos labels principaux sont le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand le graphe restauré est validé, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "L'étape de dump échoue avec « database is in use » en édition Community.",
      cause: "neo4j-admin database dump exige la base arrêtée sur Community ; le dump à chaud n'est pas supporté.",
      fix: "Planifiez la sauvegarde à une heure creuse avec un bref arrêt, dumpez une instance secondaire, ou passez à Enterprise pour des sauvegardes en ligne à chaud avec neo4j-admin database backup.",
    },
    {
      symptom: "La base restaurée démarre mais les requêtes utilisant APOC ou GDS échouent.",
      cause: "Les plugins font partie de l'image et de la config, pas du dump — l'image cible de restauration ne les embarque pas.",
      fix: "Restaurez dans une image avec les mêmes NEO4J_PLUGINS (APOC, GDS) installés avant de charger le dump, puis relancez les procédures en échec.",
    },
    {
      symptom: "neo4j-admin database load refuse d'écraser la cible.",
      cause: "La commande load ne remplace pas une base existante sans y être explicitement invitée, et la cible doit être arrêtée.",
      fix: "Arrêtez la base cible et passez --overwrite-destination=true (exactement ce que fait la commande de restauration documentée), puis démarrez Neo4j.",
    },
    {
      symptom: "Les sauvegardes sont bien plus volumineuses que la taille apparente du graphe.",
      cause: "Le dump inclut le store complet ; l'agitation des journaux de transactions entre deux dumps réduit aussi la déduplication restic.",
      fix: "Gardez les dumps sur une planification quotidienne et comptez sur prune + rétention pour élaguer l'historique ; surveillez la tendance de taille du dépôt sur la carte du projet pour confirmer que la rétention agit.",
    },
  ],
  gotchas: [
    "En édition Community, `neo4j-admin database dump` exige la base arrêtée — dumper un store vivant n'est pas supporté et copier /data à chaud est incohérent.",
    "L'édition Enterprise permet des sauvegardes en ligne à chaud via `neo4j-admin database backup` ; Community doit planifier un bref arrêt ou dumper une secondaire.",
    "Le port Bolt (7687) sert aux clients ; les sauvegardes passent par neo4j-admin dans le conteneur, pas par Bolt.",
  ],
  faq: [
    {
      question: 'Puis-je sauvegarder Neo4j sans l’arrêter ?',
      answer:
        "Sur Enterprise, oui — utilisez `neo4j-admin database backup` pour une sauvegarde en ligne à chaud. Sur Community, la commande `database dump` exige la base arrêtée : Dockstash planifie un bref arrêt ou dumpe une réplique.",
    },
    {
      question: 'Pourquoi ne pas copier le répertoire /data/databases ?',
      answer:
        "Le store du graphe et les journaux de transactions sont écrits en continu. Une copie à chaud est incohérente et peut ne pas se charger. neo4j-admin dump/backup produisent un artefact cohérent et restaurable.",
    },
    {
      question: 'Comment restaurer un dump Neo4j ?',
      answer:
        "Utilisez `neo4j-admin database load ... --overwrite-destination=true` sur une cible arrêtée, puis démarrez Neo4j. Dockstash charge d'abord dans une base de staging avant tout écrasement.",
    },
    {
      question: 'La sauvegarde inclut-elle les plugins installés ?',
      answer:
        "Non — les plugins (APOC, GDS) font partie de l'image/config, pas du dump de la base. Vérifiez que l'image cible de restauration a les mêmes plugins avant de charger.",
    },
    {
      question: 'À quelle fréquence sauvegarder Neo4j ?',
      answer:
        "Quotidien est le défaut pratique — choisissez votre heure la plus calme si vous êtes en Community et avez besoin de la brève fenêtre d'arrêt. Free = sauvegardes manuelles uniquement ; Pro autorise jusqu'à l'horaire, Business n'importe quelle expression cron.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. L'artefact de dump est chiffré avant de quitter votre serveur, et le mot de passe du dépôt ne quitte jamais vos mains.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé, compare chaque fichier par empreinte d'octets avec la source et vérifie le dump capturé — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire vous garantit une preuve toujours fraîche.",
    },
  ],
};
