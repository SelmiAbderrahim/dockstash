// Deutsche Texte für den Neo4j-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.neo4j walkthrough/restoreVerify.
// Hinweis: Die Schritte 'test-dump' und 'verify-data' haben keine Befehle —
// der Community-Dump verlangt eine gestoppte Datenbank, die Texte erklären
// daher das sichere Muster statt eines Live-Einzeilers.

import type { ServiceGuideCopy } from '../../types';

export const NEO4J_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit Neo4j hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem Neo4j-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass Neo4j erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das neo4j-Image und vermerkt den aufgelösten Container sowie die gefundenen Env-Keys (NEO4J_AUTH, NEO4J_PLUGINS). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Verstehen, wie der Neo4j-Dump funktioniert',
      body: 'Neo4j ist die eine Engine, bei der die Edition zählt. Enterprise unterstützt heiße Online-Backups mit neo4j-admin database backup, während die Datenbank weiterläuft. Community verlangt für neo4j-admin database dump eine gestoppte Datenbank — das sichere Muster ist ein kurzer geplanter Stopp zur ruhigsten Stunde oder der Dump einer Sekundärinstanz. Dockstash erfasst das entstehende Dump-Artefakt, nie das laufende /data-Verzeichnis.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Für Community-Neo4j planen Sie das Backup in die ruhigste Stunde, damit das kurze Dump-Fenster schmerzlos bleibt. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash erfasst den Graph-Dump und die Projektdateien und streamt alles in restic — die Live-Ausgabe verfolgen Sie Zeile für Zeile im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein Neo4j-Backup wird erst real, wenn es wieder in einen abfragbaren Graphen geladen wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, laden in eine Testinstanz und befördern bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile enthält ein konsistentes neo4j-admin-Dump-Artefakt plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Dump-Artefakt und Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellten Graphen laden und prüfen',
        body: 'Starten Sie einen Neo4j-Testcontainer (gleiches Image und gleiche Plugins wie in Produktion), laden Sie den Dump mit neo4j-admin database load gegen das gestoppte Ziel, starten Sie und prüfen Sie mit ein paar Cypher-Abfragen — Knoten- und Beziehungszahlen auf Ihren Kern-Labels sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn der wiederhergestellte Graph stimmt, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Dump-Schritt scheitert auf Community mit „database is in use".',
      cause: 'neo4j-admin database dump verlangt auf Community eine gestoppte Datenbank; ein Dump im laufenden Betrieb wird nicht unterstützt.',
      fix: 'Backup mit kurzem Stopp in eine ruhige Stunde legen, eine Sekundärinstanz dumpen — oder auf Enterprise wechseln, das heiße Online-Backups mit neo4j-admin database backup bietet.',
    },
    {
      symptom: 'Die wiederhergestellte Datenbank startet, aber Abfragen mit APOC oder GDS scheitern.',
      cause: 'Plugins gehören zu Image und Config, nicht zum Dump — das Restore-Ziel-Image liefert sie nicht mit.',
      fix: 'In ein Image mit denselben NEO4J_PLUGINS (APOC, GDS) wiederherstellen, bevor der Dump geladen wird, und die fehlgeschlagenen Prozeduren erneut ausführen.',
    },
    {
      symptom: 'neo4j-admin database load weigert sich, das Ziel zu überschreiben.',
      cause: 'Der load-Befehl ersetzt eine bestehende Datenbank nicht ohne ausdrückliche Anweisung, und das Ziel muss gestoppt sein.',
      fix: 'Zieldatenbank stoppen und --overwrite-destination=true übergeben (genau das tut der dokumentierte Restore-Befehl), dann Neo4j starten.',
    },
    {
      symptom: 'Backups sind viel größer, als der Graph vermuten lässt.',
      cause: 'Der Dump enthält den vollen Store; das Rauschen der Transaktionslogs zwischen zwei Dumps mindert zudem die restic-Deduplizierung.',
      fix: 'Dumps im täglichen Zeitplan halten und Prune + Retention die Historie beschneiden lassen; den Größentrend auf der Projektkarte beobachten, um zu bestätigen, dass die Aufbewahrung greift.',
    },
  ],
  gotchas: [
    'Auf der Community-Edition verlangt `neo4j-admin database dump` eine gestoppte Datenbank — ein Live-Dump wird nicht unterstützt, und /data im Betrieb zu kopieren ist inkonsistent.',
    'Die Enterprise-Edition bietet heiße Online-Backups via `neo4j-admin database backup`; Community braucht einen kurzen Stopp oder dumpt eine Sekundärinstanz.',
    'Der Bolt-Port (7687) ist für Clients; Backups laufen über neo4j-admin im Container, nicht über Bolt.',
  ],
  faq: [
    {
      question: 'Kann ich Neo4j sichern, ohne es zu stoppen?',
      answer:
        'Auf Enterprise ja — `neo4j-admin database backup` liefert ein heißes Online-Backup. Auf Community verlangt `database dump` eine gestoppte Datenbank; Dockstash plant einen kurzen Stopp oder dumpt eine Replik.',
    },
    {
      question: 'Warum nicht das Verzeichnis /data/databases kopieren?',
      answer:
        'Graph-Store und Transaktionslogs werden kontinuierlich geschrieben. Eine Live-Kopie ist inkonsistent und lädt womöglich nicht. neo4j-admin dump/backup erzeugen ein konsistentes, wiederherstellbares Artefakt.',
    },
    {
      question: 'Wie stelle ich einen Neo4j-Dump wieder her?',
      answer:
        'Mit `neo4j-admin database load ... --overwrite-destination=true` gegen ein gestopptes Ziel, dann Neo4j starten. Dockstash lädt vor jedem Überschreiben zuerst in eine Staging-Datenbank.',
    },
    {
      question: 'Enthält das Backup installierte Plugins?',
      answer:
        'Nein — Plugins (APOC, GDS) gehören zu Image/Config, nicht zum Datenbank-Dump. Stellen Sie sicher, dass das Restore-Ziel-Image dieselben Plugins hat, bevor Sie laden.',
    },
    {
      question: 'Wie oft sollte ich Neo4j sichern?',
      answer:
        'Täglich ist der praktikable Standard — wählen Sie Ihre ruhigste Stunde, wenn Sie Community fahren und das kurze Stopp-Fenster brauchen. Free = nur manuelle Backups; Pro erlaubt bis stündlich, Business jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Das Dump-Artefakt wird verschlüsselt, bevor es Ihren Server verlässt, und das Repository-Passwort verlässt nie Ihre Hände.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und verifiziert den erfassten Dump — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
