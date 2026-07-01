# Recuperación de arranque

Este runbook cubre el escenario "el VPS de producción se ha ido". Asume que
solo sobrevivieron tres cosas:

1. El **VPS de almacenamiento** (con sus repositorios restic intactos).
2. La **`MASTER_ENCRYPTION_KEY`** (respaldada fuera de banda).
3. Su **sobre de exportación de configuración** guardado
   (`dockstash-export-*.json`).

Sin las tres, los repositorios son irrecuperables — el sobre de exportación
es inerte sin la clave maestra, y la clave maestra es inútil sin los
repositorios de almacenamiento a los que apuntar.

## 1. Levantar un agente nuevo

Provisione un VPS de producción limpio. Clone el repositorio, complete
`.env` y levante el stack:

```bash
docker compose up -d
```

Los servicios `api`, `web`, `mongo`, `redis` y `docker-socket-proxy` se
levantan contra una Mongo vacía. Aún no se ve ningún proyecto.

## 2. Suministrar la misma `MASTER_ENCRYPTION_KEY`

Complete `./secrets/master_encryption_key` con la clave byte-idéntica del
agente anterior. **No genere** una nueva — cada texto cifrado en el sobre de
exportación está ligado a esta clave.

## 3. Importar el sobre de exportación

Inicie sesión como cualquier usuario con la misma identidad que el
propietario anterior, luego POST el sobre guardado a
`/api/recovery/import`:

```bash
curl -X POST http://localhost:8080/api/recovery/import \
  -H "Authorization: JWT $TOKEN" \
  -H "Content-Type: application/json" \
  -d @dockstash-export-2026-07-01.json
```

La importación valida la forma del sobre (`.strict()` zod), rechaza cualquier
campo que parezca un secreto en texto plano y descifra cada texto cifrado
con su clave maestra. Un sobre alterado, o un sobre cuya `keyVersion` este
agente no puede descifrar, es rechazado con `HTTP 400`.

## 4. Confirmar accesibilidad del almacenamiento

Tras la importación, `restic snapshots` se ejecuta contra el repositorio de
cada proyecto usando la contraseña descifrada. Una respuesta verde confirma:

- El VPS de almacenamiento es accesible.
- La contraseña se descifra bajo la `MASTER_ENCRYPTION_KEY` actual.
- El repositorio no está corrupto.

## 5. Restaurar

Dispare un simulacro de restauración desde el panel o vía el planificador.
Los snapshots se restauran en un espacio de trabajo temporal y se comparan
byte/fila contra los metadatos esperados.

## La invariante de las tres cosas

**Perder la clave maestra o los códigos de recuperación deja el sobre de
exportación inerte.** El sobre lleva solo texto cifrado AES-256-GCM. Es
seguro almacenarlo fuera del servidor precisamente porque una copia en las
manos equivocadas es inútil sin la clave.

Almacene `MASTER_ENCRYPTION_KEY` y los códigos de recuperación en soportes
separados, en ubicaciones físicas separadas, y nunca en el mismo respaldo
que el sobre.
