export const en = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    save: 'Save',
    delete: 'Delete',
    yes: 'Yes',
    no: 'No',
  },
  errors: {
    badRequest: 'Bad request.',
    unauthorized: 'You must be signed in to do that.',
    forbidden: 'You do not have permission to do that.',
    notFound: 'The requested resource was not found.',
    conflict: 'Conflict: the resource already exists.',
    internal: 'Something went wrong on our end. Please try again.',
    validationFailed: 'Validation failed.',
    projectNotFound: 'Project not found.',
    userNotFound: 'User not found.',
    invalidCredentials: 'Invalid email or password.',
    emailAlreadyRegistered: 'That email is already registered.',
    passwordTooShort: 'Password must be at least 8 characters.',
    emailNotVerified: 'Please verify your email address to continue.',
  },
  auth: {
    login: {
      title: 'Sign in',
      email: 'Email',
      password: 'Password',
      submit: 'Log in',
      submitting: 'Signing in…',
      forgot: 'Forgot password?',
    },
    register: {
      title: 'Create an account',
      submit: 'Create account',
    },
    reset: {
      title: 'Reset your password',
      submit: 'Reset password',
      sent: 'A reset link has been sent to your email.',
      tokenInvalid: 'That password reset link is invalid or has expired. Please request a new one.',
    },
    verify: {
      success: 'Your email address has been verified. You can now use Dockstash.',
      resent: 'If that account needs verification, a new link is on its way.',
      tokenInvalid: 'That verification link is invalid or has expired.',
    },
    otp: {
      sent: 'A verification code has been sent to your email.',
      invalid: 'That verification code is invalid or has expired.',
      tooManyAttempts: 'Too many incorrect codes. Please sign in again to get a new code.',
    },
  },
  billing: {
    checkout: {
      title: 'Checkout',
      submit: 'Pay now',
      success: 'Payment received. Thank you!',
    },
    portal: {
      title: 'Billing',
    },
    error: {
      notConfigured: 'Payment provider is not configured.',
      userNotFound: 'User not found.',
      noCustomer: 'No billing customer found for this user.',
      noSubscription: 'No active subscription found for this user.',
      providerFailure: 'Payment provider error: {{message}}',
    },
    entitlements: {
      projectLimitReached: 'Your plan does not allow more projects. Upgrade to add another.',
      schedulesLocked: 'Scheduled backups are not available on your current plan.',
      frequencyNotAllowed: 'Your plan does not allow that schedule frequency.',
      restoreDrillsLocked: 'Automated restore drills are available on Pro and Business plans.',
      multiVpsLocked: 'Multi-VPS fleet view is available on the Business plan.',
      projectPaused: 'This project is paused. Reactivate it or upgrade to run backups.',
      selectionInvalid: 'You must pick between one and {{cap}} projects to keep active.',
      notOwner: 'You do not own one or more of those projects.',
    },
  },
  email: {
    contact: {
      confirmation: 'Your email has been sent. We will be in touch with you soon.',
    },
    verifyEmail: {
      subject: 'Verify your email address',
      body:
        'Welcome to Dockstash. Please confirm your email address to activate your account.\n\n' +
        'Click the following link, or paste it into your browser:\n\n{{verifyUrl}}\n\n' +
        'This link expires in 24 hours. If you did not create an account, ignore this email.\n',
    },
    passwordReset: {
      subject: 'Reset your password',
      body:
        'You are receiving this because you (or someone else) requested a password reset for your account.\n\n' +
        'Please click the following link, or paste it into your browser, to complete the process:\n\n{{resetUrl}}\n\n' +
        'If you did not request this, ignore this email and your password will remain unchanged.\n',
    },
    passwordChanged: {
      subject: 'Your password was changed',
      body:
        'You are receiving this because your account password was just changed.\n\n' +
        'If you did not make this change, contact us immediately.',
    },
    welcome: {
      subject: 'Welcome to Dockstash',
      body:
        'Welcome to Dockstash, {{name}}.\n\n' +
        'You can sign in and manage your backups at {{clientUrl}}.\n',
    },
    paymentReceipt: {
      subject: 'Your Dockstash receipt',
      body:
        'Thanks for your payment of {{amount}} for the {{plan}} plan.\n\n' +
        'Manage billing at {{clientUrl}}/billing.\n',
    },
    dunning: {
      subject: 'Payment issue on your Dockstash subscription',
      body:
        'We could not charge your payment method for the {{plan}} plan.\n\n' +
        'Update it before {{graceEndsAt}} to keep the plan active: {{clientUrl}}/billing.\n',
    },
    drillFailure: {
      subject: 'Restore drill FAILED — project {{project}}',
      body:
        'A scheduled restore drill for project "{{project}}" failed at {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Last successful backup: {{lastGoodAt}}\n\n' +
        'Open the dashboard: {{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: 'Backup FAILED — project {{project}}',
      body:
        'A backup run for project "{{project}}" failed at {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Last successful backup: {{lastGoodAt}}\n\n' +
        'Open the dashboard: {{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: 'Restore FAILED — project {{project}}',
      body:
        'A restore for project "{{project}}" failed at {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Last successful backup: {{lastGoodAt}}\n\n' +
        'Open the dashboard: {{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: 'Silent stall — no backup in {{hours}}h for {{project}}',
      body:
        'No successful backup has run for project "{{project}}" in the past {{hours}} hour(s).\n\n' +
        'Last successful backup: {{lastGoodAt}}\n\n' +
        'Open the dashboard: {{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: 'Your Dockstash sign-in code',
      body:
        'Your sign-in verification code is: {{code}}\n\n' +
        'It expires in {{minutes}} minutes. If you did not try to sign in, change your password immediately.\n',
    },
    neverRun: 'never',
  },
  audit: {
    error: {
      notOwner: 'You do not have permission to view this audit log.',
    },
  },
  health: {
    error: {
      unavailable: 'Health check unavailable: {{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: 'Path {{path}} is not under the allowed /var/www root.',
      projectNotFound: 'Project not found.',
      notOwner: 'You do not own this project.',
      scanFailed: 'Failed to scan project: {{message}}',
      noAdapter: 'No backup adapter matched service {{service}}.',
      dumpFailed: 'Database dump failed for {{service}}: {{message}}',
      resticFailed: 'Restic backup failed: {{message}}',
      backupFailed: 'Backup failed: {{message}}',
      noSpace: 'Insufficient disk space (free={{free}} bytes).',
      runnerUnavailable: 'Snapshot listing is unavailable: the backup runner is not configured.',
      snapshotsFailed: 'Could not list snapshots: {{message}}',
      restoreFailed: 'Restore failed: {{message}}',
    },
    success: {
      backupComplete: 'Backup completed successfully.',
    },
    check: {
      pass: 'Repository check passed.',
      fail: 'Repository check failed: {{message}}',
    },
    drill: {
      pass: 'Restore drill passed: byte and row diffs are clean.',
      fail: 'Restore drill failed: {{message}}',
      failMismatches: 'Restore drill failed: {{count}} mismatch(es) — {{details}}',
      nothingToRestore: 'No snapshots to restore from.',
    },
  },
  scheduler: {
    error: {
      invalidCron: 'Invalid cron expression: {{expr}}',
      scheduleNotFound: 'Schedule not found.',
      notOwner: 'You do not own this schedule.',
      repoBusy: 'Repository {{projectId}} is busy — another job is running.',
      entitlementDenied: 'Your plan does not allow this schedule.',
      pruneFailed: 'Prune failed: {{message}}',
    },
    success: {
      scheduled: 'Schedule saved.',
      enqueued: 'Job enqueued.',
      prunePassed: 'Prune completed successfully.',
    },
    job: {
      failedRetriesExhausted: 'Job failed after {{attempts}} attempts: {{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: 'Import envelope is invalid: {{message}}',
      importTampered: 'Import envelope failed integrity check — a secret could not be decrypted.',
      keyVersionMismatch: 'Import envelope references key version {{version}} which this agent cannot decrypt.',
      plaintextForbidden: 'Import envelope contains a plaintext secret field ({{field}}) — refusing to import.',
      selfBackupFailed: 'Self-backup failed: {{message}}',
      userNotFound: 'Account not found.',
      notOwner: 'You do not own one or more of the referenced projects.',
      storageUnreachable: 'Storage repository is not reachable: {{message}}',
    },
    success: {
      exportReady: 'Configuration export is ready.',
      imported: 'Configuration import completed successfully.',
      escrowEnabled: 'Recovery codes generated. Save them now — they will not be shown again.',
      selfBackupComplete: 'Self-backup completed successfully.',
    },
  },
  settings: {
    error: {
      storageNotConfigured:
        'Storage is not configured. Add your storage VPS connection first.',
      connectionFailed: 'Storage connection test failed: {{message}}',
      hostKeyNotPinned:
        'Storage host key has not been verified yet. Run a connection test first.',
    },
  },
  agents: {
    error: {
      notFound: 'Agent not found.',
      notOwner: 'You do not own this agent.',
      unauthorized: 'Agent authentication failed.',
      jobNotFound: 'Agent job not found.',
      drillNotSupported: 'Restore drills are not supported on remote agents yet.',
      duplicateHost: 'An agent for this host already exists.',
    },
  },
  language: {
    switcher: {
      label: 'Language',
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
  superadmin: {
    error: {
      cannotModifySuperadmin: 'Superadmin accounts cannot be modified or deleted.',
    },
    success: {
      roleChanged: 'User role updated.',
      userVerified: 'User email marked as verified.',
      legalHoldUpdated: 'Legal hold updated.',
      deletionScheduled: 'Account deletion scheduled.',
    },
  },
  security: {
    error: {
      rateLimited: 'Too many requests. Try again later.',
      csrfInvalid: 'CSRF token missing or invalid.',
      hostKeyMalformed: 'Storage host-key fingerprint is malformed.',
      hostKeyMismatch: 'Storage host key mismatch. Expected {{expected}}, observed {{observed}}. Rejecting connection.',
    },
    legalHold: {
      pruneSkipped: 'Retention prune skipped: project is under legal hold.',
      deletionBlocked: 'Account deletion is blocked while a legal hold is active.',
    },
    deletion: {
      alreadyScheduled: 'Account deletion is already scheduled.',
      notConfigured: 'Deletion queue is not configured.',
      purgeFailed: 'Backup repository purge failed: {{message}}',
      warningSubject: 'Your Dockstash account will be deleted',
      warningBody:
        'Hi {{name}},\n\nYou requested to delete your Dockstash account. Your data — including every backup snapshot — will be permanently purged at {{purgeAt}}.\n\nIf you change your mind, sign in and cancel the deletion before that time.',
    },
  },
};

export type DictionaryShape = typeof en;
