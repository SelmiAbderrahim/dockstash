// Deutsche Texte für die Plattform-Guides (Dockstash selbst benutzen).
// Schritt-Keys spiegeln content/platform-guides.ts. Fakten aus den
// Produkt-Docs (docs/*.de.md).

import type { PlatformGuideCopy } from '../types';

export const PLATFORM: Record<string, PlatformGuideCopy> = {
  'connect-fleet-agent': {
    intro:
      'Ein Fleet-Agent ist ein kleiner Daemon auf einem anderen VPS, damit Dockstash auch die Container dieser Maschine sichert. Der Agent meldet sich per HTTPS nach Hause — bei Ihnen wird kein eingehender Port geöffnet — und fährt dieselbe Dump-dann-restic-Pipeline wie der Primärserver. Multi-VPS-Fleet ist ein Feature des Business-Tarifs.',
    steps: {
      'open-fleet': {
        title: 'Den Fleet-Bildschirm öffnen',
        body: 'Gehen Sie im Dashboard auf Fleet. Dieser Bildschirm listet jeden registrierten Agenten mit Online/Offline-Status, Version und letztem Heartbeat.',
      },
      'register-agent': {
        title: 'Den Agenten registrieren',
        body: 'Klicken Sie auf Register agent und vergeben Sie Namen und Ziel-Host. Tragen Sie im selben Dialog unter Project directories ein, wo Ihre Compose-Projekte auf dem VPS liegen (Standard /var/www) — nur in diesen Verzeichnissen wird der Agent jemals entdecken, sichern und wiederherstellen.',
      },
      'copy-token': {
        title: 'Das Einmal-Token kopieren',
        body: 'Die Registrierung prägt ein Token der Form dsa_<agentId>.<secret> und zeigt es genau einmal — serverseitig liegt es nur als schlüsselbasierter HMAC und ist nie wieder abrufbar. Kopieren Sie es jetzt. Bei Verlust nutzen Sie Rotate key in der Agent-Zeile; das alte Token verliert sofort seine Gültigkeit.',
      },
      'install-agent': {
        title: 'Den Agenten auf dem VPS installieren',
        body: 'Der Registrierungsdialog zeigt einen Copy-Paste-fähigen docker-compose-Block, vorbefüllt mit Token und Projektverzeichnissen. Fügen Sie ihn auf dem Ziel-VPS ein und starten Sie. Der mitgelieferte docker-socket-proxy gewährt dem Agenten Docker-Zugriff nach dem Least-Privilege-Prinzip (nur Container + Exec) — die rohe Socket berührt er nie.',
      },
      'set-project-roots': {
        title: 'Die Projektverzeichnisse als Mounts prüfen',
        body: 'Jedes gelistete Verzeichnis muss zusätzlich read-write ins Compose bind-gemountet sein (gleicher Pfad innen wie außen) — Restores schreiben Dateien zurück. Um später ein Verzeichnis zu ergänzen, öffnen Sie den Setup-Dialog des Agenten, fügen es hinzu und führen den angezeigten Compose-Befehl erneut aus.',
      },
      'verify-online': {
        title: 'Prüfen, dass der Agent online ist',
        body: 'Binnen etwa 30 Sekunden landet der erste Heartbeat und die Fleet-Zeile springt auf online. Bleibt sie offline, prüfen Sie, ob beide Container laufen und Ihre Dockstash-URL vom VPS aus erreichbar ist.',
      },
      'assign-project': {
        title: 'Ein Projekt dem Agenten zuweisen',
        body: 'Öffnen Sie den Plan-Tab eines Projekts und stellen Sie „Runs on" auf den neuen Agenten (Standard: „This server (local)"). Ab dann werden geplante und manuelle Backups dieses Projekts vom Agenten beansprucht und ausgeführt — mit Live-Logs zurück in Ihr Dashboard.',
      },
    },
    faq: [
      {
        question: 'Verbindet sich der Dockstash-Server in meinen VPS hinein?',
        answer:
          'Nein. Die Konnektivität ist ausschließlich ausgehend: Der Agent pollt und heartbeatet per HTTPS mit Bearer-Token. Sie öffnen nie einen eingehenden Port, und der Server ruft Ihre Maschine nie an.',
      },
      {
        question: 'Was kann der Agent auf meinem Server sehen?',
        answer:
          'Nur, was Sie erlauben. Der Dateisystemzugriff ist auf die konfigurierten Projektverzeichnisse begrenzt (die explizit gemountet sein müssen), und der Docker-Zugriff läuft über einen Socket-Proxy, der nur Container-Listing und Exec freigibt — keine Image-Builds, keine Volume-Mounts, kein Host-Root.',
      },
      {
        question: 'Was passiert, wenn der Agent mitten im Backup stirbt?',
        answer:
          'Jeder Job hat eine Lease (Standard 15 Minuten, verlängert solange Logs strömen). Läuft die Lease ab, wird der Job als fehlgeschlagen markiert und eine Alert-Mail verschickt — nie ein stiller Retry, Sie wissen also immer, dass ein Lauf nicht fertig wurde.',
      },
      {
        question: 'Laufen Restore-Drills auf Fleet-Agenten?',
        answer:
          'Noch nicht — Drills laufen weiter auf dem Primärserver. Backup, Verify (restic check), Prune und Restore laufen alle remote auf dem Agenten.',
      },
      {
        question: 'Ich habe den Key rotiert und der Agent bekommt 401er. Was tun?',
        answer:
          'Der laufende Container hält noch das alte Token. DOCKSTASH_AGENT_TOKEN in docker-compose.agent.yml aktualisieren und den Container neu erstellen. Die Rotation invalidiert das alte Token absichtlich sofort.',
      },
    ],
  },

  'schedule-backups': {
    intro:
      'Dockstash plant vier Job-Arten pro Projekt — backup, prune, check und drill — jede mit eigenem Cron-Ausdruck, ausgeführt über eine serialisierte Queue, die einen Job pro Repository zur Zeit garantiert. Mit täglichem Backup, wöchentlichem Prune samt Retention und wöchentlichem Drill laufen und verifizieren sich Ihre Backups ohne Sie.',
    steps: {
      'open-schedule': {
        title: 'Den Schedule-Tab des Projekts öffnen',
        body: 'Gehen Sie auf die Projekt-Detailseite und öffnen Sie den Schedule-Tab. Zeitpläne erfordern einen Bezahltarif: Free kennt nur manuelle Backups, Pro erlaubt bis stündlich, Business jeden Cron-Ausdruck.',
      },
      'pick-frequency': {
        title: 'Die Backup-Frequenz wählen',
        body: 'Wählen Sie täglich, wöchentlich oder einen eigenen Cron-Ausdruck — die Syntax wird beim Tippen validiert (0 3 * * * = täglich um 03:00). Täglich zur ruhigen Stunde ist der richtige Standard; stündlich nur, wenn ein Tag Datenverlust inakzeptabel wäre.',
      },
      'add-prune': {
        title: 'Einen Prune-Zeitplan mit Retention ergänzen',
        body: 'Prune ist absichtlich eine eigene Job-Art — es hält den Repository-Lock und löscht Daten, läuft also nie im selben Lauf wie ein Backup. Ergänzen Sie ein wöchentliches Prune und setzen Sie Ihre Aufbewahrungsrichtlinie (N täglich / wöchentlich / monatlich); sie übersetzt sich direkt in restic forget --prune.',
      },
      'add-check-drill': {
        title: 'Integritätschecks und Restore-Drill ergänzen',
        body: 'Planen Sie einen Check (restic check — strukturelle Integrität, günstig, gerne täglich) und einen Drill (voller Restore in einen isolierten Arbeitsbereich mit Byte- und Zeilen-Diffs — teuer, wöchentlich ist das Optimum). Der Drill macht aus „Backup existiert" ein „Backup restauriert".',
      },
      'save-and-watch': {
        title: 'Speichern und den ersten geplanten Lauf beobachten',
        body: 'Zeitplan speichern und feuern lassen. Jeder laufende Job streamt seine restic-Ausgabe live ins Log-Panel. Zwei Zeitpläne, die auf demselben Repository kollidieren, werden automatisch serialisiert — restic korrumpiert Repositories bei gleichzeitigem Zugriff, die Queue ist also der Korrektheitsvertrag, keine Optimierung.',
      },
    },
    faq: [
      {
        question: 'Warum kann Prune nicht Teil des Backup-Jobs sein?',
        answer:
          'Prune hält den Repo-Lock und ist destruktiv. Scheiterte ein kombinierter Job auf halbem Weg, hätten Sie womöglich weder frisches Backup noch abgeschlossenes Prune. Getrennte Zeitpläne lassen jede Operation allein gelingen oder scheitern.',
      },
      {
        question: 'Was passiert, wenn zwei Zeitpläne gleichzeitig feuern?',
        answer:
          'Gleiches Repository: Sie werden serialisiert — der zweite wartet auf den ersten. Verschiedene Repositories laufen parallel. Ein Repo sieht nie zwei gleichzeitige restic-Operationen.',
      },
      {
        question: 'Welche Cron-Frequenzen erlaubt mein Tarif?',
        answer:
          'Free hat keine Zeitpläne (nur manuelles Backup Now). Pro erlaubt bis stündlich. Business jeden Cron-Ausdruck. Das Formular weist alles über dem Tarif-Limit ab.',
      },
      {
        question: 'Werden geplante Läufe bei Fehlern wiederholt?',
        answer:
          'Ja, mit gedeckeltem exponentiellem Backoff. Wiederholte Fehlschläge markieren den Zeitplan als failed und lösen eine Alert-Mail aus — Fehler sind absichtlich laut.',
      },
      {
        question: 'Kann ich einem geplanten Backup live zuschauen?',
        answer:
          'Ja. Jeder Job streamt restic stdout/stderr Zeile für Zeile ins Log-Panel des Projekts über einen Live-Socket — genau wie ein manuelles Backup Now.',
      },
    ],
  },

  'restore-a-backup': {
    intro:
      'Wiederherstellen ist in Dockstash bewusst sicher: Snapshot auf dem Snapshots-Bildschirm wählen, Projektnamen zur Bestätigung tippen, standardmäßig an einen neuen Ort wiederherstellen — das Überschreiben des Live-Projekts ist ein separater, expliziter Opt-in. Die restic-Ausgabe streamt live, während der Restore läuft.',
    steps: {
      'open-snapshots': {
        title: 'Den Snapshots-Bildschirm öffnen',
        body: 'Wählen Sie Ihr Projekt auf dem Snapshots-Bildschirm. Sie sehen eine Zeitleiste von Wiederherstellungspunkten — jeder erfolgreiche Backup-Lauf ist ein Snapshot mit Projektdateien, Datenbank-Dumps und Configs, gemeinsam erfasst.',
      },
      'pick-restore-point': {
        title: 'Den Wiederherstellungspunkt wählen',
        body: 'Klicken Sie in der gewünschten Snapshot-Zeile auf Restore. Meist ist das der neueste; nach einem schlechten Deploy oder Datenkorruption der letzte Snapshot vor dem Vorfall.',
      },
      'typed-confirm': {
        title: 'Projektnamen zur Bestätigung tippen',
        body: 'Ein Bestätigungsdialog verlangt den exakten Projektnamen. Diese Reibung ist gewollt — Restores haben Konsequenzen, und die getippte Bestätigung eliminiert Falsches-Projekt-Unfälle.',
      },
      'choose-mode': {
        title: 'Den Restore-Modus wählen',
        body: 'Behalten Sie den Standard „Restore to new location" und geben Sie einen Zielpfad an: Der Snapshot materialisiert dort, das Live-Projekt bleibt unangetastet. „Overwrite existing" ersetzt das Live-Projekt und ist ein expliziter Opt-in — erst nutzen, nachdem Sie die Daten einmal validiert haben.',
      },
      'watch-logs': {
        title: 'Den Restore-Stream verfolgen',
        body: 'Die restic-Ausgabe streamt ins Log-Panel unter der Tabelle, während Dateien und Dumps materialisieren. Am Ende enthält der Zielpfad die Projektdateien plus den Datenbank-Dump jenes Snapshots.',
      },
      'validate-result': {
        title: 'Vor dem Umschalten validieren',
        body: 'Laden Sie den wiederhergestellten Dump in einen Datenbank-Testcontainer und prüfen Sie die Tabellen Ihrer App. Erst dann die App umhängen oder den Restore im Überschreib-Modus wiederholen. Für diesen Beweis im Dauerbetrieb: einen Restore-Drill planen.',
      },
    },
    faq: [
      {
        question: 'Überschreibt der Restore mein laufendes Projekt?',
        answer:
          'Nicht ohne die explizite Wahl von „Overwrite existing". Der Standardmodus stellt an einen neuen Ort Ihrer Wahl wieder her und lässt das Live-Projekt unberührt.',
      },
      {
        question: 'Kann ich eine einzelne Datei oder nur die Datenbank wiederherstellen?',
        answer:
          'Der Snapshot enthält Dateien, Dumps und Configs gemeinsam. An einen neuen Ort wiederherstellen und aus dem wiederhergestellten Baum nehmen, was Sie brauchen — der sicherste Weg für Einzelstücke.',
      },
      {
        question: 'Wie stelle ich auf einem ganz neuen Server wieder her?',
        answer:
          'Frisches Dockstash aufsetzen, auf denselben Storage-VPS zeigen und die Konfigurations-Export-Hülle mit demselben Master-Encryption-Key importieren. Die Repositories entschlüsseln dann, jeder Snapshot ist wiederherstellbar. Siehe das Bootstrap-Recovery-Runbook in den Docs.',
      },
      {
        question: 'Wie schnell ist ein Restore?',
        answer:
          'restic-Restores laufen ungefähr mit Netz- und Plattengeschwindigkeit; das Dashboard zeigt den Fortschritt live Zeile für Zeile. Restore an einen neuen Ort heißt zudem: Die App bleibt während des Restores online.',
      },
    ],
  },

  'restore-drills': {
    intro:
      'Ein Backup ist unbewiesen, bis es restauriert hat. Ein Restore-Drill stellt Ihren neuesten Snapshot in einen isolierten Arbeitsbereich wieder her, vergleicht jede Datei byteweise mit der Quelle, macht Zeilen-Diffs der Datenbank-Dumps und stempelt ein Bestanden/Fehlgeschlagen-Badge aufs Projekt — automatisch, nach Zeitplan. Der Unterschied zwischen Backups glauben und wissen.',
    steps: {
      'schedule-drill': {
        title: 'Einen wöchentlichen Drill planen',
        body: 'Ergänzen Sie im Schedule-Tab des Projekts einen Drill-Zeitplan. Wöchentlich ist die empfohlene Kadenz: Drills sind der teure Beweis (ein echter Restore), während der günstige Strukturcheck (restic check) täglich nebenher laufen kann.',
      },
      'run-drill-now': {
        title: 'Oder sofort einen auslösen',
        body: 'Der Restore-drill-Tab der Projekt-Detailseite zeigt das letzte Ergebnis und startet auf Wunsch sofort einen Drill. Er restauriert in einen isolierten Arbeitsbereich — Live-Projekt und Repository bleiben unberührt.',
      },
      'read-report': {
        title: 'Den Drill-Bericht lesen',
        body: 'Ein Drill besteht nur bei null Abweichungen: jede Datei byteidentisch, jeder Dump zeilenkonsistent. Das Projekt zeigt lastDrillAt und ein Bestanden/Fehlgeschlagen-Badge — „Verified" heißt: Ein echter Restore ist gelungen, nicht bloß: Ein Backup existiert.',
      },
      'fix-failures': {
        title: 'Einen gescheiterten Drill wie einen Incident behandeln',
        body: 'Ein gescheiterter Drill schickt eine Alert-Mail mit dem Abweichungsdetail. Häufige Ursachen: zerrissene Dumps eines Services am Adapter vorbei, während des Backups von einem parallelen Deploy geänderte Dateien, oder Repository-Korruption (mit Check samt Read-Data bestätigen). Ursache beheben, Backup Now laufen lassen, erneut drillen.',
      },
    },
    faq: [
      {
        question: 'Was genau vergleicht ein Drill?',
        answer:
          'Jeder Quellpfad und jede Config wird byteweise gegen sein wiederhergestelltes Spiegelbild gehasht, und der wiederhergestellte Dump jeder aktiven Datenbank-Ebene wird zeilenweise gegen die Quelle differenziert (oder geparst). Jede Abweichung lässt den Drill scheitern — kein Teilbestehen.',
      },
      {
        question: 'Kann ein Drill mein Live-Projekt beschädigen?',
        answer:
          'Nein. Drills restaurieren in einen isolierten Arbeitsbereich und räumen ihn danach auf, selbst wenn der Drill eine Exception wirft. Live-Projekt, Container und Repository sind nur lesende Beteiligte.',
      },
      {
        question: 'Worin unterscheidet sich ein Drill von restic check?',
        answer:
          'restic check beweist, dass das Repository strukturell gesund ist (keine fehlenden Packs, kein Index-Verfall). Nur ein Drill beweist, dass das Repository wirklich zu funktionierenden Daten restauriert. Checks täglich, Drills wöchentlich.',
      },
      {
        question: 'Laufen Drills auf Fleet-Agenten?',
        answer:
          'Noch nicht — Drills laufen auf dem Primärserver. Remote-Projekte behalten Backup, Check, Prune und Restore auf ihrem Agenten.',
      },
    ],
  },

  'notifications-alerts': {
    intro:
      'Dockstash macht Fehler laut. Jedes gescheiterte Backup, jeder gescheiterte Restore oder Drill löst sofort eine Alert-Mail an den Projekteigentümer aus, und ein Dead-Man\'s-Switch-Heartbeat fängt den stillen Fall, in dem nichts fehlschlug, weil nichts lief. Jede Alert trägt Projekt, Fehler, Zeitstempel des letzten Erfolgs und einen Direktlink.',
    steps: {
      'understand-triggers': {
        title: 'Wissen, was eine Alert auslöst',
        body: 'Vier Arten: ein gescheitertes Backup (jede Ebene — Dump, restic, Plattenplatz), ein gescheiterter Restore, ein gescheiterter Drill (Byte- oder Zeilenabweichung) und eine Heartbeat-Alert, wenn ein Projekt im Fenster kein erfolgreiches Backup hatte. Regeln pro Fehler konfigurieren Sie nicht — Fehler alarmieren immer.',
      },
      'set-heartbeat': {
        title: 'Das Heartbeat-Fenster einstellen',
        body: 'Die Heartbeat-Schwelle (Standard 24 Stunden) ist das „Stille ist ein Fehler"-Fenster: Ist das letzte erfolgreiche Backup eines Projekts älter, werden Sie alarmiert — auch bei Projekten, die nie erfolgreich waren. Alerts deduplizieren innerhalb des Fensters und setzen sich zurück, sobald ein Backup gelingt.',
      },
      'add-webhook': {
        title: 'Einen Webhook für Ihren Bereitschaftsdienst ergänzen',
        body: 'Setzen Sie eine Alert-Webhook-URL, und jede Alert POSTet ihre JSON-Payload zusätzlich dorthin — anschließbar an Slack, PagerDuty oder Ihren eigenen Bot. Mail und Webhook tragen dieselbe Payload: Ihre Automationen sehen exakt, was Sie sehen.',
      },
      'review-audit': {
        title: 'Den Audit-Trail nutzen',
        body: 'Destruktive und abrechnungsrelevante Aktionen (Backup-Läufe, Restore-Auslösungen, Zeitplan-Löschungen, Tarifwechsel) landen in einem unveränderlichen Audit-Log mit Akteur, Aktion, Ziel, IP und Zeitstempel — ohne Update- oder Löschpfad. Einsehbar im Konto oder über die Audit-API.',
      },
    },
    faq: [
      {
        question: 'Werde ich zugespammt, wenn ein Projekt dauernd fehlschlägt?',
        answer:
          'Heartbeat-Alerts deduplizieren für die Fensterlänge, bevor sie erneut alarmieren, und ein erfolgreiches Backup löscht die Deduplizierung sofort. Fehler-Alerts feuern pro fehlgeschlagenem Lauf — schlagen Läufe dauernd fehl, ist das Signal, kein Spam.',
      },
      {
        question: 'Was steckt in der Alert-Payload?',
        answer:
          'Projektname, Fehlerdetail, Zeitstempel des letzten Erfolgs und ein Direktlink ins Projekt-Dashboard. Der Webhook erhält dieselben Felder als JSON.',
      },
      {
        question: 'Warum kam eine Alert, obwohl nichts fehlgeschlagen ist?',
        answer:
          'Das ist der Heartbeat: Im Fenster landete kein erfolgreiches Backup. Ein pausierter Zeitplan, ein gestoppter Agent oder ein nie gelaufenes Projekt sehen in der Stille identisch aus — genau für diese Fälle existiert der Dead-Man\'s-Switch.',
      },
      {
        question: 'Kann externes Monitoring Dockstash selbst überwachen?',
        answer:
          'Ja — richten Sie Ihren Uptime-Monitor auf den unauthentifizierten Health-Endpoint (200 bei gesundem Stack, 503 degradiert). Aggregierte Zähler liegen ohne personenbezogene Daten auf einem Metrics-Endpoint.',
      },
    ],
  },

  'retention-policy': {
    intro:
      'Die Aufbewahrung entscheidet, wie viel Historie bleibt: N tägliche, N wöchentliche und N monatliche Snapshots pro Projekt. Dockstash mappt Ihre Richtlinie direkt auf restic forget --prune, ausgeführt von einem geplanten Prune-Job — alte Snapshots werden automatisch beschnitten und das Repository bleibt kompakt, ohne je frische Wiederherstellungspunkte anzurühren.',
    steps: {
      'open-retention': {
        title: 'Settings → Retention öffnen',
        body: 'Die Aufbewahrung wird zentral in den Settings konfiguriert. Ihr Tarif deckelt das Fenster: Free hält 7 Tage, Pro 30, Business 90 — Ihre Richtlinie wird auf das Tarif-Limit begrenzt.',
      },
      'choose-keep': {
        title: 'Die Keep-Zähler wählen',
        body: 'Ein solider Standard: 7 täglich, 4 wöchentlich, 6 monatlich behalten. So haben Sie tagesgenaue Restores für eine Woche, wochengenaue für einen Monat und monatsgenaue für ein halbes Jahr — während das Repository dank restic-Deduplizierung klein bleibt.',
      },
      'schedule-prune': {
        title: 'Den Prune-Job planen',
        body: 'Ergänzen Sie pro Projekt einen wöchentlichen Prune-Zeitplan. Ihre Keep-Zähler übersetzen sich eins zu eins in restic-forget-Flags — der Befehl unten ist exakt, was eine 7/4/6-Richtlinie ausführt. Prune ist eine eigene Job-Art, weil es das Repo sperrt und Daten löscht; es hängt sich nie an ein Backup.',
      },
      'verify-prune': {
        title: 'Prüfen, dass das Pruning greift',
        body: 'Nach dem ersten Prune auf die Projektkarte schauen: Die Snapshot-Anzahl sollte sich einpendeln und die Repo-Größe aufhören, endlos zu wachsen. Die Snapshots-Zeitleiste zeigt genau, welche Wiederherstellungspunkte bleiben.',
      },
    },
    faq: [
      {
        question: 'Löscht Pruning je mein einziges frisches Backup?',
        answer:
          'Nein. Keep-Zähler bewahren immer die jüngsten Snapshots jeder Kategorie — Pruning stutzt den alten Schwanz, nie den frischen Kopf. Eine 7-täglich-Richtlinie behält immer die letzten sieben Tages-Snapshots.',
      },
      {
        question: 'Was passiert mit der Aufbewahrung bei einem Downgrade?',
        answer:
          'Das Retention-Limit des neuen Tarifs gilt ab sofort, und bestehende Backups werden beim Downgrade nie gelöscht — Projekte über dem Limit werden pausiert (read-only), nicht gelöscht.',
      },
      {
        question: 'Warum ist mein Repository nach dem Prune noch groß?',
        answer:
          'restic forget entfernt Snapshots; erst der --prune-Durchlauf packt neu und gibt unreferenzierte Daten frei. Der Platz sinkt nach Abschluss des Prune, nicht nach dem bloßen forget — siehe die Repack-Zusammenfassung im Prune-Log.',
      },
      {
        question: 'Brauche ich Prune bei wenigen Snapshots überhaupt?',
        answer:
          'Irgendwann ja. Ohne Prune lebt jeder Snapshot ewig und das Repo wächst grenzenlos. Ein wöchentliches Prune mit vernünftigen Keep-Zählern ist eine günstige Versicherung gegen eine volle Storage-Platte — selbst ein Backup-Fehlermodus.',
      },
    ],
  },

  'storage-destinations': {
    intro:
      'Dockstash speichert Backups auf einer Maschine unter Ihrer Kontrolle: einem per SSH erreichbaren Storage-VPS mit verschlüsselten restic-Repositories. Keine Dritt-Cloud steht zwischen Ihren Daten und Ihnen — die Einrichtung besteht aus einer SSH-Identität plus einem Verschlüsselungspasswort, und beide bleiben in Ihrer Hand.',
    steps: {
      'prepare-vps': {
        title: 'Eine Storage-Maschine vorbereiten',
        body: 'Jeder per SSH erreichbare Linux-VPS oder Heimserver genügt — er braucht Plattenplatz und einen SSH-Benutzer, sonst nichts. Nutzen Sie eine andere Maschine (idealerweise anderer Anbieter oder Standort) als die, die Ihre Projekte fährt: Ein Backup auf derselben Kiste stirbt mit ihr.',
      },
      'add-ssh-key': {
        title: 'Die SSH-Verbindung hinterlegen',
        body: 'Geben Sie im Einrichtungsassistenten (oder später unter Settings → Storage) Host, Benutzer, Port und einen privaten SSH-Key ein. Der Key ist write-only — nach dem Speichern wird er nie wieder angezeigt. Dockstash schiebt restic-Snapshots per SFTP mit dieser Identität.',
      },
      'save-encryption-password': {
        title: 'Das Verschlüsselungspasswort sichern — es erscheint genau einmal',
        body: 'Der Assistent generiert ein starkes Repository-Verschlüsselungspasswort und zeigt es exakt einmal. Kopieren Sie es in einen Passwort-Manager, bevor Sie auf Done klicken. Es ist nicht wiederherstellbar: Verlust bedeutet, die Repositories kann niemand mehr entschlüsseln, nie.',
      },
      'verify-connection': {
        title: 'Mit einem ersten Backup verifizieren',
        body: 'Backup Now auf einem beliebigen Projekt ausführen. Ein grüner Lauf beweist: Der Storage-VPS ist erreichbar, die SSH-Identität funktioniert, das Repository wurde korrekt initialisiert und verschlüsselt. Die Projektkarte zeigt danach die wachsende Repo-Größe auf der Storage-Maschine.',
      },
      'plan-recovery': {
        title: 'Für den Totalverlust vorsorgen',
        body: 'Halten Sie drei Dinge an getrennten Orten: den Storage-VPS (Ihre Repos), Ihren Master-Encryption-Key und Ihre Konfigurations-Export-Hülle. Mit allen dreien ist ein zerstörter Produktionsserver ein Wiederaufbau, kein Datenverlust — das Bootstrap-Recovery-Runbook führt hindurch.',
      },
    },
    faq: [
      {
        question: 'Kann ich jeden Anbieter als Storage-Ziel nutzen?',
        answer:
          'Alles, worauf Sie per SSH kommen: ein günstiger Storage-VPS, eine Hetzner-Storage-Box, ein NAS an einem anderen Standort. Spricht es SSH/SFTP und hat Platte, kann restic dort Repositories führen.',
      },
      {
        question: 'Wer kann meine Backups auf der Storage-Box lesen?',
        answer:
          'Niemand ohne Ihr Verschlüsselungspasswort. Repositories werden von restic AES-verschlüsselt, bevor sie Ihren Server verlassen; die Storage-Box sieht ausschließlich Chiffretext.',
      },
      {
        question: 'Was, wenn ich das Verschlüsselungspasswort verliere?',
        answer:
          'Die Repositories sind unwiederbringlich — das ist der Sinn echter Verschlüsselung. Speichern Sie das Passwort im Passwort-Manager, sobald der Assistent es zeigt, und sichern Sie Master-Key und Export-Hülle getrennt.',
      },
      {
        question: 'Kann ich Verschlüsselungspasswort oder SSH-Key rotieren?',
        answer:
          'Ja. Settings → Encryption password rotiert das Repo-Passwort (mit expliziter „Ich habe es gespeichert"-Bestätigung), und Settings → Storage nimmt jederzeit einen neuen SSH-Key an.',
      },
    ],
  },

  'troubleshooting-backups': {
    intro:
      'Wenn ein Backup scheitert, sagt Dockstash es laut und zeigt genau wo: eine Alert-Mail mit dem Fehler, ein Status-Badge auf der Projektkarte und die volle restic-Ausgabe im Live-Log-Panel. Dieser Guide geht die häufigen Fehlerbilder durch — rote Läufe, Offline-Agenten, der Stille-Alarm — und ihre Fixes.',
    steps: {
      'check-status': {
        title: 'Bei der Projektkarte anfangen',
        body: 'Der Projects-Bildschirm zeigt pro Projekt Status-Badge, letzte Backup-Zeit und Größe. Ein gescheiterter Lauf kommt zusätzlich als Alert-Mail mit Fehler und Direktlink — starten Sie bei einem von beiden. Die Detailansicht zeigt das letzte Fehlschlag-Detail direkt.',
      },
      'read-live-logs': {
        title: 'Die restic-Ausgabe des Laufs lesen',
        body: 'Öffnen Sie das Log-Panel des fehlgeschlagenen Laufs. Die letzten Zeilen benennen fast immer die Ursache: authentication failed (SSH-Key oder DB-Zugangsdaten), no space left on device (Storage-Box voll), connection refused (Storage-VPS unerreichbar) oder ein Dump-Befehlsfehler aus dem Container.',
      },
      'stale-lock': {
        title: 'Veraltete restic-Locks heilen sich selbst',
        body: 'Ist ein Lauf abgestürzt oder der Server mitten im Backup neu gestartet, kann das Repository gesperrt bleiben. Kein Eingriff nötig: Der nächste Lauf erkennt den verwaisten Lock und führt automatisch restic unlock aus. Ein von einem wirklich laufenden Job gehaltener Lock wird nie gebrochen.',
      },
      'agent-offline': {
        title: 'Agent-Projekte: zuerst den Agenten prüfen',
        body: 'Hört ein Fleet-Agent-Projekt auf zu sichern, schauen Sie auf den Fleet-Bildschirm. Offline heißt: Heartbeats blieben aus — auf dem VPS prüfen, ob beide Agent-Container laufen, die Dockstash-URL erreichbar ist und das Token nicht rotiert wurde, ohne den Container zu aktualisieren. Wiederholte 401er in den Logs bedeuten: Irgendwo heartbeatet noch ein alter Container mit widerrufenem Token.',
      },
      'heartbeat-alerts': {
        title: '„Kein Backup lief"-Alerts verstehen',
        body: 'Eine Heartbeat-Alert heißt: Im Fenster landete kein erfolgreiches Backup — nichts schlug fehl, nichts lief. Übliche Verdächtige: Zeitplan deaktiviert, Tarif ohne Zeitpläne, Projekt nach Downgrade pausiert, zugewiesener Agent offline. Ursache beheben — der nächste grüne Lauf löscht den Alarm.',
      },
    },
    faq: [
      {
        question: 'Ein Backup schlug einmal fehl und gelang beim Retry. Muss mich das kümmern?',
        answer:
          'Auf den Fehlergrund schauen. Jobs wiederholen mit gedeckeltem exponentiellem Backoff — transiente Netzwerk-Schluckaufe heilen sich selbst. Wiederkehrende Retries auf demselben Fehler — volllaufende Platte, wackliges SSH — verdienen einen echten Fix, bevor sie zum harten Ausfall werden.',
      },
      {
        question: 'Warum wartet mein zweiter Zeitplan, statt zu laufen?',
        answer:
          'Ein Job pro Repository, immer. Gleichzeitige restic-Operationen korrumpieren Repositories, kollidierende Zeitpläne auf demselben Repo werden also bewusst serialisiert. Verschiedene Repos laufen parallel.',
      },
      {
        question: 'Der Add-Project-Picker meines Agenten ist leer. Warum?',
        answer:
          'Der Picker liest den Snapshot, den der Agent beim letzten Heartbeat gepusht hat. Leer heißt: Der Agent hat noch nie berichtet, ein Projektverzeichnis ist im Agent-Container nicht wirklich gemountet, oder der Docker-Socket-Proxy ist unerreichbar — das Banner im Picker sagt, was es ist. Beheben, dann Refresh now klicken statt auf den nächsten Discovery-Zyklus zu warten.',
      },
      {
        question: 'Wie beweise ich, dass das Repository selbst gesund ist?',
        answer:
          'Einen Check-Job laufen lassen. restic check verifiziert die Repository-Struktur; mit einem Read-Data-Prozentsatz liest und prüft es auch echte Pack-Inhalte. Bestanden erfordert Exit-Code null — kein falsches Grün.',
      },
      {
        question: 'Wo sehe ich, warum ein Drill fehlschlug?',
        answer:
          'Das Drill-Ergebnis speichert eine Detailmeldung samt Abweichungszahl, sichtbar im Restore-drill-Tab und in der Alert-Mail. Byte-Abweichungen deuten auf Dateien, die sich während des Backups änderten; Zeilen-Abweichungen auf Dump-Konsistenz — in beiden Fällen gilt das Backup als unbewiesen, bis ein neuer Lauf besteht.',
      },
    ],
  },
};
