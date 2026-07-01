# Dashboard-Nutzung

Dockstash bietet vier Bildschirme plus einen einmaligen Einrichtungs-Assistenten. Jeder Bildschirm hat eine primäre Aktion.

## Einrichtungs-Assistent
1. **Storage-VPS** — Host, Benutzer, Port und SSH-Privatschlüssel einfügen.
2. **Verschlüsselungspasswort** — wird nur einmal gezeigt. Sofort in Passwortmanager kopieren.
3. **Bestätigen** — Häkchen setzen bei „Habe es gespeichert — Verlust = keine Wiederherstellung", dann **Fertig**.

## Projekte
Jeder Ordner unter `/var/www` erscheint als Karte. Primäre Aktion: **Jetzt sichern** mit Live-restic-Ausgabe.

## Projektdetails
Drei Tabs in `?tab=`:
- **Plan** — Dateien, DBs, Traefik umschalten.
- **Zeitplan** — täglich / wöchentlich / eigenes cron, inline validiert.
- **Restore-Test** — letzter Drill-Status (Verifiziert / Fehlgeschlagen).

## Snapshots
Projekt wählen, Wiederherstellungspunkt auswählen, **Wiederherstellen**. Dialog verlangt exakte Eingabe des Projektnamens. Standard: neuer Ort; Überschreiben ist bewusst aktiv zu wählen.

## Einstellungen
Drei Tabs in `?tab=`: Speicher, Aufbewahrung, Verschlüsselungspasswort (Rotation mit Escrow-Häkchen).
