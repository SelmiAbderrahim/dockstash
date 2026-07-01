# Núcleo de copias de seguridad

Dockstash trata cada proyecto en `/var/www/<name>` como un paquete de cuatro
capas: archivos del proyecto, bases de datos, configuraciones del proxy
inverso y metadatos de compose. Esta página explica qué detecta
`scanProject` y cómo se ejecuta realmente una copia.

## Qué detecta `scanProject`

Dado un ruta de proyecto, `scanProject`:

1. Lee `<path>/docker-compose.yml`.
2. Recorre cada servicio. Para cada `image`, el registro de adaptadores
   (`postgres`, `mysql`, `mariadb`, `mongo`) la reclama y registra una capa
   de base de datos con el nombre de contenedor resuelto y un comando de
   volcado únicamente en formato argv.
3. Detecta rutas de configuración del proxy inverso — `/etc/traefik` para
   Traefik y `/etc/nginx` para nginx.
4. Devuelve un `plan { paths, databases[], configs[] }` editable desde la UI
   antes de guardarlo en el proyecto.

## La regla "volcar y después restic"

Los archivos de bases de datos activas **nunca** se copian del disco. Para
cada capa de base de datos habilitada, Dockstash ejecuta
`docker exec <container> <dumpCmd>` y envía el flujo directamente a
`restic backup --stdin`. Los indicadores de consistencia están integrados en
cada adaptador: `mysqldump --single-transaction`, `mongodump --oplog`,
`pg_dumpall` contra el servidor en marcha.

Cada comando es un **array argv** — sin interpolación de shell, sin `sh -c`.
Un valor de entorno como `$(rm -rf /)` se convierte en un token literal, no
en una subshell.

## Lista blanca `/var/www/*`

Cada ruta — la del proyecto, las extra del plan, las enviadas por la API —
se valida contra `/var/www/*`. Cadenas vacías, segmentos de traversal
(`..`), bytes NUL, atajos por enlaces simbólicos o cualquier ruta fuera de
`/var/www` se rechazan antes de que las vean restic o dockerode.

## Propiedad

Los proyectos están limitados por usuario. Todas las rutas `/api/backups`
requieren un JWT y cada recurso de proyecto se carga con una comprobación
de propiedad que devuelve `403` si el llamante no es el propietario. La
contraseña del repositorio Restic se guarda solo como texto cifrado con
AES-256-GCM; el texto en claro se descifra únicamente en proceso y en el
momento de ejecución, y nunca se devuelve al cliente.
