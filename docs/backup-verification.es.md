# Verificación de copias de seguridad

Una copia de seguridad no está probada hasta que se restaura. Dockstash lo
prueba de dos maneras:

## `restic check` — integridad estructural

Ejecuta `restic check` contra el repositorio. Detecta archivos de paquetes
faltantes, entradas de índice corruptas y deriva de referencias de blobs.
Cuando pasas `readDataSubset` (porcentaje 1–100), Dockstash añade
`--read-data-subset=<pct>%` para que restic lea realmente el contenido.

- `POST /api/backups/:id/check` bajo demanda.
- Programado por la capa de colas vía `runScheduledChecks`.
- Persiste `lastCheckAt`, `lastCheckStatus` (`pass` / `fail`) y un
  `lastCheckDetail` localizado.
- `pass` requiere código de salida cero — cualquier otro es `fail`.

## Simulacro de restauración — la garantía real

`restic check` demuestra que el repo *está bien formado*. Solo restaurar
demuestra que *restaura*. `runRestoreDrill`:

1. Lee la última instantánea.
2. La restaura a un espacio scratch aislado.
3. Hash-byte cada ruta origen contra el espejo restaurado.
4. Diff de filas de cada capa de BD entre el dump restaurado y el origen.
5. Agrega discrepancias. `pass` solo con cero.
6. Persiste `lastDrillAt`, `lastDrillStatus` y `lastDrillDetail`.
7. Limpia el scratch en `finally`.

## Cadencia

- Chequeo estructural: barato; tras cada backup y diariamente.
- Simulacro: costoso; al menos semanal por proyecto.
