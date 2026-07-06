// Deutsche Texte für den Valkey-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.valkey walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const VALKEY_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit Valkey hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem Valkey-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass Valkey erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das valkey/valkey-Image und fügt eine Datenbank-Ebene mit der richtigen Save-und-Capture-Strategie hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (VALKEY_PASSWORD, VALKEY_ARGS und das ältere REDIS_PASSWORD). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Snapshot von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, lösen Sie dasselbe Save aus wie Dockstash: valkey-cli BGSAVE im Container. Valkey antwortet „Background saving started", forkt und schreibt eine zeitpunktgenaue dump.rdb nach /data — dieselbe von Redis geerbte RDB-Persistenz. Diese fertige Datei wird gesichert, nie der laufende In-Memory-Zustand.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Für Valkey als Primärspeicher (Queues, Sessions) ist täglich die vernünftige Untergrenze, stündlich üblich. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash löst ein Hintergrund-Save aus, wartet auf die fertige dump.rdb und sichert sie — zusammen mit appendonly.aof, wenn AOF-Persistenz aktiv ist — direkt in restic. Die Live-Ausgabe verfolgen Sie im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein Valkey-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Instanz standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile enthält eine vollständige zeitpunktgenaue dump.rdb (plus AOF, falls aktiviert) und die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. RDB und Dateien landen im gewählten Zielpfad; die Live-Instanz bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Legen Sie die wiederhergestellte dump.rdb ins Datenverzeichnis eines Valkey-Testcontainers und starten Sie ihn — Valkey lädt die RDB beim Start. valkey-cli PING muss PONG liefern; prüfen Sie dann die Keys Ihrer App mit DBSIZE und ein paar GETs.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in — und starten den Live-Container neu, damit er die wiederhergestellte RDB lädt). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Die wiederhergestellte dump.rdb lädt nicht: Fehler wegen abgeschnittener Datei oder Short-Read.',
      cause: 'Die RDB wurde kopiert, während Valkey sie noch neu schrieb — dieselbe Mid-Rewrite-Gefahr wie bei Redis, denn Valkey behält das identische RDB-Persistenzmodell.',
      fix: 'Immer SAVE oder BGSAVE auslösen und das Ende abwarten, bevor dump.rdb erfasst wird. Genau das tut Dockstash: Save auslösen, Abschluss abwarten, fertige Datei sichern.',
    },
    {
      symptom: 'Ein manueller Test mit redis-cli funktioniert, aber valkey-cli meldet „not found" (oder umgekehrt).',
      cause: 'Das Client-Binary variiert je nach Image: Offizielle valkey/valkey-Images liefern valkey-cli, manche Kompatibilitäts-Images verlinken stattdessen redis-cli.',
      fix: 'Nutzen Sie das Binary, das das Image liefert — Protokoll und Befehle sind identisch. Dockstash erkennt automatisch den vorhandenen Client, Backups funktionieren so oder so.',
    },
    {
      symptom: 'Die wiederhergestellte dump.rdb liegt in /data, aber der laufende Valkey liefert weiter alte Daten.',
      cause: 'Wie Redis liest Valkey die RDB nur beim Start — kein Hot-Swap in eine laufende Instanz. Und mit aktiviertem appendonly hat die AOF beim Start Vorrang, die RDB wird ignoriert.',
      fix: 'Container stoppen, wiederhergestellte dump.rdb (und ggf. AOF) ins Datenverzeichnis legen, neu starten. Wurde nur eine RDB in ein AOF-Setup restauriert: für den ersten Start vorübergehend appendonly no setzen, danach wieder aktivieren.',
    },
    {
      symptom: 'Ein Restore gelingt, aber die jüngsten Schreibzugriffe fehlen.',
      cause: 'AOF-Persistenz ist aktiv, und appendonly.aof enthielt neuere Schreibzugriffe als der RDB-Schnappschuss — die RDB allein hinkt hinterher.',
      fix: 'Beide Dateien sichern. Dockstash erfasst /data/dump.rdb und appendonly.aof im selben Lauf.',
    },
  ],
  gotchas: [
    'Wie bei Redis: nie eine dump.rdb mitten im Rewrite greifen — erst SAVE/BGSAVE auslösen und die fertige Datei sichern.',
    'valkey-cli ist das Client-Binary; auf manchen Kompatibilitäts-Images ist redis-cli verlinkt — Dockstash erkennt das vorhandene.',
    'Aktivieren und erfassen Sie die AOF, wenn Sie die frischesten Schreibzugriffe brauchen; die RDB allein kann zurückliegen.',
  ],
  faq: [
    {
      question: 'Wie unterscheidet sich das Valkey-Backup vom Redis-Backup?',
      answer:
        'Praktisch gar nicht. Valkey ist ein Redis-Fork und behält dasselbe RDB- und AOF-Persistenzmodell. Der einzige praktische Unterschied ist der Name des Client-Binarys (valkey-cli), den Dockstash automatisch erkennt.',
    },
    {
      question: 'Kann ich eine Redis-RDB in Valkey wiederherstellen?',
      answer:
        'Für aktuelle Versionen ja — das RDB-Format ist über den Fork-Punkt hinweg geteilt. Da die Projekte auseinanderdriften, bleiben Restores sicherheitshalber in derselben Engine.',
    },
    {
      question: 'Erkennt Dockstash Valkey automatisch?',
      answer:
        'Ja. Die valkey/valkey-Images und das valkey-cli-Binary werden erkannt, und sowohl VALKEY_PASSWORD als auch das ältere REDIS_PASSWORD werden aufgegriffen.',
    },
    {
      question: 'Sollte ich die AOF ebenfalls erfassen?',
      answer:
        'Wenn appendonly aktiv ist und Sie die letzten Sekunden an Schreibzugriffen nicht verlieren dürfen: ja. Dockstash sichert RDB- und AOF-Dateien.',
    },
    {
      question: 'Wie oft sollte ich Valkey sichern?',
      answer:
        'Richten Sie den Zeitplan am Inhalt aus. Für Queues und Sessions ist stündlich üblich; für träge Daten reicht täglich. Im Free-Tarif sind Backups manuell (Backup Now); Pro erlaubt Zeitpläne bis stündlich, Business jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich, dass ein Valkey-Backup wirklich wiederherstellt?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und verifiziert den erfassten Dump — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
