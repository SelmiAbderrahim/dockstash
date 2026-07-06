// Deutsche Texte für den MariaDB-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.mariadb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MARIADB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit MariaDB hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem MariaDB-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass MariaDB erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das mariadb-Image und fügt eine Datenbank-Ebene mit dem richtigen Dump-Befehl hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (MARIADB_ROOT_PASSWORD oder das ältere MYSQL_ROOT_PASSWORD, dazu MARIADB_DATABASE und MARIADB_USER). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Dump von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie denselben Dump aus, den Dockstash ausführen wird — mariadb-dump mit --single-transaction. Sie sollten SQL vorbeiströmen sehen: CREATE DATABASE, CREATE TABLE und INSERT. Genau diese Ausgabe wird gesichert, niemals das laufende Verzeichnis /var/lib/mysql.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten MariaDB-Projekte der richtige Standard. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt mariadb-dump mit --single-transaction, --routines und --triggers im laufenden Container aus und streamt den Dump direkt in restic — die Live-Ausgabe verfolgen Sie Zeile für Zeile im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein MariaDB-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile ist ein vollständiger Zeitpunkt-Dump aller Datenbanken des Servers — Schemata, Daten, Routinen und Trigger — plus der im selben Lauf erfassten Projektdateien.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung — eine bewusste Aktion mit getippter Bestätigung. Dump und Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Laden Sie den Dump in einen MariaDB-Testcontainer, führen Sie SHOW DATABASES über den mariadb-Client aus, um alle Schemata zu bestätigen, und prüfen Sie stichprobenartig die Tabellen Ihrer App. Zeilenzahlen und jüngste Datensätze sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die wiederhergestellten Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: Lassen Sie den wöchentlichen Restore-Drill diesen Beweis automatisch erbringen.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der manuelle Dump scheitert mit „mariadb-dump: command not found".',
      cause: 'Ältere MariaDB-Images (10.4 und früher) liefern nur das mysqldump-Binary; mariadb-dump kam später, mysqldump blieb auf neuen Images als Kompatibilitäts-Symlink.',
      fix: 'Nutzen Sie auf älteren Images mysqldump mit denselben Flags — die Ausgabe ist identisch. Dockstash erkennt, welches Binary das Image liefert, und ruft automatisch das richtige auf.',
    },
    {
      symptom: 'Der Dump scheitert mit „Access denied for user \'root\'@\'localhost\'".',
      cause: 'Der Root-Passwort-Env-Key im Compose (MARIADB_ROOT_PASSWORD oder das ältere MYSQL_ROOT_PASSWORD) passt nicht mehr zum Passwort im Daten-Volume — die Variable setzt das Passwort nur bei der Erstinitialisierung.',
      fix: 'Verwenden Sie das Initialisierungs-Passwort des Volumes oder setzen Sie das Root-Passwort im Container zurück, und richten Sie dann die Compose-Env aus.',
    },
    {
      symptom: 'Der Restore des Dumps in einen MySQL-Container scheitert an Syntaxfehlern.',
      cause: 'MariaDB und MySQL haben sich auseinanderentwickelt — MariaDB-Features wie Sequenzen, bestimmte Kollationen und Storage-Optionen existieren in MySQL nicht; ein Cross-Engine-Restore kann brechen.',
      fix: 'Stellen Sie in ein MariaDB-Image derselben Hauptversion wieder her, aus der der Dump stammt. Eine MariaDB-→-MySQL-Migration nur bewusst und nach Bereinigung des Dumps angehen.',
    },
    {
      symptom: 'Ein Backup-Lauf scheitert nach Crash oder Neustart an einem veralteten restic-Lock.',
      cause: 'Ein früherer Job starb mitten im Lauf und hinterließ das Repository gesperrt.',
      fix: 'Nichts manuell zu tun: Der nächste Lauf erkennt den verwaisten Lock und führt automatisch restic unlock aus. Scheitern Läufe weiterhin, prüfen Sie das Live-Log-Panel.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden Verzeichnis /var/lib/mysql aus — eine InnoDB-Kopie mitten im Schreibvorgang ist nicht wiederherstellbar.',
    'Neuere Images liefern mariadb-dump; ältere nutzen mysqldump. Dockstash erkennt, welches Binary das Image bereitstellt.',
    'MariaDB akzeptiert MARIADB_ROOT_PASSWORD oder den älteren Key MYSQL_ROOT_PASSWORD — beide werden erkannt.',
  ],
  faq: [
    {
      question: 'Wird MariaDB genauso gesichert wie MySQL?',
      answer:
        'Fast identisch. Beide nutzen --single-transaction für einen konsistenten InnoDB-Schnappschuss. Der Unterschied ist das Client-Binary: Neuere MariaDB-Images liefern mariadb-dump (mysqldump ist ein Kompatibilitäts-Symlink). Dockstash wählt das richtige.',
    },
    {
      question: 'Welchen Root-Passwort-Env-Key erkennt Dockstash?',
      answer:
        'Sowohl MARIADB_ROOT_PASSWORD als auch das ältere MYSQL_ROOT_PASSWORD werden erkannt, da MariaDB-Images je nach Version beide akzeptieren.',
    },
    {
      question: 'Kann ich einen MariaDB-Dump in MySQL wiederherstellen oder umgekehrt?',
      answer:
        'Oft, aber nicht immer — Feature- und Syntax-Drift zwischen beiden bricht Randfälle. Stellen Sie für ein zuverlässiges Ergebnis in dieselbe Engine-Familie wieder her, aus der der Dump stammt.',
    },
    {
      question: 'Warum nicht einfach das Volume snapshotten?',
      answer:
        'Das Volume /var/lib/mysql wird kontinuierlich beschrieben. Ein Snapshot mitten im Schreibvorgang ist inkonsistent. Der logische Dump per mariadb-dump ist der wiederherstellbare Weg.',
    },
    {
      question: 'Wie oft sollte ich MariaDB sichern?',
      answer:
        'Täglich ist der praktikable Standard; stündlich, wenn der Verlust eines Tages an Schreibzugriffen inakzeptabel ist. Im Free-Tarif sind Backups nur manuell; Pro erlaubt Zeitpläne bis stündlich, Business jeden Cron. Kombinieren Sie den Zeitplan mit einem wöchentlichen Restore-Drill.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft den Dump — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
