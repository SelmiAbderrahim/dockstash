// Deutsche Texte für den ClickHouse-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.clickhouse walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const CLICKHOUSE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit ClickHouse hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem ClickHouse-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass ClickHouse erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das clickhouse/clickhouse-server-Image und fügt eine Datenbank-Ebene mit dem richtigen Backup-Befehl hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DB). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: den Server von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie clickhouse-client mit SHOW DATABASES im Container aus. Sie sollten Ihre Datenbanken gelistet sehen (default, system und alle Ihrer App) — genau sie snapshottet die native BACKUP DATABASE-Anweisung als konsistente Tabellen-Parts.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten Analytics-Workloads der richtige Standard — ClickHouse-Daten kommen meist in Schüben, stündlich bringt selten viel. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt die native BACKUP DATABASE-Anweisung im Container aus, erzeugt einen konsistenten Schnappschuss der Tabellen-Parts und übergibt das Ergebnis an restic — die Live-Ausgabe verfolgen Sie im Log-Panel. Der erste Lauf auf einer großen MergeTree-Tabelle kann dauern; spätere Läufe deduplizieren dagegen.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein ClickHouse-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile ist ein konsistentes BACKUP Ihrer ClickHouse-Datenbank — eingefrorene Tabellen-Parts, keine zerrissene Datei-Kopie — plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Das Backup landet im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Führen Sie RESTORE DATABASE in einem ClickHouse-Testcontainer aus und fragen Sie ihn ab: SELECT count() FROM system.tables bestätigt die Tabellen, und ein count() auf Ihrer größten MergeTree-Tabelle gegen die Produktion ist der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'BACKUP DATABASE scheitert mit einem Fehler über eine unbekannte oder fehlende Disk.',
      cause: 'Die native BACKUP-Anweisung schreibt auf eine benannte Backup-Disk, und in der Server-Konfiguration ist keine deklariert.',
      fix: 'Ergänzen Sie eine backups-Disk unter <storage_configuration> (oder einen <backups>-Allowed-Disk-Eintrag) in der ClickHouse-Config und starten Sie neu — oder wechseln Sie zum Tool clickhouse-backup, das Parts per Hardlink einfriert und keine konfigurierte Disk braucht.',
    },
    {
      symptom: 'Eine rohe Kopie von /var/lib/clickhouse ergibt beim Restore einen Server mit kaputten oder fehlenden Parts.',
      cause: 'ClickHouse merged und mutiert Tabellen-Parts kontinuierlich im Hintergrund; eine Datei-Kopie während laufender Merges erfasst Verzeichnisse mitten im Rewrite.',
      fix: 'Nie das laufende Datenverzeichnis kopieren. Nutzen Sie BACKUP DATABASE oder clickhouse-backup — beide frieren zuerst einen konsistenten Part-Satz ein — und lassen Sie Dockstash diese Ausgabe an restic übergeben.',
    },
    {
      symptom: 'Das erste Backup ist riesig und dauert weit länger als erwartet.',
      cause: 'Bei großen MergeTree-Tabellen materialisiert das initiale BACKUP jeden Part einmal; einen kleineren Startpunkt gibt es nicht.',
      fix: 'Lassen Sie den ersten Lauf durchlaufen — restic-Deduplizierung und der Inkrementalmodus der BACKUP-Anweisung halten alle Folgeläufe klein. Verfolgen Sie den Fortschritt im Log-Panel und den Größentrend auf der Projektkarte.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden Verzeichnis /var/lib/clickhouse/store aus — Parts werden im Hintergrund gemerged und mutiert, eine rohe Kopie ist inkonsistent.',
    'Das BACKUP/RESTORE-SQL erfordert eine konfigurierte Backup-Disk in der Server-Config; ohne sie nutzen Sie das Tool clickhouse-backup, das Parts per Hardlink einfriert.',
    'Große MergeTree-Tabellen erzeugen große Backups; inkrementelle restic-Deduplizierung hilft, doch das initiale BACKUP kann beträchtlich sein.',
  ],
  faq: [
    {
      question: 'Wie sichert man ClickHouse korrekt?',
      answer:
        'Mit der nativen BACKUP-Anweisung (BACKUP DATABASE ... TO Disk(...)) oder dem Tool clickhouse-backup. Beide erzeugen einen konsistenten Schnappschuss der Tabellen-Parts. Dockstash übergibt das entstehende Backup-Verzeichnis an restic.',
    },
    {
      question: 'Kann ich stattdessen /var/lib/clickhouse kopieren?',
      answer:
        'Nein. ClickHouse merged und mutiert Parts kontinuierlich im Hintergrund; eine Kopie des laufenden Verzeichnisses ist inkonsistent. BACKUP-Anweisung oder clickhouse-backup frieren die Parts sicher ein.',
    },
    {
      question: 'BACKUP-Anweisung oder clickhouse-backup — was nehmen?',
      answer:
        'Die native BACKUP-Anweisung ist am einfachsten, wenn eine Backup-Disk konfiguriert ist. clickhouse-backup ist praktisch, um Parts per Hardlink einzufrieren und zu verschicken, besonders auf älteren Versionen. Dockstash unterstützt beide Ausgaben.',
    },
    {
      question: 'Sind ClickHouse-Backups inkrementell?',
      answer:
        'Die BACKUP-Anweisung unterstützt inkrementelle Backups gegen eine Basis, und restic legt seine eigene Deduplizierung obendrauf — wiederholte Snapshots bleiben kompakt.',
    },
    {
      question: 'Wie oft sollte ich ClickHouse sichern?',
      answer:
        'Täglich ist der praktikable Standard — Analytics-Daten kommen in Schüben, und restic-Dedup macht tägliche Snapshots günstig. Im Free-Tarif sind Backups manuell (Backup Now); Pro schaltet Zeitpläne bis stündlich frei, Business erlaubt jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft die wiederhergestellte Ausgabe — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
