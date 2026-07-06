// Deutsche Texte für den SQLite-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.sqlite walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const SQLITE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit eingebettetem SQLite hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt, dessen App ihre Daten in einer SQLite-Datei hält — PocketBase, Vaultwarden, Uptime Kuma, Gitea und Ghost tun das alle. Noch wird nichts gesichert.',
    },
    'review-detection': {
      title: 'Prüfen, dass SQLite erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. SQLite hat keinen eigenen Container — es lebt im Image Ihrer App —, deshalb findet Dockstash es über die Env-Keys, die auf die Datenbankdatei zeigen (DATABASE_PATH, DATABASE_URL, DB_PATH), und fügt eine Datenbank-Ebene hinzu, die sie über die Online-Backup-API snapshottet. Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: das Backup von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie denselben Befehl aus wie Dockstash: sqlite3 /data/app.db ".backup \'/tmp/app-backup.db\'" im App-Container. Er gibt bei Erfolg nichts aus und hinterlässt eine vollständige, konsistente Kopie unter /tmp/app-backup.db — WAL-Inhalte eingeschlossen. Diese Kopie wird gesichert, nie die laufende .db-Datei.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten SQLite-basierten Apps der richtige Standard. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt den .backup-Befehl im App-Container aus, erzeugt eine konsistente Kopie der Datenbank und streamt sie — zusammen mit den Projektdateien — in restic. Die Live-Ausgabe verfolgen Sie im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein SQLite-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile enthält eine konsistente Ein-Datei-Kopie der Datenbank — über die Online-Backup-API erzeugt, also ohne -wal- oder -shm-Sidecars zum Abgleichen — plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Datenbankkopie und Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Führen Sie sqlite3 <wiederhergestellte-datei> "PRAGMA integrity_check;" aus — eine gesunde Datenbank antwortet mit einem einzigen „ok". Öffnen Sie die Datei dann mit sqlite3 und prüfen Sie stichprobenartig die Tabellen Ihrer App: Zeilenzahlen und die jüngsten Datensätze sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Daten stimmen: App stoppen, Datenbankdatei durch die wiederhergestellte Kopie ersetzen, App neu starten (oder den Restore mit „Overwrite existing" wiederholen — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Die wiederhergestellte Datenbank öffnet sich, aber die jüngsten Zeilen fehlen.',
      cause: 'Das Backup war eine rohe Kopie nur der .db-Datei, während die App im WAL-Modus lief — die neuesten Schreibzugriffe saßen noch im -wal-Sidecar und haben die Kopie nie erreicht.',
      fix: 'Nie eine laufende WAL-Datenbank roh kopieren. Nutzen Sie sqlite3 ".backup" oder VACUUM INTO — beide gehen über die Online-Backup-API und falten die WAL in die Kopie. Genau deshalb nutzt Dockstash die Backup-API.',
    },
    {
      symptom: 'Der .backup-Befehl scheitert mit „database is locked".',
      cause: 'Eine langlaufende Schreibtransaktion (oder ein hängender Writer) hält die Datenbanksperre, und sqlite3 gab auf, bevor sie freikam.',
      fix: 'Setzen Sie ein Busy-Timeout (sqlite3 -cmd ".timeout 30000" oder PRAGMA busy_timeout), damit das Backup wartet statt zu scheitern, und planen Sie Backups in eine ruhige Stunde. Löst sich die Sperre nie, suchen Sie nach einem hängenden Writer-Prozess im App-Container.',
    },
    {
      symptom: 'PRAGMA integrity_check auf einer kopierten Datei meldet „database disk image is malformed".',
      cause: 'Die Datei wurde kopiert, während die App hineinschrieb — eine zerrissene Page-Erfassung, die kein Reparatur-Tool zuverlässig heilt.',
      fix: 'Verwerfen Sie die zerrissene Kopie und stellen Sie aus einem Snapshot wieder her, der über die Backup-API entstand. Jeder Dockstash-Snapshot wird mit ".backup" erzeugt: integrity_check muss „ok" antworten — genau das prüft der Verifikationsschritt.',
    },
    {
      symptom: 'Sie haben vor einer rohen Kopie PRAGMA wal_checkpoint(TRUNCATE) ausgeführt, doch die Kopie ist trotzdem inkonsistent.',
      cause: 'Ein Checkpoint faltet WAL-Pages zu einem Zeitpunkt in die Hauptdatei, aber Writer können sofort danach neue WAL-Frames anhängen — Checkpoint-dann-cp ist unter konkurrierenden Schreibzugriffen kein atomarer Schnappschuss.',
      fix: 'Betrachten Sie „Checkpoint, dann Kopie" als Irrtum, nicht als Technik. Der einzig sichere Live-Schnappschuss ist die Online-Backup-API (".backup" oder VACUUM INTO); rohe Kopien sind nur bei gestoppter App sicher.',
    },
  ],
  gotchas: [
    'Kopieren Sie nie eine laufende .db-Datei, während die App im WAL-Modus schreibt — Sie verpassen die -wal/-shm-Sidecars und erfassen eine zerrissene, nicht wiederherstellbare Datenbank.',
    'Nutzen Sie sqlite3 ".backup" oder „VACUUM INTO" — beide verwenden die Online-Backup-API und behandeln die WAL korrekt.',
    'Ein Checkpoint (PRAGMA wal_checkpoint(TRUNCATE)) vor einer rohen Kopie ersetzt die Backup-API unter konkurrierenden Schreibzugriffen nicht.',
  ],
  faq: [
    {
      question: 'Kann ich die .db-Datei nicht einfach kopieren?',
      answer:
        'Nicht sicher, solange die App schreibt. Im WAL-Modus liegen die neuesten Daten im -wal-Sidecar; ein schlichtes cp nur der .db erfasst einen veralteten, zerrissenen Zustand. Nutzen Sie sqlite3 ".backup" oder „VACUUM INTO", die über die Online-Backup-API eine konsistente Kopie lesen.',
    },
    {
      question: 'Was ist VACUUM INTO?',
      answer:
        "VACUUM INTO 'file.db' schreibt eine frische, defragmentierte, transaktional konsistente Kopie der Datenbank in eine neue Datei. Ein sauberer Weg, eine laufende SQLite-Datenbank zu snapshotten, ohne die App zu stoppen.",
    },
    {
      question: 'Muss ich die -wal- und -shm-Dateien sichern?',
      answer:
        'Mit der Backup-API nicht — sie konsolidiert die WAL in die Kopie. Bestehen Sie auf einer rohen Datei-Kopie (im Betrieb nicht empfohlen), müssen -wal und -shm mit — race-anfällig bleibt es trotzdem.',
    },
    {
      question: 'Wie stelle ich ein SQLite-Backup wieder her?',
      answer:
        'App stoppen, Datenbankdatei durch die .backup-Ausgabe ersetzen, App starten. Da das Backup eine einzige konsistente Datei ist, gibt es keine Sidecars abzugleichen.',
    },
    {
      question: 'Meine App bündelt SQLite (PocketBase, Vaultwarden, Uptime Kuma) — findet Dockstash sie?',
      answer:
        'Ja. Es gibt keinen separaten SQLite-Container zu entdecken: Dockstash liest Compose-Config und Env-Keys der App (DATABASE_PATH, DATABASE_URL, DB_PATH), lokalisiert die Datei und snapshottet sie über die Backup-API. Prüfen Sie den erkannten Pfad vor dem ersten Lauf im Plan-Tab.',
    },
    {
      question: 'Wie oft sollte ich SQLite sichern?',
      answer:
        'Täglich ist der praktikable Standard für die meisten Ein-Datei-Apps; stündlich, wenn der Verlust eines Tages an Schreibzugriffen inakzeptabel ist. Im Free-Tarif sind Backups manuell (Backup Now); Pro erlaubt Zeitpläne bis stündlich, Business jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft die wiederhergestellte Datenbank — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
