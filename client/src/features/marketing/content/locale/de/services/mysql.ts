// Deutsche Texte für den MySQL-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.mysql walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MYSQL_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit MySQL hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem MySQL-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass MySQL erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das mysql-Image und fügt eine Datenbank-Ebene mit dem richtigen Dump-Befehl hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Dump von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie denselben Dump aus, den Dockstash ausführen wird. Sie sollten SQL vorbeiströmen sehen — CREATE DATABASE-, CREATE TABLE- und INSERT-Anweisungen. Genau diese Ausgabe wird gesichert, niemals das laufende Verzeichnis /var/lib/mysql.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten MySQL-Projekte der richtige Standard. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt mysqldump mit --single-transaction, --routines und --triggers im laufenden Container aus und streamt den Dump direkt in restic — die Live-Ausgabe verfolgen Sie Zeile für Zeile im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein MySQL-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
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
        body: 'Laden Sie den Dump in einen MySQL-Testcontainer, führen Sie SHOW DATABASES aus, um alle Schemata zu bestätigen, und prüfen Sie stichprobenartig die Tabellen Ihrer App. Zeilenzahlen und jüngste Datensätze sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die wiederhergestellten Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: Lassen Sie den wöchentlichen Restore-Drill diesen Beweis automatisch erbringen.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Dump scheitert mit „Access denied for user \'root\'@\'localhost\'".',
      cause: 'Das MYSQL_ROOT_PASSWORD im Compose passt nicht mehr zum Passwort im Daten-Volume — die Env-Variable setzt das Passwort nur bei der Erstinitialisierung; eine spätere Änderung im Compose wirkt sich auf ein bestehendes Volume nicht aus.',
      fix: 'Verwenden Sie das Passwort, mit dem das Volume initialisiert wurde, oder setzen Sie das Root-Passwort im Container zurück, und richten Sie dann die Compose-Env aus, damit Erkennung und Dump übereinstimmen.',
    },
    {
      symptom: 'Der Dump läuft durch, aber manche Tabellen sind nach dem Restore inkonsistent.',
      cause: 'Diese Tabellen sind MyISAM. --single-transaction garantiert nur für transaktionale InnoDB-Tabellen einen konsistenten Schnappschuss; MyISAM-Tabellen werden außerhalb dieser Garantie gelesen.',
      fix: 'Prüfen Sie die Engine mit SHOW TABLE STATUS. Migrieren Sie MyISAM-Tabellen nach InnoDB (ALTER TABLE ... ENGINE=InnoDB) — der dauerhafte Fix — oder akzeptieren Sie eine kurze Sperre mit --lock-tables.',
    },
    {
      symptom: 'Der Restore in einen Testcontainer meldet „Unknown collation: utf8mb4_0900_ai_ci".',
      cause: 'Der Dump stammt aus MySQL 8.x, Sie stellen aber in ein 5.7-Image wieder her; die Standard-Kollationen von 8.0 existieren in älteren Servern nicht.',
      fix: 'Stellen Sie in dieselbe Hauptversion wieder her, aus der der Dump stammt (z. B. mysql:8). Ältere Dumps in neuere Server funktionieren; umgekehrt häufig nicht.',
    },
    {
      symptom: 'Ein Backup-Lauf scheitert nach Crash oder Neustart an einem veralteten restic-Lock.',
      cause: 'Ein früherer Job starb mitten im Lauf und hinterließ das Repository gesperrt.',
      fix: 'Nichts manuell zu tun: Der nächste Lauf erkennt den verwaisten Lock und führt automatisch restic unlock aus. Scheitern Läufe weiterhin, prüfen Sie das Live-Log-Panel.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden Verzeichnis /var/lib/mysql aus — mitten im Schreibvorgang kopierte InnoDB-Tablespaces sind inkonsistent und scheitern bei der Recovery.',
    '--single-transaction liefert nur für transaktionale (InnoDB-)Tabellen einen konsistenten Schnappschuss; MyISAM-Tabellen sind nicht abgedeckt und brauchen eine Sperre.',
    'Ergänzen Sie --routines und --triggers, sonst fehlen Stored Procedures und Trigger stillschweigend im Dump.',
  ],
  faq: [
    {
      question: 'Warum ist --single-transaction wichtig?',
      answer:
        'Ohne dieses Flag liest mysqldump Tabelle für Tabelle, und ein Schreibzugriff zwischen zwei Tabellen erzeugt einen inkonsistenten Dump. --single-transaction kapselt alles in einer InnoDB-Transaktion: Der gesamte Dump spiegelt einen einzigen Zeitpunkt, ohne Schreibsperre.',
    },
    {
      question: 'Enthält der Dump Stored Procedures und Trigger?',
      answer:
        'Nur mit --routines und --triggers, die Dockstash mitgibt. Ein Standard-mysqldump lässt sie weg — eine häufige Ursache für eine „wiederhergestellte, aber kaputte" Datenbank.',
    },
    {
      question: 'Kann ich MySQL durch Kopieren von /var/lib/mysql sichern?',
      answer:
        'Nein. Tablespace und Redo-Logs von InnoDB werden kontinuierlich geschrieben; eine Datei-Kopie mitten im Schreibvorgang ist inkonsistent. Dockstash führt stattdessen mysqldump im Container aus.',
    },
    {
      question: 'Was, wenn ich MyISAM-Tabellen nutze?',
      answer:
        '--single-transaction macht MyISAM nicht konsistent, weil die Engine nicht transaktional ist. Wer auf MyISAM angewiesen ist, braucht eine kurze Sperre (--lock-tables) — die Migration dieser Tabellen zu InnoDB ist der dauerhafte Fix.',
    },
    {
      question: 'Wie oft sollte ich MySQL sichern?',
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
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft den Dump zeilenweise — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
