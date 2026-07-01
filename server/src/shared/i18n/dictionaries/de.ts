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
      projectPaused: 'Dieses Projekt ist pausiert. Reaktivieren Sie es oder upgraden Sie, um Backups auszuführen.',
      selectionInvalid: 'Wählen Sie zwischen einem und {{cap}} Projekten aus, die aktiv bleiben sollen.',
      notOwner: 'Sie sind nicht der Eigentümer eines oder mehrerer dieser Projekte.',
      trialAlreadyClaimed: 'Eine Testphase wurde für dieses Konto bereits verwendet.',
    },
  },
  email: {
    contact: {
      confirmation: 'Ihre Nachricht wurde gesendet. Wir melden uns bald bei Ihnen.',
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
      notOwner: 'Sie sind nicht Eigentümer eines oder mehrerer der referenzierten Projekte.',
      storageUnreachable: 'Speicher-Repository ist nicht erreichbar: {{message}}',
    },
    success: {
      exportReady: 'Konfigurations-Export ist bereit.',
      imported: 'Konfigurations-Import erfolgreich abgeschlossen.',
      selfBackupComplete: 'Selbst-Backup erfolgreich abgeschlossen.',
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
