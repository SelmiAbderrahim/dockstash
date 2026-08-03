# Copia interna

El orquestador respalda **su propio** Mongo en un repositorio restic dedicado.
Compose usa por defecto el volumen persistente `self-backup-data`.

## Qué se captura

- Documentos `Project` (rutas, plan, contraseñas de repositorio cifradas).
- Documentos `Schedule` (cron, retención, tipo).
- Secretos cifrados (clave SSH de almacenamiento,
  contraseñas de repositorios restic) — como texto cifrado, nunca en claro.
- Filas de historial de respaldo / verificación / simulacro.

El orquestador transmite `mongodump --archive` directamente a
`restic backup --stdin` — nunca se escribe un archivo temporal.

## El repositorio reservado

La copia interna escribe en `SELF_BACKUP_REPO` (valor Compose:
`/self-backup`). El volumen sobrevive a la recreación de contenedores, pero
sigue en el mismo host; para protección externa configura una URL restic
remota y sus credenciales.

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
