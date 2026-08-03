# Selbst-Backup

Der Orchestrator sichert **seine eigene** Mongo — Projekte, Zeitpläne,
verschlüsselte Geheimnisse, Backup-Historie — auf den Speicher-VPS in einem
dedizierten restic-Repo, getrennt von jedem Repo eines Benutzerprojekts.

## Was erfasst wird

- `Project`-Dokumente (Pfade, Plan, verschlüsselte Repo-Passwörter).
- `Schedule`-Dokumente (Cron, Aufbewahrung, Art).
- Verschlüsselte Geheimnisse (Speicher-SSH-Key,
  restic-Repo-Passwörter) — als Chiffretext, niemals im Klartext.
- Backup- / Verify- / Drill-Historienzeilen.

Der Orchestrator streamt `mongodump --archive --oplog` direkt in
`restic backup --stdin` — keine temporäre Datei wird jemals geschrieben.
`--oplog` garantiert Zeitpunkt-Konsistenz über alle Collections.

## Das reservierte Repo

Selbst-Backup schreibt nach `SELF_BACKUP_REPO` (Standard `dockstash-self`) —
eine reservierte Kennung, die niemals mit einem Benutzerprojekt kollidiert.
Die Pro-Projekt-BullMQ-Warteschlange (Prompt 05) serialisiert gleichzeitige
Cron-Ticks gegen dieses Repo, sodass restic nie zwei gleichzeitige
Operationen auf demselben Repository sieht.

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
