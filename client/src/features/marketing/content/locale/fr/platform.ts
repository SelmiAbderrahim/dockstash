// Copie française des guides plateforme (utiliser Dockstash lui-même).
// Les clés d'étapes reflètent content/platform-guides.ts. Faits issus des
// docs produit (docs/*.fr.md).

import type { PlatformGuideCopy } from '../types';

export const PLATFORM: Record<string, PlatformGuideCopy> = {
  'connect-fleet-agent': {
    intro:
      "Un agent de flotte est un petit démon que vous exécutez sur un autre VPS pour que Dockstash sauvegarde aussi les conteneurs de cette machine. L'agent appelle la maison en HTTPS — aucun port entrant n'est ouvert chez vous — et exécute le même pipeline dump-puis-restic que le serveur principal. La flotte multi-VPS est une fonctionnalité de l'offre Business.",
    steps: {
      'open-fleet': {
        title: "Ouvrez l'écran Fleet",
        body: "Dans le tableau de bord, allez sur Fleet. Cet écran liste chaque agent enregistré avec son statut en ligne/hors ligne, sa version et son dernier heartbeat.",
      },
      'register-agent': {
        title: "Enregistrez l'agent",
        body: "Cliquez sur Register agent et donnez-lui un nom et l'hôte où il tournera. Dans le même dialogue, renseignez le champ Project directories avec l'emplacement de vos projets Compose sur ce VPS (par défaut /var/www) — l'agent ne découvrira, sauvegardera et restaurera que dans ces répertoires.",
      },
      'copy-token': {
        title: 'Copiez le token à usage unique',
        body: "L'enregistrement émet un token de la forme dsa_<agentId>.<secret> et l'affiche exactement une fois — il n'est stocké côté serveur que sous forme de HMAC à clé et ne peut jamais être récupéré. Copiez-le maintenant. En cas de perte, utilisez Rotate key sur la ligne de l'agent ; l'ancien token cesse de fonctionner dès qu'un nouveau est émis.",
      },
      'install-agent': {
        title: "Installez l'agent sur le VPS",
        body: "Le dialogue d'enregistrement affiche un bloc docker-compose à copier-coller, pré-rempli avec votre token et vos répertoires de projets. Collez-le sur le VPS cible et démarrez. Le docker-socket-proxy inclus accorde à l'agent un accès Docker à moindre privilège (containers + exec uniquement) — il ne touche jamais la socket brute.",
      },
      'set-project-roots': {
        title: 'Vérifiez le montage des répertoires de projets',
        body: "Chaque répertoire listé doit aussi être bind-monté en lecture-écriture dans le fichier compose (même chemin dedans et dehors) — les restaurations réécrivent des fichiers. Pour ajouter un répertoire plus tard, ouvrez le dialogue Setup de l'agent, ajoutez-le et relancez la commande compose affichée.",
      },
      'verify-online': {
        title: "Vérifiez que l'agent est en ligne",
        body: "Sous environ 30 secondes, le premier heartbeat arrive et la ligne Fleet passe en ligne. Si elle reste hors ligne, vérifiez que les deux conteneurs tournent et que votre URL Dockstash est joignable depuis le VPS.",
      },
      'assign-project': {
        title: "Assignez un projet à l'agent",
        body: "Ouvrez l'onglet Plan d'un projet et réglez « Runs on » sur le nouvel agent (le défaut est « This server (local) »). Dès lors, les sauvegardes planifiées et à la demande de ce projet sont réclamées et exécutées par l'agent, avec les logs en direct renvoyés vers votre tableau de bord.",
      },
    },
    faq: [
      {
        question: 'Le serveur Dockstash se connecte-t-il à mon VPS ?',
        answer:
          "Non. La connectivité est sortante uniquement : l'agent interroge et envoie ses heartbeats en HTTPS avec un token Bearer. Vous n'ouvrez jamais de port entrant, et le serveur n'appelle jamais votre machine.",
      },
      {
        question: "Que peut voir l'agent sur mon serveur ?",
        answer:
          "Seulement ce que vous autorisez. L'accès au système de fichiers est limité aux répertoires de projets configurés (et ils doivent être explicitement bind-montés), et l'accès Docker passe par un proxy de socket qui n'expose que le listing de conteneurs et exec — pas de build d'image, pas de montage de volume, pas de root hôte.",
      },
      {
        question: "Que se passe-t-il si l'agent meurt en pleine sauvegarde ?",
        answer:
          "Chaque job a un bail (15 minutes par défaut, renouvelé tant que les logs streament). Si le bail expire, le job est marqué en échec et une alerte part — il n'est jamais réessayé en silence, vous savez donc toujours qu'une exécution n'a pas abouti.",
      },
      {
        question: 'Les exercices de restauration tournent-ils sur les agents de flotte ?',
        answer:
          "Pas encore — les drills s'exécutent toujours sur le serveur principal. Sauvegarde, vérification (restic check), prune et restauration tournent tous à distance sur l'agent.",
      },
      {
        question: "J'ai fait tourner la clé et l'agent reçoit des 401. Que faire ?",
        answer:
          "Le conteneur en marche garde l'ancien token. Mettez à jour DOCKSTASH_AGENT_TOKEN dans docker-compose.agent.yml et recréez le conteneur. La rotation invalide l'ancien token immédiatement, par conception.",
      },
    ],
  },

  'schedule-backups': {
    intro:
      "Dockstash planifie quatre types de jobs par projet — backup, prune, check et drill — chacun sur sa propre expression cron, exécutés via une file sérialisée qui garantit un seul job par dépôt à la fois. Réglez une sauvegarde quotidienne, un prune hebdomadaire avec votre rétention et un drill hebdomadaire : la plateforme exécute et vérifie vos sauvegardes sans vous.",
    steps: {
      'open-schedule': {
        title: "Ouvrez l'onglet Schedule du projet",
        body: "Allez sur l'écran de détail du projet et ouvrez l'onglet Schedule. La planification exige une offre payante : Free n'exécute que des sauvegardes manuelles, Pro autorise jusqu'à l'horaire, Business n'importe quelle expression cron.",
      },
      'pick-frequency': {
        title: 'Choisissez la fréquence de sauvegarde',
        body: "Choisissez quotidien, hebdomadaire ou une expression cron personnalisée — la syntaxe cron est validée pendant la saisie (0 3 * * * = tous les jours à 03:00). Le quotidien à une heure creuse est le bon défaut ; passez à l'horaire seulement si perdre une journée d'écritures est inacceptable.",
      },
      'add-prune': {
        title: 'Ajoutez une planification de prune avec rétention',
        body: "Le prune est volontairement un type de job séparé — il détient le verrou du dépôt et supprime des données, il ne tourne donc jamais dans la même exécution qu'une sauvegarde. Ajoutez un prune hebdomadaire et réglez votre politique de rétention (garder N quotidiens / hebdomadaires / mensuels) ; elle se traduit directement en restic forget --prune.",
      },
      'add-check-drill': {
        title: "Ajoutez contrôles d'intégrité et exercice de restauration",
        body: "Planifiez un check (restic check — intégrité structurelle, bon marché, quotidien) et un drill (restauration complète dans un espace de travail isolé avec diffs d'octets et de lignes — coûteux, hebdomadaire est l'optimum). Le drill est ce qui transforme « la sauvegarde existe » en « la sauvegarde se restaure ».",
      },
      'save-and-watch': {
        title: 'Enregistrez et observez la première exécution planifiée',
        body: "Enregistrez la planification et laissez-la se déclencher. Chaque job en cours streame sa sortie restic en direct dans le panneau de logs. Deux planifications qui se percutent sur le même dépôt sont sérialisées automatiquement — restic corrompt les dépôts sous accès concurrent, la file est donc le contrat de correction, pas une optimisation.",
      },
    },
    faq: [
      {
        question: "Pourquoi le prune ne peut-il pas tourner dans le job de sauvegarde ?",
        answer:
          "Le prune détient le verrou du dépôt et il est destructif. Si un job combiné échouait à mi-course, vous pourriez n'avoir ni sauvegarde fraîche ni prune terminé. Des planifications séparées font que chaque opération réussit ou échoue seule.",
      },
      {
        question: 'Que se passe-t-il quand deux planifications se déclenchent en même temps ?',
        answer:
          "Même dépôt : elles sont sérialisées — la seconde attend la première. Dépôts différents : elles tournent en parallèle. Un dépôt ne voit jamais deux opérations restic concurrentes.",
      },
      {
        question: 'Quelles fréquences cron mon offre autorise-t-elle ?',
        answer:
          "Free n'a pas de planifications (Backup Now manuel seulement). Pro autorise jusqu'à l'horaire. Business autorise n'importe quelle expression cron. Le formulaire rejette tout ce qui dépasse le plafond de votre offre.",
      },
      {
        question: 'Les exécutions planifiées réessaient-elles en cas d’échec ?',
        answer:
          "Oui, avec un backoff exponentiel plafonné. Des échecs répétés marquent la planification en échec et déclenchent un e-mail d'alerte — les échecs sont bruyants par conception.",
      },
      {
        question: "Puis-je suivre une sauvegarde planifiée pendant qu'elle tourne ?",
        answer:
          "Oui. Chaque job streame la sortie restic (stdout/stderr) ligne par ligne dans le panneau de logs du projet via un socket temps réel, exactement comme un Backup Now manuel.",
      },
    ],
  },

  'restore-a-backup': {
    intro:
      "La restauration dans Dockstash est volontairement sûre : choisissez un instantané sur l'écran Snapshots, tapez le nom du projet pour confirmer, et restaurez par défaut vers un nouvel emplacement — écraser le projet vivant est un opt-in séparé et explicite. La sortie restic streame en direct pendant la restauration.",
    steps: {
      'open-snapshots': {
        title: "Ouvrez l'écran Snapshots",
        body: "Choisissez votre projet sur l'écran Snapshots. Vous obtenez une chronologie de points de restauration — chaque sauvegarde réussie est un instantané contenant fichiers du projet, dumps de bases et configs capturés ensemble.",
      },
      'pick-restore-point': {
        title: 'Choisissez le point de restauration',
        body: "Cliquez sur Restore sur la ligne d'instantané voulue. Habituellement la plus récente ; après un mauvais déploiement ou une corruption de données, prenez le dernier instantané d'avant l'incident.",
      },
      'typed-confirm': {
        title: 'Tapez le nom du projet pour confirmer',
        body: "Un dialogue de confirmation exige de taper le nom exact du projet. Cette friction est voulue — une restauration a des conséquences, et la confirmation saisie élimine les accidents de mauvais projet.",
      },
      'choose-mode': {
        title: 'Choisissez le mode de restauration',
        body: "Gardez le défaut « Restore to new location » et saisissez un chemin cible : l'instantané s'y matérialise et le projet vivant reste intact. « Overwrite existing » remplace le projet vivant et constitue un opt-in explicite — ne l'utilisez qu'après avoir validé une fois les données restaurées.",
      },
      'watch-logs': {
        title: 'Suivez le flux de restauration',
        body: "La sortie restic streame dans le panneau de logs sous le tableau pendant la matérialisation des fichiers et dumps. À la fin, le chemin cible contient les fichiers du projet plus le dump de base de cet instantané.",
      },
      'validate-result': {
        title: 'Validez avant de basculer',
        body: "Chargez le dump restauré dans un conteneur de base de test et sondez les tables dont dépend votre application. Ensuite seulement, re-pointez votre application ou répétez la restauration en mode écrasement. Pour cette preuve en continu, planifiez un exercice de restauration.",
      },
    },
    faq: [
      {
        question: 'La restauration écrasera-t-elle mon projet en marche ?',
        answer:
          "Pas sans choisir explicitement « Overwrite existing ». Le mode par défaut restaure vers un nouvel emplacement de votre choix, en laissant le projet vivant intact.",
      },
      {
        question: 'Puis-je restaurer un seul fichier ou juste la base ?',
        answer:
          "L'instantané contient fichiers, dumps et configs ensemble. Restaurez vers un nouvel emplacement et prenez ce qu'il vous faut dans l'arborescence restaurée — la façon la plus sûre de cueillir à l'unité.",
      },
      {
        question: 'Comment restaurer sur un serveur tout neuf ?',
        answer:
          "Montez un Dockstash neuf, pointez-le sur le même VPS de stockage et importez votre enveloppe d'export de configuration avec la même clé de chiffrement maîtresse. Les dépôts se déchiffrent alors et chaque instantané est restaurable. Voir le runbook de bootstrap recovery dans la documentation.",
      },
      {
        question: 'À quelle vitesse va une restauration ?',
        answer:
          "Les restaurations restic vont environ à la vitesse de votre réseau et de votre disque ; le tableau de bord affiche la progression en direct ligne par ligne. Restaurer vers un nouvel emplacement signifie aussi que l'application reste en ligne pendant la restauration.",
      },
    ],
  },

  'restore-drills': {
    intro:
      "Une sauvegarde reste non prouvée tant qu'elle n'a pas restauré. Un exercice de restauration restaure votre dernier instantané dans un espace de travail isolé, compare chaque fichier restauré par empreinte d'octets, fait un diff de lignes des dumps de bases et appose un badge réussite/échec sur le projet — automatiquement, sur planification. C'est la différence entre croire ses sauvegardes et savoir.",
    steps: {
      'schedule-drill': {
        title: 'Planifiez un drill hebdomadaire',
        body: "Dans l'onglet Schedule du projet, ajoutez une planification de drill. L'hebdomadaire est la cadence recommandée : les drills sont la preuve coûteuse (une vraie restauration), tandis que le check structurel bon marché (restic check) peut tourner chaque jour à côté.",
      },
      'run-drill-now': {
        title: 'Ou déclenchez-en un maintenant',
        body: "L'onglet Restore drill de l'écran de détail du projet montre le dernier résultat et permet d'en lancer un immédiatement. Le drill restaure dans un espace de travail isolé — votre projet vivant et votre dépôt ne sont jamais touchés.",
      },
      'read-report': {
        title: 'Lisez le rapport du drill',
        body: "Un drill ne réussit que si le nombre de différences est zéro : chaque fichier identique à l'octet près, chaque dump cohérent ligne à ligne. Le projet affiche lastDrillAt et un badge réussite/échec — « Verified » signifie qu'une vraie restauration a réussi, pas qu'une sauvegarde existe simplement.",
      },
      'fix-failures': {
        title: 'Traitez un drill échoué comme un incident',
        body: "Un drill en échec envoie un e-mail d'alerte avec le détail des différences. Causes fréquentes : dumps déchirés d'un service ayant contourné l'adaptateur, fichiers modifiés par un déploiement concurrent pendant la sauvegarde, ou corruption du dépôt (lancez un check avec lecture de données pour confirmer). Corrigez la cause, lancez Backup Now, puis relancez le drill.",
      },
    },
    faq: [
      {
        question: 'Que compare exactement un drill ?',
        answer:
          "Chaque chemin source et config est comparé par empreinte d'octets à son miroir restauré, et le dump restauré de chaque couche base de données activée est comparé ligne à ligne (ou parsé) contre la source. Toute différence fait échouer le drill — pas de réussite partielle.",
      },
      {
        question: 'Un drill peut-il casser mon projet en production ?',
        answer:
          "Non. Les drills restaurent dans un espace de travail isolé et le nettoient ensuite, même si le drill lève une erreur. Projet vivant, conteneurs et dépôt sont des participants en lecture seule.",
      },
      {
        question: 'En quoi un drill diffère-t-il de restic check ?',
        answer:
          "restic check prouve que le dépôt est structurellement sain (pas de packs manquants, pas d'index pourri). Seul un drill prouve que le dépôt se restaure réellement en données fonctionnelles. Checks quotidiens, drills hebdomadaires.",
      },
      {
        question: 'Les drills tournent-ils sur les agents de flotte ?',
        answer:
          "Pas encore — les drills s'exécutent sur le serveur principal. Les projets distants gardent sauvegarde, check, prune et restauration sur leur agent.",
      },
    ],
  },

  'notifications-alerts': {
    intro:
      "Dockstash rend l'échec bruyant. Toute sauvegarde, restauration ou drill en échec déclenche immédiatement un e-mail d'alerte au propriétaire du projet, et un heartbeat façon dead-man's switch attrape le cas silencieux où rien n'a échoué parce que rien n'a tourné. Chaque alerte contient le projet, l'erreur, l'horodatage du dernier succès et un lien direct.",
    steps: {
      'understand-triggers': {
        title: 'Sachez ce qui déclenche une alerte',
        body: "Quatre types : une sauvegarde en échec (à n'importe quelle couche — dump, restic, espace disque), une restauration en échec, un drill en échec (différence d'octets ou de lignes), et une alerte heartbeat quand un projet n'a eu aucune sauvegarde réussie dans la fenêtre. Vous ne configurez pas de règles par échec — les échecs alertent toujours.",
      },
      'set-heartbeat': {
        title: 'Réglez la fenêtre de heartbeat',
        body: "Le seuil de heartbeat (24 heures par défaut) est la fenêtre « le silence est un échec » : si la dernière sauvegarde réussie d'un projet est plus ancienne, vous êtes alerté — y compris pour les projets qui n'ont jamais réussi. Les alertes se dédupliquent dans la fenêtre et se réinitialisent dès qu'une sauvegarde réussit.",
      },
      'add-webhook': {
        title: 'Ajoutez un webhook pour votre astreinte',
        body: "Définissez une URL de webhook d'alerte et chaque alerte POSTe aussi sa charge JSON là-bas — branchez-la sur Slack, PagerDuty ou votre propre bot. E-mail et webhook portent la même charge : vos automatisations voient exactement ce que vous voyez.",
      },
      'review-audit': {
        title: "Utilisez la piste d'audit",
        body: "Les actions destructives et facturables (lancements de sauvegarde, déclenchements de restauration, suppressions de planification, changements d'offre) s'ajoutent à un journal d'audit immuable avec acteur, action, cible, IP et horodatage — sans chemin de modification ni de suppression. Consultez-le depuis votre compte ou via l'API d'audit.",
      },
    },
    faq: [
      {
        question: 'Serai-je spammé si un projet échoue en boucle ?',
        answer:
          "Les alertes heartbeat se dédupliquent sur la durée de la fenêtre avant de ré-alerter, et une sauvegarde réussie efface la déduplication immédiatement. Les alertes d'échec partent par exécution échouée — si les exécutions échouent en boucle, c'est du signal, pas du spam.",
      },
      {
        question: "Que contient la charge d'alerte ?",
        answer:
          "Le nom du projet, le détail de l'erreur, l'horodatage du dernier succès et un lien direct vers le tableau de bord du projet. Le webhook reçoit les mêmes champs en JSON.",
      },
      {
        question: "Pourquoi ai-je reçu une alerte alors que rien n'a échoué ?",
        answer:
          "C'est le heartbeat : aucune sauvegarde réussie n'est arrivée dans la fenêtre. Une planification en pause, un agent arrêté ou un projet qui n'a jamais tourné se ressemblent tous dans le silence — le dead-man's switch existe exactement pour ces cas.",
      },
      {
        question: 'Une supervision externe peut-elle surveiller Dockstash lui-même ?',
        answer:
          "Oui — pointez votre moniteur d'uptime sur l'endpoint de santé non authentifié (200 quand la pile est saine, 503 dégradée). Des compteurs agrégés sont exposés sur un endpoint de métriques sans données personnelles.",
      },
    ],
  },

  'retention-policy': {
    intro:
      "La rétention décide de l'historique conservé : N instantanés quotidiens, N hebdomadaires et N mensuels par projet. Dockstash mappe votre politique directement sur restic forget --prune, exécuté par un job de prune planifié — les vieux instantanés sont élagués automatiquement et le dépôt reste compact sans jamais toucher aux points de restauration récents.",
    steps: {
      'open-retention': {
        title: 'Ouvrez Settings → Retention',
        body: "La rétention se configure de façon centrale dans Settings. Votre offre plafonne la fenêtre : Free conserve 7 jours, Pro 30, Business 90 — la politique saisie est bornée au plafond de votre offre.",
      },
      'choose-keep': {
        title: 'Choisissez les compteurs de conservation',
        body: "Un défaut solide : garder 7 quotidiens, 4 hebdomadaires, 6 mensuels. Vous obtenez des restaurations à la journée pendant une semaine, à la semaine pendant un mois et au mois pendant six mois — pendant que le dépôt reste petit grâce à la déduplication restic.",
      },
      'schedule-prune': {
        title: 'Planifiez le job de prune',
        body: "Ajoutez une planification de prune hebdomadaire sur chaque projet. Vos compteurs se traduisent un-pour-un en options restic forget — la commande ci-dessous est exactement ce qu'exécute une politique 7/4/6. Le prune est son propre type de job car il verrouille le dépôt et supprime des données ; il ne s'accroche jamais à une sauvegarde.",
      },
      'verify-prune': {
        title: 'Vérifiez que le prune agit',
        body: "Après le premier prune, regardez la carte du projet : le nombre d'instantanés doit se stabiliser et la taille du dépôt cesser de croître indéfiniment. La chronologie Snapshots montre exactement quels points de restauration demeurent.",
      },
    },
    faq: [
      {
        question: 'Le prune peut-il supprimer ma seule sauvegarde récente ?',
        answer:
          "Non. Les compteurs de conservation préservent toujours les instantanés les plus récents de chaque catégorie — le prune taille la vieille queue, jamais la tête fraîche. Une politique 7-quotidiens garde toujours les sept derniers instantanés quotidiens.",
      },
      {
        question: "Qu'advient-il de la rétention si je rétrograde mon offre ?",
        answer:
          "Le plafond de rétention de la nouvelle offre s'applique pour la suite, et les sauvegardes existantes ne sont jamais supprimées à la rétrogradation — les projets au-delà du quota sont mis en pause (lecture seule), pas purgés.",
      },
      {
        question: 'Pourquoi mon dépôt reste-t-il gros après le prune ?',
        answer:
          "restic forget supprime des instantanés ; la passe --prune re-packe ensuite et libère les données non référencées. L'espace baisse après la fin du prune, pas après le seul forget — regardez le résumé de repack dans le log du job de prune.",
      },
      {
        question: "Ai-je besoin du prune si j'ai peu d'instantanés ?",
        answer:
          "À terme, oui. Sans prune, chaque instantané vit pour toujours et le dépôt croît sans limite. Un prune hebdomadaire avec des compteurs raisonnables est une assurance bon marché contre un disque de stockage plein — lui-même un mode d'échec de sauvegarde.",
      },
    ],
  },

  'storage-destinations': {
    intro:
      "Dockstash stocke les sauvegardes sur une machine que vous contrôlez : un VPS de stockage joignable en SSH, hébergeant des dépôts restic chiffrés. Aucun cloud tiers ne s'interpose entre vos données et vous — la configuration tient en une identité SSH plus un mot de passe de chiffrement, et les deux restent entre vos mains.",
    steps: {
      'prepare-vps': {
        title: 'Préparez une machine de stockage',
        body: "N'importe quel VPS Linux ou serveur maison joignable en SSH convient — il lui faut de l'espace disque et un utilisateur SSH, rien d'autre à installer. Utilisez une machine différente (idéalement un autre fournisseur ou lieu) de celle qui exécute vos projets : une sauvegarde sur la même machine meurt avec elle.",
      },
      'add-ssh-key': {
        title: 'Ajoutez la connexion SSH',
        body: "Dans l'assistant de configuration (ou Settings → Storage ensuite), saisissez hôte, utilisateur, port et une clé privée SSH. La clé est en écriture seule — après enregistrement, elle n'est plus jamais affichée. Dockstash pousse les instantanés restic en SFTP avec cette identité.",
      },
      'save-encryption-password': {
        title: 'Sauvegardez le mot de passe de chiffrement — affiché une seule fois',
        body: "L'assistant génère un mot de passe de chiffrement de dépôt robuste et l'affiche exactement une fois. Copiez-le dans un gestionnaire de mots de passe avant de cliquer sur Done. Ce n'est pas récupérable : le perdre signifie que les dépôts ne peuvent être déchiffrés, par personne, jamais.",
      },
      'verify-connection': {
        title: 'Vérifiez avec une première sauvegarde',
        body: "Lancez Backup Now sur n'importe quel projet. Une exécution verte prouve que le VPS de stockage est joignable, que l'identité SSH fonctionne et que le dépôt s'est initialisé et chiffré correctement. La carte du projet montre ensuite la taille du dépôt croître sur la machine de stockage.",
      },
      'plan-recovery': {
        title: 'Préparez la récupération après perte totale',
        body: "Gardez trois choses en des lieux séparés : le VPS de stockage (vos dépôts), votre clé de chiffrement maîtresse et votre enveloppe d'export de configuration. Avec les trois, un serveur de production détruit est une reconstruction, pas une perte de données — le runbook de bootstrap recovery détaille la marche à suivre.",
      },
    },
    faq: [
      {
        question: "Puis-je utiliser n'importe quel fournisseur comme destination de stockage ?",
        answer:
          "Tout ce à quoi vous pouvez accéder en SSH : un VPS de stockage bon marché, une storage box Hetzner, un NAS sur un autre site. S'il parle SSH/SFTP et a du disque, restic peut y tenir des dépôts.",
      },
      {
        question: 'Qui peut lire mes sauvegardes sur la machine de stockage ?',
        answer:
          "Personne sans votre mot de passe de chiffrement. Les dépôts sont chiffrés en AES par restic avant de quitter votre serveur ; la machine de stockage ne voit jamais que du chiffré.",
      },
      {
        question: 'Et si je perds le mot de passe de chiffrement ?',
        answer:
          "Les dépôts sont irrécupérables — c'est le principe d'un vrai chiffrement. Rangez le mot de passe dans un gestionnaire dès que l'assistant l'affiche, et sauvegardez séparément clé maîtresse et enveloppe d'export.",
      },
      {
        question: 'Puis-je faire tourner le mot de passe de chiffrement ou la clé SSH ?',
        answer:
          "Oui. Settings → Encryption password fait tourner le mot de passe du dépôt (avec une confirmation explicite « je l'ai sauvegardé »), et Settings → Storage accepte une nouvelle clé SSH à tout moment.",
      },
    ],
  },

  'troubleshooting-backups': {
    intro:
      "Quand une sauvegarde échoue, Dockstash vous le dit fort et vous montre où : un e-mail d'alerte avec l'erreur, un badge de statut sur la carte du projet et la sortie restic complète dans le panneau de logs en direct. Ce guide parcourt les formes d'échec courantes — exécutions rouges, agents hors ligne, alarme de silence — et leurs correctifs.",
    steps: {
      'check-status': {
        title: 'Commencez par la carte du projet',
        body: "L'écran Projects affiche un badge de statut, la date de dernière sauvegarde et la taille par projet. Une exécution en échec arrive aussi par e-mail d'alerte avec l'erreur et un lien direct — partez de l'un ou de l'autre. La vue de détail du projet expose directement le détail du dernier échec.",
      },
      'read-live-logs': {
        title: "Lisez la sortie restic de l'exécution",
        body: "Ouvrez le panneau de logs de l'exécution en échec. Les dernières lignes nomment presque toujours la cause : authentification échouée (clé SSH ou identifiants de base), plus d'espace disque (machine de stockage pleine), connexion refusée (VPS de stockage injoignable), ou une erreur de commande de dump dans le conteneur.",
      },
      'stale-lock': {
        title: "Les verrous restic périmés se corrigent seuls",
        body: "Si une exécution a planté ou que le serveur a redémarré en pleine sauvegarde, le dépôt peut rester verrouillé. Aucune intervention : l'exécution suivante détecte le verrou orphelin et lance restic unlock automatiquement. Un verrou détenu par un job réellement en cours n'est jamais cassé.",
      },
      'agent-offline': {
        title: "Projets sur agent : vérifiez d'abord l'agent",
        body: "Si un projet sur agent de flotte cesse de se sauvegarder, regardez l'écran Fleet. Un agent hors ligne signifie que les heartbeats se sont arrêtés : sur le VPS, confirmez que les deux conteneurs de l'agent tournent, que l'URL Dockstash est joignable, et que le token n'a pas été tourné sans mettre à jour le conteneur. Des 401 répétés dans les logs signifient qu'un vieux conteneur quelque part utilise encore un token révoqué.",
      },
      'heartbeat-alerts': {
        title: "Comprenez les alertes « aucune sauvegarde n'a tourné »",
        body: "Une alerte heartbeat signifie qu'aucune sauvegarde réussie n'est arrivée dans la fenêtre — rien n'a échoué, rien n'a tourné. Suspects habituels : planification désactivée, offre sans planifications, projet mis en pause après une rétrogradation, ou agent assigné hors ligne. Corrigez la cause : la prochaine exécution verte efface l'alarme.",
      },
    },
    faq: [
      {
        question: "Une sauvegarde a échoué une fois puis réussi au réessai. Dois-je m'en soucier ?",
        answer:
          "Regardez la raison de l'échec. Les jobs réessaient avec un backoff exponentiel plafonné : les à-coups réseau transitoires se soignent seuls. Des réessais récurrents sur la même erreur — disque qui se remplit, SSH instable — méritent un vrai correctif avant de devenir un échec dur.",
      },
      {
        question: "Pourquoi ma deuxième planification attend-elle au lieu de tourner ?",
        answer:
          "Un job par dépôt à la fois, toujours. Les opérations restic concurrentes corrompent les dépôts : les planifications qui se percutent sur le même dépôt sont sérialisées délibérément. Les dépôts différents tournent en parallèle.",
      },
      {
        question: "Le sélecteur Add-Project de mon agent est vide. Pourquoi ?",
        answer:
          "Le sélecteur lit l'instantané que l'agent a poussé à son dernier heartbeat. Vide signifie : l'agent n'a pas encore rapporté, un répertoire de projets n'est pas réellement monté dans le conteneur de l'agent, ou le proxy de socket Docker est injoignable — la bannière du sélecteur vous dit lequel. Corrigez, puis cliquez sur Refresh now au lieu d'attendre le prochain cycle de découverte.",
      },
      {
        question: 'Comment prouver que le dépôt lui-même est sain ?',
        answer:
          "Lancez un job de check. restic check vérifie la structure du dépôt ; avec un pourcentage de lecture de données, il lit et vérifie aussi le contenu réel des packs. La réussite exige un code de sortie zéro — pas de faux vert.",
      },
      {
        question: "Où voir pourquoi un drill a échoué ?",
        answer:
          "Le résultat du drill stocke un message de détail avec le nombre de différences, affiché sur l'onglet Restore drill et dans l'e-mail d'alerte. Des différences d'octets pointent des fichiers modifiés pendant la sauvegarde ; des différences de lignes pointent la cohérence du dump — dans les deux cas, considérez la sauvegarde comme non prouvée jusqu'à une nouvelle exécution réussie.",
      },
    ],
  },
};
