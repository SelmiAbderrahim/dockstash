# Copia interna

El orquestador respalda **su propio** Mongo — proyectos, horarios, secretos
cifrados, historial de respaldos — hacia el VPS de almacenamiento como un
repositorio restic dedicado distinto del repositorio de cada proyecto de
usuario.

## Qué se captura

- Documentos `Project` (rutas, plan, contraseñas de repositorio cifradas).
- Documentos `Schedule` (cron, retención, tipo).
- Secretos cifrados (token de Polar, clave SSH de almacenamiento,
  contraseñas de repositorios restic) — como texto cifrado, nunca en claro.
- Filas de historial de respaldo / verificación / simulacro.

El orquestador transmite `mongodump --archive --oplog` directamente a
`restic backup --stdin` — nunca se escribe un archivo temporal. `--oplog`
garantiza consistencia en un punto en el tiempo a través de todas las
colecciones.

## El repositorio reservado

La copia interna escribe en `SELF_BACKUP_REPO` (por defecto
`dockstash-self`) — un identificador reservado que nunca colisiona con un
proyecto de usuario. La cola BullMQ por proyecto (prompt 05) serializa los
ticks cron concurrentes contra este repositorio, de modo que restic nunca
ve dos operaciones simultáneas contra el mismo repositorio.

## Horario

La cadencia es `SELF_BACKUP_CRON` (por defecto nocturno a las
`0 3 * * *`), registrado junto a los otros trabajos cron. El nuevo registro
al arrancar es idempotente — la entrada cron se reemplaza en su lugar,
nunca se apila.

## Semántica de fallo

Cada ejecución persiste una fila `SelfBackupRun`: `running` → `success` al
escribir, o `running` → `failed` si alguna capa falla. No hay `success`
parcial. Si `mongodump` falla, `restic backup` nunca se invoca. Si
`restic backup` falla, el flujo del archivo se destruye. El fallo se
almacena en la fila junto con el mensaje de error.
