// Deutsche Texte für den MinIO-Guide. Schritt-Keys spiegeln
// content/guides.ts → SERVICE_GUIDES.minio walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MINIO_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: 'Dockstash-Konto anlegen und das Dashboard öffnen',
      body: 'Registrieren Sie sich kostenlos auf dockstash.com/register. Der einmalige Einrichtungsassistent fragt nach Ihrem Storage-VPS (der Maschine, die die verschlüsselten Backups aufnimmt) und generiert ein Verschlüsselungspasswort — speichern Sie es sofort in einem Passwort-Manager, es wird genau einmal angezeigt.',
    },
    'add-project': {
      title: 'Das Docker-Projekt mit MinIO hinzufügen',
      body: 'Auf dem Projects-Bildschirm erkennt Dockstash automatisch jeden Compose-Projektordner des Servers (standardmäßig unter /var/www). Wählen Sie das Projekt mit Ihrem MinIO-Service. Noch wird nichts gesichert — Sie sagen Dockstash nur, wo das Projekt liegt.',
    },
    'review-detection': {
      title: 'Prüfen, dass MinIO erkannt wurde',
      body: 'Öffnen Sie das Projekt und schauen Sie auf den Plan-Tab. Dockstash liest docker-compose.yml, erkennt das minio/minio-Image und fügt eine um mc mirror gebaute Object-Store-Ebene hinzu — samt aufgelöstem Containernamen und den gefundenen Env-Keys (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD oder das ältere Paar MINIO_ACCESS_KEY / MINIO_SECRET_KEY). Dateien, Datenbanken und Proxy-Configs lassen sich vor dem Speichern umschalten.',
    },
    'test-dump': {
      title: 'Optional: die Bucket-Liste von Hand gegenprüfen',
      body: 'Wenn Sie vor der Automatisierung einen Beweis wollen, führen Sie im Container mc ls gegen den local-Alias aus. Sie sollten jeden Bucket mit Größe und Objektzahl sehen — genau diese Buckets kopiert mc mirror Objekt für Objekt über die S3-API heraus, nie das rohe /data-Verzeichnis.',
    },
    'choose-destination': {
      title: 'Speicherziel bestätigen',
      body: 'Backups liegen als verschlüsselte restic-Snapshots auf Ihrem eigenen Storage-VPS, übertragen per SSH. Haben Sie den Assistenten abgeschlossen, ist das bereits konfiguriert; Host, Benutzer, Port oder SSH-Key ändern Sie jederzeit unter Settings → Storage.',
    },
    'schedule': {
      title: 'Backup-Zeitplan festlegen',
      body: 'Wählen Sie im Schedule-Tab täglich, wöchentlich oder einen eigenen Cron-Ausdruck (inline validiert). Täglich zu einer ruhigen Stunde ist für die meisten Object Stores der richtige Standard — Mirrors sind inkrementell, Folgeläufe kopieren nur Geändertes. Ergänzen Sie einen wöchentlichen Prune-Zeitplan mit Ihrer Aufbewahrungsrichtlinie.',
    },
    'run-first-backup': {
      title: 'Das erste Backup jetzt ausführen',
      body: 'Klicken Sie auf Backup Now auf der Projektkarte. Dockstash führt mc mirror im Container aus, kopiert jeden Bucket über die S3-API heraus — jedes Objekt atomar samt Metadaten — und streamt das Ergebnis in restic. Die Live-Ausgabe verfolgen Sie im Log-Panel.',
    },
    'confirm-snapshot': {
      title: 'Snapshot bestätigen',
      body: 'Nach dem Lauf zeigt die Projektkarte die neue letzte Backup-Zeit, die Snapshot-Anzahl und die Repository-Größe. Öffnen Sie den Snapshots-Bildschirm: Der Wiederherstellungspunkt erscheint in der Zeitleiste — Ihr Beweis, dass das Backup off-site angekommen ist.',
    },
  },
  restoreVerify: {
    intro:
      'Ein MinIO-Backup wird erst real, wenn es wiederhergestellt wurde. Dockstash-Restores überschreiben Ihre Live-Buckets standardmäßig nie — Sie stellen zuerst an einen frischen Ort wieder her, prüfen die Objekte und befördern sie bewusst.',
    steps: {
      'pick-snapshot': {
        title: 'Wiederherstellungspunkt wählen',
        body: 'Öffnen Sie Snapshots, wählen Sie das Projekt und durchstöbern Sie die Zeitleiste. Jede Zeile ist ein vollständiger API-Level-Mirror Ihrer Buckets — jedes Objekt mit Metadaten und Tags — plus die Projektdateien desselben Laufs.',
      },
      'restore-scratch': {
        title: 'An einen neuen Ort wiederherstellen',
        body: 'Klicken Sie auf Restore und behalten Sie den Standardmodus „Restore to new location". Tippen Sie den Projektnamen zur Bestätigung. Gespiegelte Buckets und Dateien landen im gewählten Zielpfad; das Live-Projekt bleibt unberührt.',
      },
      'verify-data': {
        title: 'Wiederhergestellte Objekte prüfen',
        body: 'Spiegeln Sie den wiederhergestellten Bucket in eine MinIO-Testinstanz und listen Sie den Inhalt mit mc ls. Vergleichen Sie Objektzahl und Gesamtgröße mit dem Live-Bucket und prüfen Sie ein paar Objekte, die Ihre App wirklich ausliefert — ein Download, der korrekt öffnet, ist der schnellste Wahrheitstest.',
      },
      'promote': {
        title: 'Bei Erfolg befördern',
        body: 'Wenn die Objekte stimmen, richten Sie Ihre App darauf aus (oder wiederholen den Restore mit „Overwrite existing" — ein expliziter Opt-in). Besser: der wöchentliche Restore-Drill erbringt den Beweis automatisch.',
      },
    },
  },
  troubleshooting: [
    {
      symptom: 'Eine wiederhergestellte /data-Kopie liefert keine Objekte aus, oder MinIO loggt xl.meta-Fehler beim Start.',
      cause: 'Das Backup entstand durch Kopieren des rohen /data-Verzeichnisses statt Spiegelung über die S3-API. MinIO speichert jedes Objekt neben xl.meta-Metadaten; eine rohe Kopie, die sie verpasst oder zerreißt, macht Objekte unlesbar.',
      fix: 'Sichern Sie mit mc mirror über die S3-API — der Ansatz, den Dockstash standardmäßig konfiguriert. Haben Sie ein Roh-Kopie-Backup geerbt: in ein gestopptes MinIO derselben Version einspielen und jeden Bucket mit mc ls prüfen, bevor Sie ihm vertrauen.',
    },
    {
      symptom: 'Einige kürzlich hochgeladene Objekte fehlen im Backup.',
      cause: 'Es waren laufende Multipart-Uploads, als der Mirror lief — unvollständige Uploads sind fürs S3-Listing unsichtbar, bis der letzte Teil ankommt; eine rohe Datei-Kopie hätte sie als unbrauchbare Fragmente erfasst.',
      fix: 'Nichts ist korrupt: Der nächste geplante Mirror nimmt die fertiggestellten Objekte mit. Ist ein bestimmter Upload wichtig, laufen Sie Backup Now nach dessen Abschluss, oder legen Sie Backups außerhalb der Upload-Spitzen.',
    },
    {
      symptom: 'Ein versionierter Bucket wird mit nur einer Version je Objekt wiederhergestellt.',
      cause: 'Ein einfaches mc mirror kopiert den aktuellen Stand jedes Objekts — ältere Versionen werden ohne explizite Versions-Replikation nicht mitgenommen.',
      fix: 'Wenn Sie fürs Point-in-Time-Recovery auf Bucket-Versionierung setzen, spiegeln Sie Versionen explizit (mc mirror mit Versions-Replikation) — oder betrachten Sie die Dockstash-Snapshot-Zeitleiste selbst als Versionshistorie: Jeder tägliche Snapshot bewahrt den Objektstand jenes Tages.',
    },
    {
      symptom: 'mc-Befehle scheitern mit „Access Denied" oder „invalid credentials".',
      cause: 'Die Zugangsdaten im Compose wurden geändert (z. B. Rotation von MINIO_ROOT_USER / MINIO_ROOT_PASSWORD), doch der im Container konfigurierte mc-Alias hält noch das alte Paar.',
      fix: 'Container neu erstellen, damit der Alias aus der aktuellen Env neu gebaut wird, oder im Container mc alias set mit den neuen Zugangsdaten ausführen und das Backup wiederholen.',
    },
  ],
  gotchas: [
    'Bevorzugen Sie mc mirror gegenüber dem Kopieren des rohen /data-Verzeichnisses — MinIO speichert Objekte plus xl.meta-Metadaten, und eine rohe Kopie kann laufende Multipart-Uploads verpassen.',
    'Spiegeln Sie über die S3-API, damit Objekt-Metadaten, Versionen und Tags konsistent erhalten bleiben.',
    'Bei versionierten Buckets replizieren Sie Versionen explizit, sonst erfassen Sie nur den letzten Objektstand.',
  ],
  faq: [
    {
      question: 'MinIO mit mc mirror sichern oder per Datei-Kopie?',
      answer:
        'Mit mc mirror. Es liest Objekte über die S3-API, sodass jedes Objekt samt Metadaten atomar erfasst wird. Eine rohe /data-Kopie kann laufende Multipart-Uploads erwischen oder das Metadaten-Layout verfehlen.',
    },
    {
      question: 'Erhält mc mirror Versionen und Tags?',
      answer:
        'Es erhält Objekt-Metadaten und Tags. Bei versionierten Buckets müssen Sie Versionen explizit spiegeln, sonst wird nur die aktuelle Version jedes Objekts erfasst.',
    },
    {
      question: 'Kann ich in eine frische MinIO-Instanz wiederherstellen?',
      answer:
        'Ja. mc auf die neue Instanz richten, Ziel-Bucket anlegen und das Backup-Verzeichnis zurückspiegeln. Dockstash übergibt die gespiegelten Objekte zwischen den Schritten an restic.',
    },
    {
      question: 'Ist das Kopieren von /data je akzeptabel?',
      answer:
        'Nur bei vollständig gestopptem MinIO ohne laufende Schreibzugriffe — und selbst dann muss das Metadaten-Layout exakt erhalten bleiben. Der API-Level-Mirror ist der sicherere, unterstützte Weg.',
    },
    {
      question: 'Wie oft sollte ich MinIO sichern?',
      answer:
        'Täglich ist der praktikable Standard — mc mirror ist inkrementell, ruhige Tage kosten fast nichts. Im Free-Tarif sind Backups manuelle Backup-Now-Läufe; Pro ergänzt Zeitpläne bis stündlich, Business erlaubt jeden Cron-Ausdruck. Kombinieren Sie den Zeitplan mit einem wöchentlichen Restore-Drill.',
    },
    {
      question: 'Wo liegen die Backups eigentlich?',
      answer:
        'Auf Ihrem eigenen Storage-VPS, als verschlüsselte restic-Snapshots per SSH übertragen. Dockstash hält Ihre Objekte nie in einer Dritt-Cloud — Sie zeigen auf eine Maschine unter Ihrer Kontrolle, und das Repository ist mit einem Passwort verschlüsselt, das nur Sie besitzen.',
    },
    {
      question: 'Woher weiß ich ohne manuellen Restore, dass das Backup wiederherstellbar ist?',
      answer:
        'Planen Sie einen Restore-Drill. Dockstash stellt den neuesten Snapshot in einen isolierten Arbeitsbereich wieder her und vergleicht jede wiederhergestellte Datei byteweise mit der Quelle — dann stempelt es ein Bestanden/Fehlgeschlagen-Badge aufs Projekt. Ein wöchentlicher Drill beweist laufend, dass Ihre Buckets zurückkommen.',
    },
  ],
};
