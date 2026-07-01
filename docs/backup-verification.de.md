# Backup-Verifikation

Ein Backup ist unbewiesen, bis es wiederhergestellt wurde. Dockstash beweist
das auf zwei Wegen:

## `restic check` — strukturelle Integrität

Führt `restic check` gegen das Repository aus. Erkennt fehlende Pack-Dateien,
beschädigte Index-Einträge und Drift bei Blob-Referenzen. Wenn Sie
`readDataSubset` (Prozentwert 1–100) übergeben, hängt Dockstash
`--read-data-subset=<pct>%` an, damit restic Pack-Inhalte tatsächlich liest.

- `POST /api/backups/:id/check` auf Abruf.
- Vom Queue-Layer über `runScheduledChecks` geplant.
- Persistiert `lastCheckAt`, `lastCheckStatus` (`pass` / `fail`) und ein
  lokalisiertes `lastCheckDetail`.
- `pass` verlangt Exit-Code null — jeder andere Exit ist `fail`.

## Wiederherstellungs-Drill — die echte Garantie

`restic check` beweist, dass das Repo *wohlgeformt* ist. Erst eine Restore
beweist, dass es *wiederherstellt*. `runRestoreDrill`:

1. Liest den neuesten Snapshot.
2. Stellt ihn in einen isolierten Scratch-Workspace wieder her.
3. Byte-Hasht jeden Quellpfad gegen den restaurierten Spiegel.
4. Zeilen-Diff jedes DB-Layers zwischen restauriertem Dump und Quelle.
5. Summiert Abweichungen. `pass` nur bei Anzahl null.
6. Persistiert `lastDrillAt`, `lastDrillStatus` und `lastDrillDetail`.
7. Räumt Scratch in `finally` auf.

## Kadenz

- Struktur-Check: günstig; nach jedem Backup und täglich.
- Wiederherstellungs-Drill: teuer; mindestens wöchentlich pro Projekt.
