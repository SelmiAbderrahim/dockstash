// Deutsche Texte für den InfluxDB-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.influxdb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const INFLUXDB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit InfluxDB hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem InfluxDB-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass InfluxDB erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das influxdb-Image samt Hauptversion und fügt eine Datenbank-Ebene mit dem richtigen Backup-Befehl hinzu — influx backup für v2, influxd backup -portable für v1 — samt aufgelöstem Containernamen und den gefundenen Env-Keys (DOCKER_INFLUXDB_INIT_USERNAME, DOCKER_INFLUXDB_INIT_PASSWORD, DOCKER_INFLUXDB_INIT_ORG). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: den Backup-Befehl von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie influx backup in einen temporären Pfad im Container aus. Sie sehen, wie es Shard- und Metadaten-Dateien schreibt, während es jeden Bucket über die HTTP-API snapshottet — genau dieser Engine-koordinierte Schnappschuss wird gesichert, nie das laufende TSM-Verzeichnis.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Zeitreihendaten sammeln sich schnell — täglich ist der richtige Standard, stündlich bei geschäftskritischen Metriken. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt den versionsrichtigen Backup-Befehl im Container aus — influx backup über die HTTP-API bei v2, influxd backup -portable bei v1 — und streamt den Schnappschuss direkt in restic. Die Live-Ausgabe verfolgen Sie im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein InfluxDB-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre laufenden Zeitreihendaten standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Buckets und befördern bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile ist ein konsistenter Engine-Schnappschuss Ihrer TSM-Shards und Metadaten — Buckets, Retention-Policies und Benutzer — plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Die Backup-Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Laden Sie das Backup mit influx restore (v1: influxd restore -portable) in einen InfluxDB-Testcontainer und listen Sie die Buckets. Jeder erwartete Bucket muss mit seiner Retention-Policy erscheinen; eine schnelle Abfrage über einen jüngsten Zeitraum bestätigt, dass die neuesten Punkte drin sind.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Backup-Befehl scheitert mit „unknown command" oder unbekannten Flags.',
      cause: 'Die Kommandozeilen von v1 und v2 sind völlig verschieden: v2 nutzt influx backup gegen die HTTP-API, v1 nutzt influxd backup -portable. Der Befehl der einen Generation scheitert gegen die andere sofort — häufig nach einem Upgrade des Image-Tags.',
      fix: 'Prüfen Sie die Hauptversion des Containers (influxd version) und nutzen Sie den passenden Befehl. Dockstash erkennt die Hauptversion am Image und wählt automatisch richtig; nach einem Upgrade die Erkennung im Plan-Tab neu laufen lassen.',
    },
    {
      symptom: 'influx backup scheitert mit „unauthorized" oder einem 401 der API.',
      cause: 'v2-Backups laufen über die HTTP-API und brauchen ein Operator-Token (all-access). Ein normales Lese-Token — oder gar keins bei aktivierter Auth — reicht nicht.',
      fix: 'Ein Operator-Token mit Lesezugriff auf die Buckets bereitstellen. Mit den DOCKER_INFLUXDB_INIT_*-Variablen funktioniert das Init-Admin-Token; sonst eins mit influx auth create --all-access anlegen und in die Plan-Zugangsdaten aufnehmen.',
    },
    {
      symptom: 'Ein durch Kopieren von /var/lib/influxdb2 erstelltes Backup startet nicht, oder Abfragen liefern Teil-Daten.',
      cause: 'InfluxDB kompaktiert TSM-Shards im Hintergrund. Eine rohe Kopie des laufenden Verzeichnisses erwischt Shards mitten in der Kompaktierung — einige Dateien von davor, andere von danach — und erzeugt einen zerrissenen, inkonsistenten Store.',
      fix: 'Nie das laufende Datenverzeichnis kopieren. Nutzen Sie den Backup-Befehl der Engine, der Shards und Metadaten konsistent snapshottet — genau das führt Dockstash aus. Eine zerrissene Roh-Kopie ist meist nicht mehr zu retten; aus einem echten Backup wiederherstellen.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden TSM/WAL-Verzeichnis aus — Shards werden im Hintergrund kompaktiert, eine rohe Kopie ist inkonsistent.',
    'InfluxDB v2 nutzt `influx backup` (HTTP-API + Token); v1 nutzt `influxd backup -portable`. Dockstash erkennt die Hauptversion.',
    'v2-Backups brauchen ein Operator-Token mit Lesezugriff; ohne ist der Backup-Aufruf unautorisiert.',
  ],
  faq: [
    {
      question: 'Welcher Befehl sichert InfluxDB korrekt?',
      answer:
        'Für v2: `influx backup` gegen die HTTP-API mit Operator-Token. Für v1: `influxd backup -portable`. Beide snapshotten TSM-Shards und Metadaten konsistent. Dockstash erkennt die Version und führt den richtigen aus.',
    },
    {
      question: 'Kann ich die Shard-Dateien direkt kopieren?',
      answer:
        'Nein. InfluxDB kompaktiert TSM-Shards im Hintergrund; eine Kopie des laufenden Verzeichnisses ist inkonsistent. Nutzen Sie den Backup-Befehl, der über die Engine einen konsistenten Schnappschuss koordiniert.',
    },
    {
      question: 'Welches Token braucht das v2-Backup?',
      answer:
        'Ein Operator-Token (all-access) mit Leserecht auf die Buckets. Dockstash erkennt die Init-Token-Env-Keys; bei aktivierter Auth ein Token bereitstellen.',
    },
    {
      question: 'Wie stelle ich ein Zeitreihen-Backup wieder her?',
      answer:
        'Mit `influx restore` (v2) oder `influxd restore -portable` (v1) gegen eine frische Instanz. Dockstash stellt vor jedem Überschreiben zuerst in eine Staging-Instanz wieder her.',
    },
    {
      question: 'Wie oft sollte ich InfluxDB sichern?',
      answer:
        'Täglich reicht für die meisten Metrik-Workloads; stündlich, wenn eine verlorene Stunde an Punkten schmerzt. Im Free-Tarif sind Backups manuell (Backup Now); Pro ergänzt Zeitpläne bis stündlich, Business erlaubt jeden Cron-Ausdruck. Kombinieren Sie den Zeitplan mit einem wöchentlichen Restore-Drill.',
    },
    {
      question: 'Blockiert das Backup Schreibzugriffe auf InfluxDB?',
      answer:
        'Nein. Der Backup-Befehl snapshottet Shards über die Engine, während der Server weiter Schreibzugriffe annimmt — Ihre Collector und Dashboards laufen während des Backups weiter.',
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
