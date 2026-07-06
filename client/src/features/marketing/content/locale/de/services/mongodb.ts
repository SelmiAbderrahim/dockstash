// Deutsche Texte für den MongoDB-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.mongodb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MONGODB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit MongoDB hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem MongoDB-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass MongoDB erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das mongo-Image und fügt eine Datenbank-Ebene mit dem richtigen Dump-Befehl hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_DATABASE). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern ein- oder ausschalten.',
    },
    'test-dump': {
      title: 'Optional: den Dump von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie denselben Dump aus, den Dockstash ausführen wird — mongodump schreibt ein einzelnes Archiv nach stdout, umgeleitet in einen Byte-Zähler. Eine große Byte-Zahl ungleich null beweist, dass das Archiv sauber strömt. Genau dieses Archiv wird gesichert, niemals das laufende Verzeichnis /data/db.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab des Projekts täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten MongoDB-Projekte der richtige Standard. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt mongodump mit --archive und --oplog im laufenden Container aus und streamt das Archiv direkt in restic — die Live-Ausgabe verfolgen Sie Zeile für Zeile im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein MongoDB-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Datenbank standardmäßig nie — Sie stellen zuerst an einen frischen Staging-Ort wieder her, spielen dort das Archiv ein, prüfen die Daten und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile ist ein vollständiges mongodump-Archiv — alle Datenbanken und Collections plus die während des Dumps erfassten Oplog-Einträge — zusammen mit den Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Archiv und Dateien landen im gewählten Zielpfad; spielen Sie das Archiv mit mongorestore samt --oplogReplay und --drop in einem Staging-Container ein — das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Daten prüfen',
        body: 'Listen Sie im Testcontainer die Datenbanken mit mongosh auf, bestätigen Sie, dass jede zurück ist, und prüfen Sie stichprobenartig die Collections Ihrer App. Dokumentzahlen und jüngste Datensätze sind der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die wiederhergestellten Daten stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: Lassen Sie den wöchentlichen Restore-Drill diesen Beweis automatisch erbringen.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Der Dump scheitert mit „--oplog mode only supported on replica set members" (oder ähnlich).',
      cause: 'Ihr mongod läuft standalone. --oplog braucht einen Oplog zum Lesen, und nur Replica-Set-Mitglieder führen einen — auf einem Standalone-Server gibt es nichts zu erfassen.',
      fix: 'Wandeln Sie in ein Ein-Knoten-Replica-Set um: mongod mit --replSet rs0 starten und einmal rs.initiate() ausführen. Gleicher Container, gleiche Daten — plus Zeitpunkt-Garantie.',
    },
    {
      symptom: 'mongodump scheitert mit „Authentication failed", obwohl Compose MONGO_INITDB_ROOT_USERNAME setzt.',
      cause: 'Die MONGO_INITDB_*-Variablen legen den Benutzer nur bei der Erstinitialisierung eines leeren /data/db-Volumes an. Existierte das Volume bereits oder wurden die Zugangsdaten später geändert, stimmen die Compose-Werte nicht mehr.',
      fix: 'Authentifizieren Sie sich mit den tatsächlich in der Datenbank vorhandenen Zugangsdaten (mit mongosh prüfen) oder legen Sie den Benutzer neu an, und richten Sie dann die Compose-Env aus.',
    },
    {
      symptom: 'mongorestore in einen Testcontainer scheitert mit einem Versions- oder Archivfehler.',
      cause: 'Das Archiv stammt von einem neueren Server oder mongodump, als das Restore-Ziel versteht — ein mongo:7-Archiv in mongo:5 wiederherzustellen ist nicht unterstützt.',
      fix: 'Stellen Sie in dieselbe Hauptversion wieder her (z. B. mongo:7) und halten Sie mongodump/mongorestore auf demselben Database-Tools-Release. Versionsupgrades macht der Server nach dem Restore, nicht mongorestore.',
    },
    {
      symptom: 'Ein Backup-Lauf scheitert nach Crash oder Neustart an einem veralteten restic-Lock.',
      cause: 'Ein früherer Job starb mitten im Lauf und hinterließ das Repository gesperrt.',
      fix: 'Nichts manuell zu tun: Der nächste Lauf erkennt den verwaisten Lock und führt automatisch restic unlock aus. Scheitern Läufe weiterhin, prüfen Sie das Live-Log-Panel.',
    },
  ],
  gotchas: [
    'Führen Sie restic nie auf den laufenden WiredTiger-Dateien in /data/db aus — mitten im Checkpoint kopiert sind sie inkonsistent und oft nicht mehr zu retten.',
    '--oplog verlangt ein Replica-Set-Mitglied (auch ein Ein-Knoten-Set); auf einem Standalone-mongod ist es ein No-op ohne Zeitpunkt-Garantie.',
    'Beim Restore muss --oplogReplay die --oplog-Dumps begleiten, sonst geht die Zeitpunkt-Konsistenz verloren.',
  ],
  faq: [
    {
      question: 'Was macht --oplog eigentlich?',
      answer:
        'Es zeichnet die Operations-Log-Einträge auf, die während des mongodump-Laufs anfallen, und legt sie im Archiv ab. Beim Restore wendet --oplogReplay sie an, sodass der Dump einen einzigen konsistenten Zeitpunkt widerspiegelt statt einer Verschmierung über das Dump-Fenster.',
    },
    {
      question: 'Brauche ich ein Replica Set für konsistente Backups?',
      answer:
        'Für Zeitpunkt-Konsistenz ja — --oplog funktioniert nur auf einem Replica-Set-Mitglied. Viele Ein-Knoten-Deployments laufen genau deshalb als Ein-Mitglied-Replica-Set.',
    },
    {
      question: 'Warum nicht /data/db direkt kopieren?',
      answer:
        'WiredTiger schreibt kontinuierlich Checkpoints. Eine Datei-Kopie mitten im Checkpoint erfasst einen inkonsistenten Zustand, der häufig nicht startet. mongodump liest einen logischen, wiederherstellbaren Schnappschuss.',
    },
    {
      question: 'Wie stelle ich in eine saubere Datenbank wieder her?',
      answer:
        'mongorestore --archive --oplogReplay --drop löscht bestehende Collections vor dem Restore, damit sich alte und neue Daten nicht mischen. Dockstash stellt standardmäßig zuerst in ein Staging-Ziel wieder her.',
    },
    {
      question: 'Wie oft sollte ich MongoDB sichern?',
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
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle und prüft den Dump — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill heißt: immer frischer Beweis.',
    },
  ],
};
