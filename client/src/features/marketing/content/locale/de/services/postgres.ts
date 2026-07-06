// Deutsche Texte für den PostgreSQL-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.postgres walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const POSTGRES_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit PostgreSQL hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem PostgreSQL-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass PostgreSQL erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das postgres-Image und fügt eine Datenbank-Ebene mit dem richtigen Dump-Befehl hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Dump von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie denselben Dump aus, den Dockstash ausführen wird. Sie sollten SQL-Anweisungen vorbeiströmen sehen — genau diese Ausgabe wird gesichert, niemals das laufende Datenverzeichnis.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten PostgreSQL-Projekte der richtige Standard. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie, damit alte Snapshots automatisch beschnitten werden.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt pg_dumpall im laufenden Container aus und streamt den Dump direkt in restic — die Live-Ausgabe von restic können Sie Zeile für Zeile im Log-Panel verfolgen.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein PostgreSQL-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste der Wiederherstellungspunkte. Jede Zeile ist ein vollständiger, konsistenter Dump aller Datenbanken des Clusters plus der im selben Lauf erfassten Projektdateien.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung — eine bewusste Aktion mit getippter Bestätigung. Dump und Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Laden Sie den wiederhergestellten Dump mit psql in einen PostgreSQL-Testcontainer, listen Sie die Datenbanken auf und prüfen Sie stichprobenartig die Tabellen, von denen Ihre App abhängt. Zeilenzahlen und jüngste Datensätze sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die wiederhergestellten Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: Lassen Sie den wöchentlichen Restore-Drill diesen Beweis automatisch erbringen, damit ein Restore nie Ihre erste Probe ist.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Dump scheitert mit „role does not exist" oder Authentifizierungsfehlern.',
      cause: 'Der POSTGRES_USER-Wert im Compose entspricht keiner echten Rolle in der Datenbank mehr — häufig nach manueller Rollenumbenennung oder einem aus einem anderen Projekt wiederhergestellten Volume.',
      fix: 'Führen Sie psql im Container aus, prüfen Sie mit \\du die realen Rollen und richten Sie die Compose-Env (oder die Dump-Zugangsdaten des Plans) auf eine existierende Superuser-Rolle aus.',
    },
    {
      symptom: 'Das wiederhergestellte SQL scheitert mit „extension ... is not available".',
      cause: 'Der Dump referenziert CREATE EXTENSION (PostGIS, pgvector, …), aber das Restore-Ziel-Image liefert diese Extension-Binärdateien nicht mit.',
      fix: 'Stellen Sie in dasselbe Image wieder her, das Ihr Produktions-Service nutzt (z. B. postgis/postgis- oder pgvector-Builds), nicht in ein Vanilla-postgres-Image.',
    },
    {
      symptom: 'Backups dauern plötzlich viel länger oder das Repository wächst schnell.',
      cause: 'Die Ausgabe von pg_dumpall ändert sich im Block, wenn große Tabellen stark schreiben — das verringert die restic-Deduplizierung.',
      fix: 'Behalten Sie den täglichen Zeitplan und lassen Sie Prune + Retention die Historie beschneiden; bei sehr großen Clustern prüfen Sie am Größentrend der Projektkarte, dass die Aufbewahrung (keep daily/weekly/monthly) tatsächlich greift.',
    },
    {
      symptom: 'Ein Backup-Lauf scheitert nach Crash oder Neustart an einem veralteten restic-Lock.',
      cause: 'Ein früherer Job starb mitten im Lauf und hinterließ das Repository gesperrt.',
      fix: 'Nichts manuell zu tun: Der nächste Lauf erkennt den verwaisten Lock und führt automatisch restic unlock aus, bevor er fortfährt. Scheitern Läufe weiterhin, prüfen Sie das Live-Log-Panel auf den eigentlichen Fehler.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf dem laufenden Verzeichnis /var/lib/postgresql/data aus — eine mitten im Schreibvorgang kopierte Heap-Page ist zerrissen und nicht wiederherstellbar.',
    'pg_dumpall erfasst Rollen und alle Datenbanken; ein einzelnes pg_dump verpasst globale Objekte wie Rollen und Tablespaces.',
    'Extensions (PostGIS, pgvector) müssen vor dem Restore im Ziel-Image installiert sein, sonst schlägt das SQL fehl.',
  ],
  faq: [
    {
      question: 'Warum pg_dumpall statt das Datenverzeichnis zu kopieren?',
      answer:
        'Ein laufendes Postgres-Datenverzeichnis wird ständig beschrieben. Eine Kopie erfasst einen zerrissenen, inkonsistenten Zustand, der nicht startet. pg_dumpall liest einen konsistenten MVCC-Schnappschuss vom laufenden Server und erzeugt einen sauber wiederherstellbaren Dump.',
    },
    {
      question: 'Sperrt Dockstash die Datenbank während des Backups?',
      answer:
        'Nein. pg_dumpall nutzt MVCC-Schnappschüsse: Lesezugriffe sind konsistent, ohne Schreibzugriffe zu blockieren. Ihre Anwendung bedient während des Dumps weiter den Traffic.',
    },
    {
      question: 'Wie oft sollte ich PostgreSQL sichern?',
      answer:
        'Täglich ist der praktikable Standard; stündlich, wenn der Verlust eines Tages an Schreibzugriffen inakzeptabel ist (Pro erlaubt stündlich, Business jeden Cron). Kombinieren Sie den Zeitplan mit einem wöchentlichen Restore-Drill, damit Sie jede Woche den Beweis bekommen, dass das Backup wirklich wiederherstellt.',
    },
    {
      question: 'Wie stelle ich eine einzelne Datenbank statt aller wieder her?',
      answer:
        'Ein pg_dumpall-Archiv ist reines SQL; Sie können den ganzen Cluster mit psql wiederherstellen oder pro Datenbank pg_dump/pg_restore nutzen. Dockstash stellt standardmäßig den vollständigen konsistenten Schnappschuss wieder her.',
    },
    {
      question: 'Was ist mit Extensions wie PostGIS oder pgvector?',
      answer:
        'Der Dump referenziert CREATE EXTENSION, liefert die Binärdateien aber nicht mit. Stellen Sie sicher, dass das Restore-Ziel-Image dieselben Extensions bereitstellt, bevor Sie wiederherstellen.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft den wiederhergestellten Dump zeilenweise — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
