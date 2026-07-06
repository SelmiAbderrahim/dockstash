// Deutsche Texte für den Redis-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.redis walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const REDIS_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit Redis hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem Redis-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass Redis erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das redis-Image und fügt eine Datenbank-Ebene mit der richtigen Save-und-Capture-Strategie hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (REDIS_PASSWORD, REDIS_ARGS). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Snapshot von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, lösen Sie dasselbe Save aus wie Dockstash: redis-cli BGSAVE im Container. Redis antwortet „Background saving started", forkt und schreibt eine zeitpunktgenaue dump.rdb nach /data. Diese fertige RDB-Datei — nie der laufende In-Memory-Zustand — wird gesichert.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Für Redis als Primärspeicher (Queues, Sessions) ist täglich die vernünftige Untergrenze, stündlich üblich. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
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
      'Ein Redis-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Instanz standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Daten und befördern sie bewusst.',
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
        body: 'Legen Sie die wiederhergestellte dump.rdb ins Datenverzeichnis eines Redis-Testcontainers und starten Sie ihn — Redis lädt die RDB beim Start. redis-cli PING muss PONG liefern; prüfen Sie dann die Keys Ihrer App mit DBSIZE und ein paar GETs.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in — und starten den Live-Container neu, damit er die wiederhergestellte RDB lädt). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Die wiederhergestellte dump.rdb lädt nicht: „Short read or OOM loading DB" oder Fehler wegen abgeschnittener Datei.',
      cause: 'Die RDB wurde kopiert, während Redis sie noch neu schrieb — ein Zugriff mitten im Rewrite liefert eine unvollständige Datei.',
      fix: 'Immer SAVE oder BGSAVE auslösen und das Ende abwarten, bevor dump.rdb erfasst wird. Genau das tut Dockstash: Save auslösen, Abschluss abwarten, fertige Datei sichern.',
    },
    {
      symptom: 'Ein Restore gelingt, aber die jüngsten Schreibzugriffe fehlen.',
      cause: 'AOF-Persistenz ist aktiv, und appendonly.aof enthielt neuere Schreibzugriffe als der RDB-Schnappschuss — die RDB allein hinkt hinterher.',
      fix: 'Beide Dateien sichern. Dockstash erfasst /data/dump.rdb und appendonly.aof im selben Lauf, damit der Wiederherstellungspunkt die frischesten Schreibzugriffe enthält.',
    },
    {
      symptom: 'Die wiederhergestellte dump.rdb liegt in /data, aber der laufende Redis liefert weiter alte Daten.',
      cause: 'Redis liest die RDB nur beim Start — ein Hot-Swap in eine laufende Instanz ist unmöglich. Und mit aktiviertem appendonly lädt Redis beim Start die AOF und ignoriert die RDB komplett.',
      fix: 'Container stoppen, wiederhergestellte dump.rdb (und ggf. AOF) ins Datenverzeichnis legen, neu starten. Wurde nur eine RDB in ein AOF-Setup restauriert: für den ersten Start vorübergehend appendonly no setzen, danach wieder aktivieren.',
    },
    {
      symptom: 'BGSAVE scheitert mit „Can\'t save in background: fork: Cannot allocate memory".',
      cause: 'Der für das Hintergrund-Save nötige Fork wurde von den Memory-Overcommit-Heuristiken des Kernels abgelehnt — auf einem Host mit großem Redis-Datensatz.',
      fix: 'vm.overcommit_memory=1 auf dem Docker-Host setzen (sysctl) — die Einstellung, die Redis selbst beim Start empfiehlt. Der Fork nutzt Copy-on-Write und braucht keine vollständige zweite Kopie des Datensatzes.',
    },
  ],
  gotchas: [
    'Eine dump.rdb mitten im Rewrite zu kopieren liefert eine abgeschnittene Datei; erst SAVE (oder BGSAVE) auslösen, dann die fertige RDB sichern.',
    'Ist AOF-Persistenz aktiv, sichern Sie auch die appendonly.aof-Datei(en) — die RDB allein kann hinter den neuesten Schreibzugriffen zurückliegen.',
    'Ein Redis-Restore verlangt einen gestoppten oder neu gestarteten Server, um die RDB zu laden; ein Hot-Swap der dump.rdb in eine laufende Instanz ist unmöglich.',
  ],
  faq: [
    {
      question: 'Lohnt es sich überhaupt, Redis zu sichern?',
      answer:
        'Kommt auf die Nutzung an. Als reiner Cache füllt sich ein verlorener Redis von selbst wieder. Als Primärspeicher (Queues, Sessions, Sorted-Set-Daten): ja — RDB sichern, plus AOF, falls aktiviert.',
    },
    {
      question: 'SAVE oder BGSAVE — was nutzt Dockstash?',
      answer:
        'BGSAVE forkt und snapshottet im Hintergrund ohne zu blockieren; SAVE blockiert bis zum Ende. Dockstash bevorzugt das Hintergrund-Save und sichert dann die fertige dump.rdb.',
    },
    {
      question: 'Was ist mit AOF (Append-Only File)?',
      answer:
        'Ist appendonly aktiv, enthält die AOF die jüngsten Schreibzugriffe, die die RDB womöglich noch nicht widerspiegelt. Dockstash erfasst /data/dump.rdb und appendonly.aof, damit keine frischen Daten verloren gehen.',
    },
    {
      question: 'Kann ich dump.rdb kopieren, während Redis läuft?',
      answer:
        'Nur nach abgeschlossenem SAVE/BGSAVE. Wer während eines Rewrites kopiert, erwischt womöglich eine Teil-Datei. Dockstash löst das Save aus und wartet auf den Abschluss.',
    },
    {
      question: 'Wie oft sollte ich Redis sichern?',
      answer:
        'Richten Sie den Zeitplan am Inhalt aus. Für Queues und Sessions ist stündlich üblich; für träge Daten reicht täglich. Im Free-Tarif sind Backups manuell (Backup Now); Pro erlaubt Zeitpläne bis stündlich, Business jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich, dass ein Redis-Backup wirklich wiederherstellt?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und verifiziert den erfassten Dump — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
