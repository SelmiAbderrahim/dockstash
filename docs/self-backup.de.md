# Selbst-Backup

Der Orchestrator sichert **seine eigene** Mongo in ein dediziertes
restic-Repo. Compose verwendet standardmäßig das dauerhafte Volume
`self-backup-data`.

## Was erfasst wird

- `Project`-Dokumente (Pfade, Plan, verschlüsselte Repo-Passwörter).
- `Schedule`-Dokumente (Cron, Aufbewahrung, Art).
- Verschlüsselte Geheimnisse (Speicher-SSH-Key,
  restic-Repo-Passwörter) — als Chiffretext, niemals im Klartext.
- Backup- / Verify- / Drill-Historienzeilen.

Der Orchestrator streamt `mongodump --archive` direkt in
`restic backup --stdin` — keine temporäre Datei wird geschrieben.

## Das reservierte Repo

Selbst-Backup schreibt nach `SELF_BACKUP_REPO` (Compose-Standard:
`/self-backup`). Das Volume überlebt Container-Neuerstellungen, liegt aber
auf demselben Host; für externen Schutz ist eine entfernte restic-URL samt
Zugangsdaten zu konfigurieren.

## Zeitplan

Die Kadenz ist `SELF_BACKUP_CRON` (Standard nächtlich um `0 3 * * *`),
neben den anderen Cron-Jobs registriert. Die Neuregistrierung beim Start
ist idempotent — der Cron-Eintrag wird in-place ersetzt, niemals gestapelt.

## Fehlersemantik

Jeder Lauf persistiert eine `SelfBackupRun`-Zeile: `running` → `success`
bei Erfolg oder `running` → `failed`, wenn eine Schicht fehlschlägt. Es gibt
keinen partiellen `success`. Wenn `mongodump` fehlschlägt, wird
`restic backup` nie aufgerufen. Wenn `restic backup` fehlschlägt, wird der
Archiv-Stream zerstört. Der Fehler wird auf der Zeile mit der
Fehlermeldung gespeichert.
