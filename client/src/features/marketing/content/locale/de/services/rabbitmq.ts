// Deutsche Texte für den RabbitMQ-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.rabbitmq walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const RABBITMQ_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit RabbitMQ hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem RabbitMQ-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass RabbitMQ erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das rabbitmq-Image und fügt eine Ebene hinzu, die die Broker-Definitionen exportiert — samt aufgelöstem Containernamen und den gefundenen Env-Keys (RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_VHOST). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: den Export von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie rabbitmqctl export_definitions im Container aus. Es schreibt eine JSON-Datei mit Ihrer gesamten Broker-Topologie — vhosts, Exchanges, Queues, Bindings, Benutzer und Policies. Öffnen Sie sie: Sie erkennen jede von Ihrer App deklarierte Queue wieder; dieses JSON wird gesichert.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich reicht für die meisten Broker völlig — die Topologie ändert sich beim Deploy, nicht im Minutentakt. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt rabbitmqctl export_definitions im laufenden Container aus und übergibt das JSON zusammen mit Ihren Projektdateien an restic — die Live-Ausgabe verfolgen Sie im Log-Panel. Definitionen exportieren sauber, während der Broker Traffic bedient; nichts wird gestoppt oder gesperrt.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein RabbitMQ-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihren Live-Broker standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Topologie und befördern bewusst. Denken Sie daran, was Sie wiederherstellen: Das Definitions-JSON baut Ihre Topologie neu auf, nicht die Nachrichten, die in Queues lagen.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile enthält das exportierte Definitions-JSON — die vollständige Broker-Topologie zu jenem Moment — plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Definitions-JSON und Dateien landen im gewählten Zielpfad; der Live-Broker bleibt unberührt. Starten Sie einen frischen RabbitMQ-Container und führen Sie rabbitmqctl import_definitions dagegen aus.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Topologie prüfen',
        body: 'Führen Sie rabbitmqctl list_queues auf dem Test-Broker aus: Es listet jeden Queue-Namen mit Nachrichtenzahl. Jede von Ihrer App deklarierte Queue muss erscheinen (die Zähler sind null — Nachrichten sind nicht Teil des Backups). Prüfen Sie Exchanges, Bindings, Benutzer und Policies genauso oder über die Management-UI.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Topologie stimmt, richten Sie Producer und Consumer auf den wiederhergestellten Broker (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Restore hat „funktioniert", aber alle Queues sind leer.',
      cause: 'Definitionen und Nachrichten sind zweierlei. export_definitions erfasst Topologie — vhosts, Exchanges, Queues, Bindings, Benutzer, Policies —, nie die zum Backup-Zeitpunkt eingereihten Nachrichteninhalte.',
      fix: 'Das ist erwartet. Behandeln Sie eingereihte Nachrichten als flüchtig: Producer sollen neu publizieren, Consumer Replay tolerieren. Muss eine Nachricht einen Broker-Verlust überleben, gehört sie in eine Datenbank, nicht in eine Queue.',
    },
    {
      symptom: 'Ein Broker, gestartet aus einer Kopie von /var/lib/rabbitmq/mnesia, stürzt ab oder startet nicht.',
      cause: 'Mnesia wird kontinuierlich geschrieben, solange der Broker läuft — eine Live-Kopie ist intern inkonsistent, und der Store ist zudem an den Knotennamen gebunden, bricht also auf einem Host mit anderem Hostnamen.',
      fix: 'Kopieren Sie Mnesia nicht als Backup. Exportieren Sie Definitionen und importieren Sie sie in einen frischen Broker; das ist der unterstützte, wiederherstellbare Weg.',
    },
    {
      symptom: 'import_definitions in einen laufenden Broker wirft Fehler oder hinterlässt eine Mischung aus alter und neuer Topologie.',
      cause: 'Der Import merged in den Bestand — kollidierende Queue-Argumente, vorhandene Benutzer oder Policies stoßen mit JSON-Einträgen zusammen, statt sie zu ersetzen.',
      fix: 'Wenn möglich in einen frischen Broker importieren. Muss es der laufende sein: Erwarten Sie einen Merge, keinen Reset — löschen Sie kollidierende Entitäten vorher und prüfen Sie das Ergebnis mit rabbitmqctl list_queues und der Management-UI.',
    },
  ],
  gotchas: [
    'Sichern Sie Broker-Definitionen (Topologie) via export_definitions — das ist der dauerhafte, wiederherstellbare Teil von RabbitMQ.',
    'Der Mnesia-Nachrichtenspeicher hält In-Flight-Nachrichten und ist im Betrieb nicht sicher kopierbar; behandeln Sie persistierte Nachrichten als flüchtig und lassen Sie Producer/Consumer die Wiederherstellung tragen.',
    'Die Wiederherstellung der Definitionen baut die Topologie neu — nicht die Nachrichten, die beim Backup in Queues lagen.',
  ],
  faq: [
    {
      question: 'Welchen Teil von RabbitMQ sollte ich sichern?',
      answer:
        'Die Definitionen: vhosts, Exchanges, Queues, Bindings, Benutzer und Policies. Ihr JSON-Export erfasst Ihre gesamte Broker-Topologie — genau das, was Sie nach einem Verlust zum Wiederaufbau brauchen.',
    },
    {
      question: 'Kann ich die in Queues liegenden Nachrichten sichern?',
      answer:
        'Nicht zuverlässig, solange der Broker läuft. Der Mnesia-Store ist unter Last nicht zeitpunktkonsistent, und Nachrichten sind als flüchtig gedacht. Bauen Sie Consumer, die Replay tolerieren, statt auf ein Nachrichten-Backup zu setzen.',
    },
    {
      question: 'Wie stelle ich einen RabbitMQ-Broker wieder her?',
      answer:
        'Frischen Broker hochziehen und rabbitmqctl import_definitions mit dem exportierten JSON ausführen. Die volle Topologie — Exchanges, Queues, Bindings, Benutzer, Policies — wird neu erzeugt.',
    },
    {
      question: 'Ist das Kopieren von /var/lib/rabbitmq/mnesia ein gültiges Backup?',
      answer:
        'Nein. Mnesia wird kontinuierlich geschrieben, eine Live-Kopie ist inkonsistent. Exportieren Sie stattdessen die Definitionen; das ist der unterstützte, wiederherstellbare Backup-Pfad.',
    },
    {
      question: 'Wie oft sollte ich RabbitMQ sichern?',
      answer:
        'Täglich reicht für die meisten Broker — die Definitionen ändern sich nur, wenn Sie neue Queues, Benutzer oder Policies deployen. Im Free-Tarif sind Backups manuell (Backup Now); Pro schaltet Zeitpläne bis stündlich frei, Business erlaubt jeden Cron-Ausdruck.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Daten nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und parst das wiederhergestellte Definitions-JSON — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
