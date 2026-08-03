# Alarme, Audit und Health

Dockstash macht Fehler laut. Jede fehlgeschlagene Sicherung, Wiederherstellung
oder Übung löst sofort eine E-Mail (via Resend) an den Projektbesitzer aus. Ein
Dead-Man's-Switch-Heartbeat entdeckt stille Stillstände — den Fall, dass nichts
fehlgeschlagen ist, aber auch nichts gelaufen ist.

## Auslöser

| Art | Wann |
|---|---|
| `backup` | Ein Backup-Lauf schlägt fehl. |
| `restore` | Eine Wiederherstellung schlägt fehl. |
| `drill` | Ein geplanter Wiederherstellungstest schlägt fehl. |
| `heartbeat` | Kein erfolgreiches Backup in den letzten `ALERT_HEARTBEAT_HOURS` Stunden. |

Jede E-Mail enthält Projektname, Fehler, Zeitstempel des letzten Erfolgs und
einen Deep-Link ins Dashboard. Ist `ALERT_WEBHOOK_URL` gesetzt, wird die
gleiche Payload als JSON dorthin POSTet.

## Heartbeat-Fenster

`ALERT_HEARTBEAT_HOURS` (Standard `24`) legt die Schwelle für stille Stillstände
fest. Ist der letzte Erfolg älter, alarmiert der Sweep einmal und dedupliziert
innerhalb desselben Fensters.

## Audit-Log

Zerstörerische / abrechenbare Aktionen werden in ein unveränderliches Log
angehängt: `backup.run`, `backup.restore`, `backup.delete`, `plan.change`.
Jeder Eintrag protokolliert Akteur, Aktion, Ziel, Quell-IP und Zeitstempel.

Abruf: `GET /api/audit` (Besitzer-Scope, Auth erforderlich).

## Health- & Metrics-Endpunkte

- `GET /api/health` — Readiness-Probe (200/503).
- `GET /api/metrics` — aggregierte Zähler.
- `GET /api/health/projects` — pro Projekt, Besitzer-Scope.

## Umgebungsvariablen

| Var | Zweck |
|---|---|
| `RESEND_API_KEY` | Resend-API-Schlüssel. |
| `RESEND_FROM` | Absenderadresse. |
| `ALERT_HEARTBEAT_HOURS` | Schwelle für stille Stillstände. |
| `ALERT_WEBHOOK_URL` | Optionaler Webhook. |
