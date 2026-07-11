import type { DictionaryShape } from './en.js';

export const fr: DictionaryShape = {
  common: {
    ok: 'OK',
    cancel: 'Annuler',
    save: 'Enregistrer',
    delete: 'Supprimer',
    yes: 'Oui',
    no: 'Non',
  },
  errors: {
    badRequest: 'Requête invalide.',
    unauthorized: 'Vous devez être connecté pour effectuer cette action.',
    forbidden: 'Vous n’avez pas la permission d’effectuer cette action.',
    notFound: 'La ressource demandée est introuvable.',
    conflict: 'Conflit : la ressource existe déjà.',
    internal: 'Une erreur est survenue chez nous. Veuillez réessayer.',
    validationFailed: 'La validation a échoué.',
    projectNotFound: 'Projet introuvable.',
    userNotFound: 'Utilisateur introuvable.',
    invalidCredentials: 'E-mail ou mot de passe invalide.',
    emailAlreadyRegistered: 'Cet e-mail est déjà enregistré.',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères.',
    emailNotVerified: 'Veuillez vérifier votre adresse e-mail pour continuer.',
    ssrf: {
      scheme:
        'Cette URL n’est pas autorisée. Seules les URL http(s) vers des hôtes publics sont acceptées.',
      private:
        'Cette URL pointe vers une adresse interne ou réservée. Utilisez un nom d’hôte public.',
      dnsFailed: 'Cette URL n’a pas pu être résolue.',
      tooManyRedirects: 'Cette URL a effectué trop de redirections.',
    },
  },
  auth: {
    login: {
      title: 'Connexion',
      email: 'E-mail',
      password: 'Mot de passe',
      submit: 'Se connecter',
      submitting: 'Connexion…',
      forgot: 'Mot de passe oublié ?',
    },
    register: {
      title: 'Créer un compte',
      submit: 'Créer le compte',
    },
    reset: {
      title: 'Réinitialiser votre mot de passe',
      submit: 'Réinitialiser',
      sent: 'Un lien de réinitialisation a été envoyé à votre e-mail.',
      tokenInvalid: 'Ce lien de réinitialisation est invalide ou a expiré. Veuillez en demander un nouveau.',
    },
    verify: {
      success: 'Votre adresse e-mail a été vérifiée. Vous pouvez maintenant utiliser Dockstash.',
      resent: 'Si ce compte doit être vérifié, un nouveau lien est en route.',
      tokenInvalid: 'Ce lien de vérification est invalide ou a expiré.',
    },
    otp: {
      sent: 'Un code de vérification a été envoyé à votre adresse e-mail.',
      invalid: 'Ce code de vérification est invalide ou a expiré.',
      tooManyAttempts: 'Trop de codes incorrects. Veuillez vous reconnecter pour recevoir un nouveau code.',
    },
    oauth: {
      providerNotEnabled: "Ce fournisseur de connexion n'est pas activé.",
    },
  },
  billing: {
    checkout: {
      title: 'Paiement',
      submit: 'Payer maintenant',
      success: 'Paiement reçu. Merci !',
    },
    portal: {
      title: 'Facturation',
    },
    error: {
      notConfigured: 'Le fournisseur de paiement n’est pas configuré.',
      userNotFound: 'Utilisateur introuvable.',
      noCustomer: 'Aucun client de facturation trouvé pour cet utilisateur.',
      noSubscription: 'Aucun abonnement actif trouvé pour cet utilisateur.',
      providerFailure: 'Erreur du fournisseur de paiement : {{message}}',
    },
    entitlements: {
      projectLimitReached: 'Votre offre ne permet pas plus de projets. Passez à une offre supérieure pour en ajouter.',
      schedulesLocked: 'Les sauvegardes planifiées ne sont pas disponibles sur votre offre actuelle.',
      frequencyNotAllowed: 'Votre offre ne permet pas cette fréquence de planification.',
      restoreDrillsLocked: 'Les tests de restauration automatiques sont disponibles avec les offres Pro et Business.',
      pitrLocked: 'La restauration à un instant donné est disponible avec les offres Pro et Business.',
      mirrorLocked: 'Le mode miroir est disponible avec l\'offre Business.',
      alertsLocked: 'Les canaux d\'alerte (e-mail et webhooks) sont disponibles avec les offres Pro et Business.',
      agentLimitReached: 'Limite d\'agents atteinte pour votre offre. Passez à une offre supérieure pour connecter plus de serveurs.',
      projectPaused: 'Ce projet est en pause. Réactivez-le ou passez à une offre supérieure pour lancer des sauvegardes.',
      selectionInvalid: 'Vous devez choisir entre un et {{cap}} projets à garder actifs.',
      notOwner: 'Vous n’êtes pas propriétaire d’un ou plusieurs de ces projets.',
    },
  },
  email: {
    contact: {
      confirmation: 'Votre e-mail a été envoyé. Nous vous répondrons rapidement.',
    },
    verifyEmail: {
      subject: 'Vérifiez votre adresse e-mail',
      body:
        'Bienvenue sur Dockstash. Veuillez confirmer votre adresse e-mail pour activer votre compte.\n\n' +
        'Cliquez sur le lien suivant ou collez-le dans votre navigateur :\n\n{{verifyUrl}}\n\n' +
        "Ce lien expire dans 24 heures. Si vous n'avez pas créé de compte, ignorez cet e-mail.\n",
    },
    passwordReset: {
      subject: 'Réinitialisez votre mot de passe',
      body:
        'Vous recevez cet e-mail car vous (ou quelqu’un d’autre) avez demandé la réinitialisation du mot de passe de votre compte.\n\n' +
        'Cliquez sur le lien ci-dessous, ou copiez-le dans votre navigateur, pour terminer la procédure :\n\n{{resetUrl}}\n\n' +
        'Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe restera inchangé.\n',
    },
    passwordChanged: {
      subject: 'Votre mot de passe a été changé',
      body:
        'Vous recevez cet e-mail car le mot de passe de votre compte vient d’être modifié.\n\n' +
        'Si vous n’êtes pas à l’origine de cette modification, contactez-nous immédiatement.',
    },
    welcome: {
      subject: 'Bienvenue sur Dockstash',
      body:
        'Bienvenue sur Dockstash, {{name}}.\n\n' +
        'Connectez-vous et gérez vos sauvegardes sur {{clientUrl}}.\n',
    },
    inviteClaimed: {
      subject: 'Invitation activée : {{plan}}',
      body:
        'Un lien d\'invitation a été activé.\n\n' +
        'Bénéficiaire : {{claimantName}} <{{claimantEmail}}>\n' +
        'Offre : {{plan}} ({{grantDuration}})\n' +
        'Période offerte : {{claimedAt}} → {{currentPeriodEnd}}\n' +
        'Libellé : {{label}}\n\n' +
        'Gérer les invitations : {{invitationsUrl}}\n',
    },
    paymentReceipt: {
      subject: 'Votre reçu Dockstash',
      body:
        'Merci pour votre paiement de {{amount}} pour l’offre {{plan}}.\n\n' +
        'Gérez la facturation sur {{clientUrl}}/billing.\n',
    },
    dunning: {
      subject: 'Problème de paiement sur votre abonnement Dockstash',
      body:
        'Nous n’avons pas pu débiter votre moyen de paiement pour l’offre {{plan}}.\n\n' +
        'Mettez-le à jour avant le {{graceEndsAt}} pour conserver l’offre : {{clientUrl}}/billing.\n',
    },
    downgradeNotice: {
      subject: 'Votre offre Dockstash est passée à Free',
      body:
        'Votre offre {{plan}} a expiré et votre compte est désormais sur l’offre Free.\n\n' +
        'Vos sauvegardes existantes sont en sécurité — rien n’a été supprimé. Les projets ' +
        'au-delà de la limite Free sont en pause (lecture seule) jusqu’à votre réabonnement : {{clientUrl}}/billing.\n',
    },
    reactivation: {
      subject: 'Votre abonnement Dockstash est de nouveau actif',
      body:
        'Bonne nouvelle — votre abonnement {{plan}} est de nouveau actif et les projets ' +
        'en pause sont de nouveau en ligne.\n\n' +
        'Gérez votre compte sur {{clientUrl}}/billing.\n',
    },
    drillFailure: {
      subject: 'ÉCHEC du test de restauration — projet {{project}}',
      body:
        'Un test de restauration planifié pour le projet « {{project}} » a échoué le {{failedAt}}.\n\n' +
        'Erreur : {{error}}\n' +
        'Dernière sauvegarde réussie : {{lastGoodAt}}\n\n' +
        'Ouvrez le tableau de bord : {{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: 'ÉCHEC de la sauvegarde — projet {{project}}',
      body:
        'Une exécution de sauvegarde pour le projet « {{project}} » a échoué le {{failedAt}}.\n\n' +
        'Erreur : {{error}}\n' +
        'Dernière sauvegarde réussie : {{lastGoodAt}}\n\n' +
        'Ouvrez le tableau de bord : {{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: 'ÉCHEC de la restauration — projet {{project}}',
      body:
        'Une restauration pour le projet « {{project}} » a échoué le {{failedAt}}.\n\n' +
        'Erreur : {{error}}\n' +
        'Dernière sauvegarde réussie : {{lastGoodAt}}\n\n' +
        'Ouvrez le tableau de bord : {{clientUrl}}/projects/{{projectId}}\n',
    },
    mirrorFailure: {
      subject: 'ÉCHEC du miroir — projet {{project}}',
      body:
        'Une exécution miroir pour le projet « {{project}} » a échoué le {{failedAt}}.\n\n' +
        'Erreur : {{error}}\n' +
        'Dernière sauvegarde réussie : {{lastGoodAt}}\n\n' +
        'Ouvrez le tableau de bord : {{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: 'Arrêt silencieux — aucune sauvegarde depuis {{hours}}h pour {{project}}',
      body:
        'Aucune sauvegarde réussie pour le projet « {{project}} » depuis {{hours}} heure(s).\n\n' +
        'Dernière sauvegarde réussie : {{lastGoodAt}}\n\n' +
        'Ouvrez le tableau de bord : {{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: 'Votre code de connexion Dockstash',
      body:
        'Votre code de vérification de connexion est : {{code}}\n\n' +
        'Il expire dans {{minutes}} minutes. Si vous n\'avez pas tenté de vous connecter, changez immédiatement votre mot de passe.\n',
    },
    neverRun: 'jamais',
  },
  audit: {
    error: {
      notOwner: 'Vous n’avez pas la permission de consulter ce journal d’audit.',
    },
  },
  health: {
    error: {
      unavailable: 'Contrôle de santé indisponible : {{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: 'Le chemin {{path}} n’est pas dans les répertoires de projets autorisés pour cette cible de sauvegarde.',
      projectNotFound: 'Projet introuvable.',
      notOwner: 'Vous n’êtes pas propriétaire de ce projet.',
      scanFailed: 'Échec de l’analyse du projet : {{message}}',
      discoverFailed: 'Échec de la découverte : {{message}}',
      noAdapter: 'Aucun adaptateur de sauvegarde ne correspond au service {{service}}.',
      dumpFailed: 'Échec du dump de la base de données pour {{service}} : {{message}}',
      containerNotRunning:
        "Le conteneur {{container}} n'est pas en cours d'exécution — démarrez-le ou désactivez cette couche de base de données.",
      resticFailed: 'Échec de la sauvegarde Restic : {{message}}',
      backupFailed: 'Échec de la sauvegarde : {{message}}',
      noSpace: 'Espace disque insuffisant (libre={{free}} octets).',
      runnerUnavailable: 'La liste des instantanés est indisponible : l’exécuteur de sauvegarde n’est pas configuré.',
      snapshotsFailed: 'Impossible de lister les instantanés : {{message}}',
      noSnapshotBeforeTs: 'Aucun instantané n\'existe à {{ts}} ou avant.',
      restoreFailed: 'Échec de la restauration : {{message}}',
      mirrorNotConfigured: 'Le miroir n\'est pas configuré ou pas activé pour ce projet.',
      mirrorFailed: 'Échec de l\'exécution du miroir : {{message}}',
      restoreSnapshotNotFound: 'Le snapshot {{snapshotId}} est introuvable dans le dépôt de ce projet.',
      restoreUnsupportedEngine: 'La restauration en place n’est pas encore prise en charge pour {{type}}. Restaurez vers un nouvel emplacement et chargez l’artefact manuellement.',
      restoreNeedsDocker: 'La restauration de base de données nécessite l’environnement Docker ; il n’est pas configuré sur ce serveur.',
      restoreContainerNotRunning: 'Le conteneur {{container}} n’est pas en cours d’exécution — démarrez-le puis relancez la restauration.',
      restorePathOutsideRoots: 'Le contenu du snapshot ({{path}}) est hors des répertoires de projet autorisés ; restaurez plutôt vers un nouvel emplacement.',
    },
    success: {
      backupComplete: 'Sauvegarde terminée avec succès.',
      mirrorComplete: 'Miroir terminé avec succès.',
    },
    check: {
      pass: 'Vérification du dépôt réussie.',
      fail: 'Échec de la vérification du dépôt : {{message}}',
    },
    drill: {
      pass: 'Test de restauration réussi : diffs byte et lignes propres.',
      fail: 'Échec du test de restauration : {{message}}',
      failMismatches: 'Échec du test de restauration : {{count}} divergence(s) — {{details}}',
      nothingToRestore: 'Aucun snapshot à restaurer.',
    },
  },
  scheduler: {
    error: {
      invalidCron: 'Expression cron invalide : {{expr}}',
      scheduleNotFound: 'Planification introuvable.',
      notOwner: 'Vous ne possédez pas cette planification.',
      repoBusy: 'Le dépôt {{projectId}} est occupé — une autre tâche est en cours.',
      entitlementDenied: 'Votre offre ne permet pas cette planification.',
      pruneFailed: 'Échec du nettoyage : {{message}}',
    },
    success: {
      scheduled: 'Planification enregistrée.',
      enqueued: 'Tâche mise en file d’attente.',
      prunePassed: 'Nettoyage terminé avec succès.',
      pruneSkippedPaused: 'Purge de rétention ignorée : le projet est en pause ; les instantanés stockés sont conservés.',
    },
    job: {
      failedRetriesExhausted: 'Échec de la tâche après {{attempts}} tentatives : {{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: 'L’enveloppe d’import est invalide : {{message}}',
      importTampered: 'Le contrôle d’intégrité de l’enveloppe d’import a échoué — un secret n’a pas pu être déchiffré.',
      keyVersionMismatch: 'L’enveloppe d’import référence la version de clé {{version}} que cet agent ne peut pas déchiffrer.',
      plaintextForbidden: 'L’enveloppe d’import contient un champ de secret en clair ({{field}}) — import refusé.',
      selfBackupFailed: 'Échec de la sauvegarde interne : {{message}}',
      userNotFound: 'Compte introuvable.',
      notOwner: 'Vous n’êtes pas propriétaire d’un ou plusieurs projets référencés.',
      storageUnreachable: 'Le dépôt de stockage est inaccessible : {{message}}',
    },
    success: {
      exportReady: 'L’export de configuration est prêt.',
      imported: 'Import de configuration terminé avec succès.',
      escrowEnabled: 'Codes de récupération générés. Enregistrez-les maintenant — ils ne seront plus affichés.',
      selfBackupComplete: 'Sauvegarde interne terminée avec succès.',
    },
  },
  settings: {
    error: {
      storageNotConfigured: 'Le stockage n’est pas configuré. Ajoutez d’abord la connexion à votre VPS de stockage.',
      connectionFailed: 'Échec du test de connexion au stockage : {{message}}',
      hostKeyNotPinned: 'La clé d’hôte du stockage n’a pas encore été vérifiée. Lancez d’abord un test de connexion.',
    },
  },
  agents: {
    error: {
      notFound: 'Agent introuvable.',
      notOwner: 'Vous ne possédez pas cet agent.',
      unauthorized: "Échec de l'authentification de l'agent.",
      jobNotFound: "Tâche d'agent introuvable.",
      drillNotSupported: "Les exercices de restauration ne sont pas encore pris en charge sur les agents distants.",
      mirrorNotSupported: "Les tâches miroir ne sont pas encore prises en charge sur les agents distants.",
      duplicateHost: "Un agent pour cet hôte existe déjà.",
    },
  },
  language: {
    switcher: {
      label: 'Langue',
    },
    names: {
      en: 'English',
      ar: 'العربية',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
    },
  },
  invitations: {
    error: {
      notFound: 'Ce lien d\'invitation n\'est pas valide.',
      expired: 'Ce lien d\'invitation a expiré.',
      revoked: 'Ce lien d\'invitation a été révoqué.',
      alreadyClaimed: 'Ce lien d\'invitation a déjà été utilisé.',
      alreadySubscribed: 'Vous avez déjà une offre payante active.',
    },
  },
  superadmin: {
    error: {
      cannotModifySuperadmin: 'Les comptes superadministrateur ne peuvent pas être modifiés ni supprimés.',
    },
    success: {
      roleChanged: 'Rôle de l\'utilisateur mis à jour.',
      userVerified: 'E-mail de l\'utilisateur marqué comme vérifié.',
      legalHoldUpdated: 'Conservation légale mise à jour.',
      deletionScheduled: 'Suppression du compte planifiée.',
      invitationCreated: 'Lien d\'invitation créé.',
      invitationRevoked: 'Lien d\'invitation révoqué.',
    },
  },
  security: {
    error: {
      rateLimited: 'Trop de requêtes. Réessayez plus tard.',
      csrfInvalid: 'Jeton CSRF manquant ou invalide.',
      hostKeyMalformed: 'L\'empreinte de la clé hôte de stockage est mal formée.',
      hostKeyMismatch: 'Incompatibilité de clé hôte de stockage. Attendu {{expected}}, observé {{observed}}. Connexion refusée.',
    },
    legalHold: {
      pruneSkipped: 'Purge de rétention ignorée : le projet est sous conservation légale.',
      deletionBlocked: 'La suppression du compte est bloquée tant qu\'une conservation légale est active.',
    },
    deletion: {
      alreadyScheduled: 'La suppression du compte est déjà programmée.',
      notConfigured: 'La file de suppression n\'est pas configurée.',
      purgeFailed: 'Échec de la purge du dépôt de sauvegarde : {{message}}',
      warningSubject: 'Votre compte Dockstash sera supprimé',
      warningBody:
        'Bonjour {{name}}, vous avez demandé la suppression de votre compte Dockstash. Vos données seront définitivement supprimées le {{purgeAt}}.',
    },
  },
};
