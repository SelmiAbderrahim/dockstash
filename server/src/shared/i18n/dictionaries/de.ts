import type { DictionaryShape } from './en.js';

export const de: DictionaryShape = {
  common: {
    ok: 'OK',
    cancel: 'Abbrechen',
    save: 'Speichern',
    delete: 'Löschen',
    yes: 'Ja',
    no: 'Nein',
  },
  errors: {
    badRequest: 'Ungültige Anfrage.',
    unauthorized: 'Sie müssen angemeldet sein, um das zu tun.',
    forbidden: 'Sie haben keine Berechtigung dafür.',
    notFound: 'Die angeforderte Ressource wurde nicht gefunden.',
    conflict: 'Konflikt: Die Ressource existiert bereits.',
    internal: 'Bei uns ist etwas schiefgelaufen. Bitte versuchen Sie es erneut.',
    validationFailed: 'Validierung fehlgeschlagen.',
    projectNotFound: 'Projekt nicht gefunden.',
    userNotFound: 'Benutzer nicht gefunden.',
    invalidCredentials: 'Ungültige E-Mail oder Passwort.',
    emailAlreadyRegistered: 'Diese E-Mail ist bereits registriert.',
    passwordTooShort: 'Das Passwort muss mindestens 8 Zeichen lang sein.',
    emailNotVerified: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um fortzufahren.',
  },
  auth: {
    login: {
      title: 'Anmelden',
      email: 'E-Mail',
      password: 'Passwort',
      submit: 'Anmelden',
      submitting: 'Anmeldung läuft…',
      forgot: 'Passwort vergessen?',
    },
    register: {
      title: 'Konto erstellen',
      submit: 'Konto erstellen',
    },
    reset: {
      title: 'Passwort zurücksetzen',
      submit: 'Zurücksetzen',
      sent: 'Ein Zurücksetzungs-Link wurde an Ihre E-Mail gesendet.',
      tokenInvalid: 'Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.',
    },
    verify: {
      success: 'Ihre E-Mail-Adresse wurde bestätigt. Sie können Dockstash jetzt verwenden.',
      resent: 'Falls dieses Konto eine Bestätigung benötigt, ist ein neuer Link unterwegs.',
      tokenInvalid: 'Dieser Bestätigungslink ist ungültig oder abgelaufen.',
    },
    otp: {
      sent: 'Ein Bestätigungscode wurde an Ihre E-Mail gesendet.',
      invalid: 'Dieser Bestätigungscode ist ungültig oder abgelaufen.',
      tooManyAttempts: 'Zu viele falsche Codes. Bitte melden Sie sich erneut an, um einen neuen Code zu erhalten.',
    },
  },
  billing: {
    checkout: {
      title: 'Kasse',
      submit: 'Jetzt bezahlen',
      success: 'Zahlung erhalten. Vielen Dank!',
    },
    portal: {
      title: 'Abrechnung',
    },
    error: {
      notConfigured: 'Zahlungsanbieter ist nicht konfiguriert.',
      userNotFound: 'Benutzer nicht gefunden.',
      noCustomer: 'Kein Abrechnungs-Kunde für diesen Benutzer gefunden.',
      noSubscription: 'Kein aktives Abonnement für diesen Benutzer gefunden.',
      providerFailure: 'Fehler des Zahlungsanbieters: {{message}}',
    },
    entitlements: {
      projectLimitReached: 'Ihr Tarif erlaubt keine weiteren Projekte. Upgraden Sie, um weitere hinzuzufügen.',
      schedulesLocked: 'Geplante Backups sind in Ihrem aktuellen Tarif nicht verfügbar.',
      frequencyNotAllowed: 'Ihr Tarif erlaubt diese Zeitplan-Häufigkeit nicht.',
      restoreDrillsLocked: 'Automatische Wiederherstellungstests sind in den Tarifen Pro und Business verfügbar.',
      multiVpsLocked: 'Die Multi-VPS-Flottenansicht ist im Business-Tarif verfügbar.',
      projectPaused: 'Dieses Projekt ist pausiert. Reaktivieren Sie es oder upgraden Sie, um Backups auszuführen.',
      selectionInvalid: 'Wählen Sie zwischen einem und {{cap}} Projekten aus, die aktiv bleiben sollen.',
      notOwner: 'Sie sind nicht der Eigentümer eines oder mehrerer dieser Projekte.',
    },
  },
  email: {
    contact: {
      confirmation: 'Ihre Nachricht wurde gesendet. Wir melden uns bald bei Ihnen.',
    },
    verifyEmail: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      body:
        'Willkommen bei Dockstash. Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.\n\n' +
        'Klicken Sie auf den folgenden Link oder fügen Sie ihn in Ihren Browser ein:\n\n{{verifyUrl}}\n\n' +
        'Dieser Link läuft in 24 Stunden ab. Falls Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail.\n',
    },
    passwordReset: {
      subject: 'Passwort zurücksetzen',
      body:
        'Sie erhalten diese E-Mail, weil Sie (oder jemand anderes) das Zurücksetzen des Passworts für Ihr Konto angefordert haben.\n\n' +
        'Klicken Sie auf den folgenden Link oder fügen Sie ihn in Ihren Browser ein, um den Vorgang abzuschließen:\n\n{{resetUrl}}\n\n' +
        'Wenn Sie das nicht angefordert haben, ignorieren Sie diese E-Mail; Ihr Passwort bleibt unverändert.\n',
    },
    passwordChanged: {
      subject: 'Ihr Passwort wurde geändert',
      body:
        'Sie erhalten diese E-Mail, weil das Passwort Ihres Kontos gerade geändert wurde.\n\n' +
        'Wenn Sie das nicht selbst getan haben, kontaktieren Sie uns bitte sofort.',
    },
    welcome: {
      subject: 'Willkommen bei Dockstash',
      body:
        'Willkommen bei Dockstash, {{name}}.\n\n' +
        'Sie können sich anmelden und Ihre Backups auf {{clientUrl}} verwalten.\n',
    },
    paymentReceipt: {
      subject: 'Ihre Dockstash-Quittung',
      body:
        'Vielen Dank für Ihre Zahlung von {{amount}} für den {{plan}}-Tarif.\n\n' +
        'Verwalten Sie die Abrechnung auf {{clientUrl}}/billing.\n',
    },
    dunning: {
      subject: 'Zahlungsproblem bei Ihrem Dockstash-Abo',
      body:
        'Wir konnten Ihre Zahlungsmethode für den {{plan}}-Tarif nicht belasten.\n\n' +
        'Aktualisieren Sie sie vor dem {{graceEndsAt}}, um den Tarif zu behalten: {{clientUrl}}/billing.\n',
    },
    drillFailure: {
      subject: 'Wiederherstellungstest FEHLGESCHLAGEN — Projekt {{project}}',
      body:
        'Ein geplanter Wiederherstellungstest für Projekt „{{project}}“ ist am {{failedAt}} fehlgeschlagen.\n\n' +
        'Fehler: {{error}}\n' +
        'Letztes erfolgreiches Backup: {{lastGoodAt}}\n\n' +
        'Dashboard öffnen: {{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: 'Backup FEHLGESCHLAGEN — Projekt {{project}}',
      body:
        'Ein Backup-Lauf für Projekt „{{project}}“ ist am {{failedAt}} fehlgeschlagen.\n\n' +
        'Fehler: {{error}}\n' +
        'Letztes erfolgreiches Backup: {{lastGoodAt}}\n\n' +
        'Dashboard öffnen: {{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: 'Wiederherstellung FEHLGESCHLAGEN — Projekt {{project}}',
      body:
        'Eine Wiederherstellung für Projekt „{{project}}“ ist am {{failedAt}} fehlgeschlagen.\n\n' +
        'Fehler: {{error}}\n' +
        'Letztes erfolgreiches Backup: {{lastGoodAt}}\n\n' +
        'Dashboard öffnen: {{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: 'Stiller Stillstand — kein Backup seit {{hours}}h für {{project}}',
      body:
        'Für Projekt „{{project}}“ ist in den letzten {{hours}} Stunde(n) kein erfolgreiches Backup gelaufen.\n\n' +
        'Letztes erfolgreiches Backup: {{lastGoodAt}}\n\n' +
        'Dashboard öffnen: {{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: 'Ihr Dockstash-Anmeldecode',
      body:
        'Ihr Anmelde-Bestätigungscode lautet: {{code}}\n\n' +
        'Er läuft in {{minutes}} Minuten ab. Falls Sie sich nicht anmelden wollten, ändern Sie sofort Ihr Passwort.\n',
    },
    neverRun: 'nie',
  },
  audit: {
    error: {
      notOwner: 'Sie haben keine Berechtigung, dieses Audit-Log einzusehen.',
    },
  },
  health: {
    error: {
      unavailable: 'Health-Check nicht verfügbar: {{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: 'Pfad {{path}} liegt nicht unter dem erlaubten Root /var/www.',
      projectNotFound: 'Projekt nicht gefunden.',
      notOwner: 'Sie sind nicht Eigentümer dieses Projekts.',
      scanFailed: 'Projekt-Scan fehlgeschlagen: {{message}}',
      noAdapter: 'Kein Backup-Adapter passt zum Dienst {{service}}.',
      dumpFailed: 'Datenbank-Dump fehlgeschlagen für {{service}}: {{message}}',
      resticFailed: 'Restic-Backup fehlgeschlagen: {{message}}',
      backupFailed: 'Backup fehlgeschlagen: {{message}}',
      noSpace: 'Nicht genügend Speicherplatz (frei={{free}} Bytes).',
      runnerUnavailable: 'Snapshot-Liste nicht verfügbar: der Backup-Runner ist nicht konfiguriert.',
      snapshotsFailed: 'Snapshots konnten nicht aufgelistet werden: {{message}}',
      restoreFailed: 'Wiederherstellung fehlgeschlagen: {{message}}',
    },
    success: {
      backupComplete: 'Backup erfolgreich abgeschlossen.',
    },
    check: {
      pass: 'Repository-Prüfung bestanden.',
      fail: 'Repository-Prüfung fehlgeschlagen: {{message}}',
    },
    drill: {
      pass: 'Wiederherstellungs-Drill bestanden: Byte- und Zeilen-Diffs sind sauber.',
      fail: 'Wiederherstellungs-Drill fehlgeschlagen: {{message}}',
      failMismatches: 'Wiederherstellungs-Drill fehlgeschlagen: {{count}} Abweichung(en) — {{details}}',
      nothingToRestore: 'Keine Snapshots zum Wiederherstellen.',
    },
  },
  scheduler: {
    error: {
      invalidCron: 'Ungültiger Cron-Ausdruck: {{expr}}',
      scheduleNotFound: 'Zeitplan nicht gefunden.',
      notOwner: 'Sie besitzen diesen Zeitplan nicht.',
      repoBusy: 'Repository {{projectId}} ist beschäftigt — ein anderer Job läuft bereits.',
      entitlementDenied: 'Ihr Tarif erlaubt diesen Zeitplan nicht.',
      pruneFailed: 'Prune fehlgeschlagen: {{message}}',
    },
    success: {
      scheduled: 'Zeitplan gespeichert.',
      enqueued: 'Job in die Warteschlange gestellt.',
      prunePassed: 'Prune erfolgreich abgeschlossen.',
    },
    job: {
      failedRetriesExhausted: 'Job nach {{attempts}} Versuchen fehlgeschlagen: {{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: 'Import-Umschlag ist ungültig: {{message}}',
      importTampered: 'Integritätsprüfung des Import-Umschlags fehlgeschlagen — ein Geheimnis konnte nicht entschlüsselt werden.',
      keyVersionMismatch: 'Import-Umschlag verweist auf Schlüsselversion {{version}}, die dieser Agent nicht entschlüsseln kann.',
      plaintextForbidden: 'Import-Umschlag enthält ein Geheimnisfeld im Klartext ({{field}}) — Import verweigert.',
      selfBackupFailed: 'Selbst-Backup fehlgeschlagen: {{message}}',
      userNotFound: 'Konto nicht gefunden.',
      notOwner: 'Sie sind nicht Eigentümer eines oder mehrerer der referenzierten Projekte.',
      storageUnreachable: 'Speicher-Repository ist nicht erreichbar: {{message}}',
    },
    success: {
      exportReady: 'Konfigurations-Export ist bereit.',
      imported: 'Konfigurations-Import erfolgreich abgeschlossen.',
      escrowEnabled: 'Wiederherstellungscodes erstellt. Speichern Sie sie jetzt — sie werden nicht erneut angezeigt.',
      selfBackupComplete: 'Selbst-Backup erfolgreich abgeschlossen.',
    },
  },
  settings: {
    error: {
      storageNotConfigured: 'Der Speicher ist nicht konfiguriert. Fügen Sie zuerst die Verbindung zu Ihrem Speicher-VPS hinzu.',
      connectionFailed: 'Speicher-Verbindungstest fehlgeschlagen: {{message}}',
      hostKeyNotPinned: 'Der Host-Schlüssel des Speichers wurde noch nicht verifiziert. Führen Sie zuerst einen Verbindungstest aus.',
    },
  },
  agents: {
    error: {
      notFound: 'Agent nicht gefunden.',
      notOwner: 'Dieser Agent gehört Ihnen nicht.',
    },
  },
  language: {
    switcher: {
      label: 'Sprache',
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
      cannotModifySuperadmin: 'Superadmin-Konten können nicht geändert oder gelöscht werden.',
    },
    success: {
      roleChanged: 'Benutzerrolle aktualisiert.',
      userVerified: 'Benutzer-E-Mail als bestätigt markiert.',
      legalHoldUpdated: 'Legal Hold aktualisiert.',
      deletionScheduled: 'Kontolöschung geplant.',
    },
  },
  security: {
    error: {
      rateLimited: 'Zu viele Anfragen. Bitte später erneut versuchen.',
      csrfInvalid: 'CSRF-Token fehlt oder ist ungültig.',
      hostKeyMalformed: 'Der Fingerabdruck des Speicher-Hostschlüssels ist fehlerhaft.',
      hostKeyMismatch: 'Speicher-Hostschlüssel stimmt nicht überein. Erwartet {{expected}}, beobachtet {{observed}}. Verbindung abgelehnt.',
    },
    legalHold: {
      pruneSkipped: 'Aufbewahrungslöschung übersprungen: Projekt steht unter Legal Hold.',
      deletionBlocked: 'Kontolöschung ist bei aktivem Legal Hold gesperrt.',
    },
    deletion: {
      alreadyScheduled: 'Die Kontolöschung ist bereits geplant.',
      notConfigured: 'Löschwarteschlange ist nicht konfiguriert.',
      purgeFailed: 'Löschen des Backup-Repositorys fehlgeschlagen: {{message}}',
      warningSubject: 'Ihr Dockstash-Konto wird gelöscht',
      warningBody:
        'Hallo {{name}},\n\nSie haben die Löschung Ihres Dockstash-Kontos angefordert. Ihre Daten werden am {{purgeAt}} unwiderruflich gelöscht.',
    },
  },
};
