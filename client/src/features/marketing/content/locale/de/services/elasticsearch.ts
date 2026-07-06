// Deutsche Texte für den Elasticsearch-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.elasticsearch walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const ELASTICSEARCH_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit Elasticsearch hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem Elasticsearch-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass Elasticsearch erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das elasticsearch-Image und fügt eine auf der Snapshot-API aufbauende Datenbank-Ebene hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (ELASTIC_PASSWORD, ELASTICSEARCH_USERNAME, discovery.type). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: den Cluster von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, curlen Sie im Container den Endpoint _cluster/health. Status green oder yellow heißt: bereit zum Snapshotten (yellow ist auf einem Einzelknoten normal — Replica-Shards haben kein Ziel). Red bedeutet, mindestens ein Primary-Shard ist weg; das zuerst beheben.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, per SSH übertragen. Nach dem Assistenten ist das konfiguriert; änderbar unter Settings → Storage. Elasticsearch selbst braucht zusätzlich ein registriertes Snapshot-Repository — einen Filesystem-Pfad (am einfachsten ein bind-gemountetes Verzeichnis) oder einen Object Store —, in das die Snapshot-API schreibt und das Dockstash off-site an restic übergibt.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich ist für die meisten Suchcluster der richtige Standard — Snapshots sind im Repository inkrementell, jeder Lauf speichert nur neue Segmente. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash stößt über die Snapshot-API (PUT _snapshot/<repo>/<snap>) einen Snapshot an: Elasticsearch schreibt eine konsistente Zeitpunkt-Sicht jedes Index ins Repository, das Dockstash anschließend an restic übergibt — die Live-Ausgabe verfolgen Sie im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein Elasticsearch-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihren Live-Cluster standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Indizes und befördern bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile enthält das Snapshot-Repository mit einer konsistenten Zeitpunkt-Sicht jedes Index plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Das Repository landet im gewählten Zielpfad; der Live-Cluster bleibt unberührt. Registrieren Sie es in einem Elasticsearch-Testcontainer und POSTen Sie _snapshot/<repo>/<snap>/_restore.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Curlen Sie _cat/indices?v gegen den Testknoten und lesen Sie die Tabelle: Jeder erwartete Index sollte mit Health green oder yellow, Status open und einem docs.count wie in Produktion erscheinen. Prüfen Sie ein paar Dokumente per Suchanfrage.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Indizes stimmen, richten Sie Ihre App auf den Testcluster aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Snapshot-Aufrufe scheitern mit repository_missing_exception oder einem Verifizierungsfehler des Repositorys.',
      cause: 'Kein Snapshot-Repository registriert, oder der Pfad steht nicht in path.repo bzw. ist aus dem Container heraus nicht beschreibbar.',
      fix: 'Verzeichnis in den Container bind-mounten, in elasticsearch.yml zu path.repo hinzufügen, neu starten und mit PUT _snapshot/<repo> als fs-Repository registrieren. Snapshots funktionieren nur gegen ein registriertes, verifiziertes Repository.',
    },
    {
      symptom: 'Der Restore wird abgelehnt: „cannot restore index ... because an open index with same name already exists".',
      cause: 'Die Snapshot-API weigert sich, in einen offenen Index wiederherzustellen — sie merged oder überschreibt Live-Daten nie stillschweigend.',
      fix: 'Bestehenden Index zuerst schließen oder löschen, oder mit rename_pattern/rename_replacement unter anderem Namen wiederherstellen. Ein Restore in einen Testknoten umgeht die Kollision komplett.',
    },
    {
      symptom: 'Die Cluster-Health ist red und Snapshots kommen partial zurück oder scheitern.',
      cause: 'Mindestens ein Primary-Shard ist nicht zugewiesen; ein Snapshot kann keine nicht verfügbaren Shards erfassen.',
      fix: 'Mit _cluster/allocation/explain diagnostizieren und die Primaries zurückbringen (Disk-Watermark, Knoten weg, korrupter Shard), bevor Sie sichern. Ein gelber Einzelknoten-Cluster ist okay; red nicht.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden Datenverzeichnis aus — Lucene-Segmente werden kontinuierlich geschrieben und gemerged, eine Datei-Kopie ist inkonsistent.',
    'Vor dem ersten Snapshot muss ein Snapshot-Repository registriert sein (geteilter fs-Pfad oder Object Store); ein bind-gemounteter, mit dem Container geteilter Pfad ist das einfachste fs-Repo.',
    'Einen bereits existierenden Index wiederherzustellen verlangt, ihn zuerst zu schließen oder zu löschen — sonst wird der Restore abgelehnt.',
  ],
  faq: [
    {
      question: 'Warum die Snapshot-API statt den Datenordner zu kopieren?',
      answer:
        'Elasticsearch schreibt und merged Lucene-Segmente permanent; eine Kopie des laufenden Verzeichnisses ist inkonsistent und öffnet womöglich nicht. Die Snapshot-API erfasst eine konsistente, inkrementelle Zeitpunkt-Sicht jedes Index.',
    },
    {
      question: 'Wie registriere ich ein Snapshot-Repository?',
      answer:
        'Konfigurieren Sie ein Filesystem-Repository auf einem Pfad, den Elasticsearch und Dockstash lesen können (oder einen Object Store), und registrieren Sie es per PUT _snapshot. Dockstash übergibt dieses Repository-Verzeichnis an restic.',
    },
    {
      question: 'Sind Elasticsearch-Snapshots inkrementell?',
      answer:
        'Ja. Innerhalb eines Repositorys speichert jeder Snapshot nur Segmente, die noch nicht vorhanden sind — wiederholte Snapshots sind günstig. Die restic-Deduplizierung verstärkt das noch.',
    },
    {
      question: 'Funktioniert das auch für OpenSearch?',
      answer:
        'Ja — OpenSearch ist ein Elasticsearch-Fork mit demselben Snapshot-API-Modell. Repository registrieren und genauso snapshotten.',
    },
    {
      question: 'Wie oft sollte ich Elasticsearch sichern?',
      answer:
        'Täglich ist der praktikable Standard — Snapshots sind im Repository inkrementell, tägliche Läufe bleiben selbst bei großen Indizes günstig. Im Free-Tarif sind Backups manuell (Backup Now); Pro schaltet Zeitpläne bis stündlich frei, Business erlaubt jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft die wiederhergestellte Backup-Ausgabe — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
