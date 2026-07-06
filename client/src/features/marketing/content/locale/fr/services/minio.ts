// Copie française du guide MinIO. Les clés d'étapes reflètent
// content/guides.ts → SERVICE_GUIDES.minio walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MINIO_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Créez votre compte Dockstash et ouvrez le tableau de bord',
      body: "Inscrivez-vous gratuitement sur dockstash.com/register. L'assistant de configuration unique vous demande votre VPS de stockage (la machine qui hébergera les sauvegardes chiffrées) et génère un mot de passe de chiffrement — enregistrez-le immédiatement dans un gestionnaire de mots de passe, il n'est affiché qu'une seule fois.",
    },
    'add-project': {
      title: 'Ajoutez le projet Docker qui exécute MinIO',
      body: "Sur l'écran Projects, Dockstash détecte automatiquement chaque dossier de projet Compose du serveur (par défaut sous /var/www). Choisissez le projet qui contient votre service MinIO. Rien n'est encore sauvegardé — vous indiquez simplement à Dockstash où vit le projet.",
    },
    'review-detection': {
      title: 'Vérifiez que MinIO a bien été détecté',
      body: "Ouvrez le projet et regardez l'onglet Plan. Dockstash lit docker-compose.yml, reconnaît l'image minio/minio et ajoute une couche object-store bâtie autour de mc mirror — plus le nom du conteneur résolu et les clés d'environnement trouvées (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, ou l'ancienne paire MINIO_ACCESS_KEY / MINIO_SECRET_KEY). Vous pouvez activer ou désactiver fichiers, bases et configs de proxy avant d'enregistrer.",
    },
    'test-dump': {
      title: 'Optionnel : testez la liste des buckets à la main',
      body: "Si vous voulez une preuve avant d'automatiser, lancez mc ls sur l'alias local dans le conteneur. Vous devez voir chaque bucket listé avec sa taille et son nombre d'objets — ce sont exactement ces buckets que mc mirror copiera via l'API S3, objet par objet, jamais le répertoire brut /data.",
    },
    'choose-destination': {
      title: 'Confirmez votre destination de stockage',
      body: "Les sauvegardes sont stockées sous forme d'instantanés restic chiffrés sur votre propre VPS de stockage, via SSH. Si vous avez terminé l'assistant de configuration, c'est déjà en place ; vous pouvez changer l'hôte, l'utilisateur, le port ou la clé SSH à tout moment dans Settings → Storage.",
    },
    'schedule': {
      title: 'Définissez une planification de sauvegarde',
      body: "Dans l'onglet Schedule du projet, choisissez quotidien, hebdomadaire ou une expression cron personnalisée (validée en direct). Un passage quotidien à une heure creuse est le bon défaut pour la plupart des object stores — les miroirs sont incrémentaux, les exécutions suivantes ne copient que ce qui a changé. Ajoutez une planification de prune hebdomadaire avec votre politique de rétention.",
    },
    'run-first-backup': {
      title: 'Lancez la première sauvegarde maintenant',
      body: "Cliquez sur Backup Now sur la carte du projet. Dockstash exécute mc mirror dans le conteneur pour copier chaque bucket via l'API S3 — capturant chaque objet de façon atomique avec ses métadonnées — et envoie le résultat dans restic. Vous pouvez suivre la sortie restic en direct dans le panneau de logs.",
    },
    'confirm-snapshot': {
      title: "Confirmez que l'instantané existe",
      body: "À la fin de l'exécution, la carte du projet affiche la nouvelle date de dernière sauvegarde, le nombre d'instantanés et la taille du dépôt. Ouvrez l'écran Snapshots : le point de restauration apparaît dans la chronologie — c'est votre preuve que la sauvegarde est bien arrivée hors site.",
    },
  },
  restoreVerify: {
    intro:
      "Une sauvegarde MinIO ne devient réelle qu'une fois restaurée. Les restaurations Dockstash n'écrasent jamais vos buckets vivants par défaut — vous restaurez d'abord vers un emplacement neuf, vérifiez les objets, puis promouvez délibérément.",
    steps: {
      'pick-snapshot': {
        title: 'Choisissez un point de restauration',
        body: "Ouvrez Snapshots, sélectionnez le projet et parcourez la chronologie des points de restauration. Chaque ligne est un miroir complet de vos buckets au niveau API — chaque objet avec ses métadonnées et ses tags — plus les fichiers du projet capturés lors de la même exécution.",
      },
      'restore-scratch': {
        title: 'Restaurez vers un nouvel emplacement',
        body: "Cliquez sur Restore et gardez le mode par défaut « Restore to new location ». Tapez le nom du projet pour confirmer — une action délibérée à confirmation saisie. Les buckets miroités et les fichiers atterrissent dans le chemin cible de votre choix, sans toucher au projet vivant.",
      },
      'verify-data': {
        title: 'Vérifiez les objets restaurés',
        body: "Miroitez le bucket restauré dans une instance MinIO de test, puis listez son contenu avec mc ls. Comparez le nombre d'objets et la taille totale au bucket vivant, et sondez quelques objets réellement servis par votre application — un téléchargement qui s'ouvre correctement est le test de vérité le plus rapide.",
      },
      'promote': {
        title: 'Promouvez une fois satisfait',
        body: "Quand les objets restaurés sont validés, pointez votre application dessus (ou répétez la restauration en mode « Overwrite existing » — un opt-in explicite). Mieux : laissez l'exercice de restauration hebdomadaire produire cette preuve automatiquement.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Une copie restaurée du répertoire /data ne sert pas les objets, ou MinIO journalise des erreurs xl.meta au démarrage.",
      cause: "La sauvegarde a été faite en copiant le répertoire brut /data au lieu de miroiter via l'API S3. MinIO stocke chaque objet avec des fichiers de métadonnées xl.meta ; une copie brute qui les manque ou les déchire rend les objets illisibles.",
      fix: "Sauvegardez avec mc mirror via l'API S3 — l'approche que Dockstash configure par défaut. Si vous héritez d'une sauvegarde en copie brute, restaurez-la dans un MinIO arrêté de la même version et vérifiez chaque bucket avec mc ls avant de lui faire confiance.",
    },
    {
      symptom: 'Des objets récemment uploadés manquent dans la sauvegarde.',
      cause: "C'étaient des uploads multipart en cours quand le miroir a tourné — les uploads incomplets sont invisibles du listing S3 jusqu'à l'arrivée de la dernière part, et une copie brute les capturerait en fragments inutilisables.",
      fix: "Rien n'est corrompu : le prochain miroir planifié récupère les objets complétés. Si un upload précis compte, relancez Backup Now après sa complétion, ou planifiez les sauvegardes hors de vos fenêtres d'upload intensif.",
    },
    {
      symptom: "Un bucket versionné se restaure avec une seule version de chaque objet.",
      cause: "Un mc mirror simple copie l'état courant de chaque objet — les versions antérieures ne sont pas répliquées sans réplication de versions explicite.",
      fix: "Si vous comptez sur le versioning pour la récupération point-in-time, miroitez les versions explicitement (mc mirror avec réplication de versions), ou considérez la chronologie d'instantanés Dockstash comme votre historique de versions — chaque instantané quotidien préserve l'état des objets de ce jour.",
    },
    {
      symptom: 'Les commandes mc échouent avec « Access Denied » ou « invalid credentials ».',
      cause: "Les identifiants du compose ont changé (rotation de MINIO_ROOT_USER / MINIO_ROOT_PASSWORD par exemple) mais l'alias mc configuré dans le conteneur garde l'ancienne paire.",
      fix: "Recréez le conteneur pour reconstruire l'alias depuis l'env courant, ou relancez mc alias set dans le conteneur avec les nouveaux identifiants, puis relancez la sauvegarde.",
    },
  ],
  gotchas: [
    "Préférez mc mirror à la copie du répertoire brut /data — MinIO stocke les objets plus des métadonnées xl.meta, et une copie brute peut manquer des uploads multipart en cours.",
    "Miroitez via l'API S3 pour préserver de façon cohérente métadonnées, versions et tags des objets.",
    "Pour les buckets versionnés, répliquez les versions explicitement, sinon vous ne capturez que le dernier état de chaque objet.",
  ],
  faq: [
    {
      question: 'Sauvegarder MinIO avec mc mirror ou par copie de fichiers ?',
      answer:
        "Utilisez mc mirror. Il lit les objets via l'API S3 : chaque objet et ses métadonnées sont capturés de façon atomique. Une copie brute de /data peut saisir des uploads multipart en cours ou manquer la structure de métadonnées.",
    },
    {
      question: 'mc mirror préserve-t-il versions et tags ?',
      answer:
        "Il préserve métadonnées et tags des objets. Pour les buckets versionnés, il faut miroiter les versions explicitement, sinon seule la version courante de chaque objet est capturée.",
    },
    {
      question: 'Puis-je restaurer dans une instance MinIO neuve ?',
      answer:
        "Oui. Pointez mc sur la nouvelle instance, créez le bucket cible et miroitez le répertoire de sauvegarde en retour. Dockstash confie les objets miroités à restic entre les étapes.",
    },
    {
      question: 'Copier /data est-il parfois acceptable ?',
      answer:
        "Seulement avec MinIO totalement arrêté et aucune écriture en vol — et même alors, la structure de métadonnées doit être préservée exactement. Le miroir au niveau API est l'approche la plus sûre et supportée.",
    },
    {
      question: 'À quelle fréquence sauvegarder MinIO ?',
      answer:
        "Quotidien est le défaut pratique — mc mirror est incrémental, un jour calme ne coûte presque rien. Sur l'offre Free, les sauvegardes sont des Backup Now manuels ; Pro ajoute les planifications jusqu'à l'horaire, Business n'importe quelle expression cron. Associez la planification à un exercice de restauration hebdomadaire.",
    },
    {
      question: 'Où vivent réellement les sauvegardes ?',
      answer:
        "Sur votre propre VPS de stockage, sous forme d'instantanés restic chiffrés poussés via SSH. Dockstash ne garde jamais vos objets sur un cloud tiers — vous le pointez vers une machine que vous contrôlez, et le dépôt est chiffré avec un mot de passe que vous seul détenez.",
    },
    {
      question: 'Comment savoir que la sauvegarde est restaurable sans restauration manuelle ?',
      answer:
        "Planifiez un exercice de restauration. Dockstash restaure le dernier instantané dans un espace de travail isolé et compare chaque fichier restauré par empreinte d'octets avec la source — puis appose un badge réussite/échec sur le projet. Un exercice hebdomadaire prouve en continu que vos buckets reviennent.",
    },
  ],
};
