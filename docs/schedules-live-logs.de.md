# Zeitpläne & Live-Logs

Dockstash führt Backup- / Prune- / Check- / Drill-Jobs nach Zeitplan aus —
über eine serialisierte Queue, die **einen Job pro Repo gleichzeitig**
garantiert.

## Zeitplan-Arten

| Art | Wirkung |
|---|---|
| `backup` | Streamt DB-Dumps + sichert Pfade/Configs. |
| `prune` | `restic forget --prune` nach Retention. |
| `check` | `restic check` — Struktur-Integrität. |
| `drill` | Stellt den letzten Snapshot wieder her und diffiert. |

## Ein Job pro Repo

Zwei Zeitpläne, die gleichzeitig auf demselben Repo feuern, werden
serialisiert. Verschiedene Repos laufen parallel. Prune ist ein eigener Job —
niemals innerhalb eines Backup-Laufs.

## Retention → `forget`

```
keepDaily/keepWeekly/keepMonthly → --keep-daily/--keep-weekly/--keep-monthly
```

## Live-Logs

Jeder Job streamt restic-stdout/stderr über Socket.IO auf `/scheduler`. Mit
Ihrem JWT der Job-Room beitreten — nur eigene Jobs.

## Wiederherstellung

Nach einem Crash erkennt der nächste Versuch das verwaiste Lock und ruft
`restic unlock` sicher auf.
