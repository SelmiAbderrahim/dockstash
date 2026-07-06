// Textos en español del guía de SQLite. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.sqlite walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const SQLITE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que incorpora SQLite",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto cuya app guarda sus datos en un archivo SQLite — PocketBase, Vaultwarden, Uptime Kuma, Gitea y Ghost lo hacen. Aún no se respalda nada.",
    },
    'review-detection': {
      title: "Comprueba que SQLite fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. SQLite no tiene contenedor propio — vive dentro de la imagen de tu app —, así que Dockstash lo localiza por las claves de entorno que apuntan al archivo de base (DATABASE_PATH, DATABASE_URL, DB_PATH) y añade una capa que lo captura con la API de respaldo en línea. Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el respaldo a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta el mismo comando que Dockstash: sqlite3 /data/app.db \".backup '/tmp/app-backup.db'\" en el contenedor de la app. No imprime nada si tiene éxito y deja una copia completa y consistente en /tmp/app-backup.db — contenido del WAL incluido. Esa copia es lo que se respalda, nunca el archivo .db vivo.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor por defecto correcto para la mayoría de apps sobre SQLite. Añade un prune semanal con tu política de retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash ejecuta el comando .backup en el contenedor de la app para producir una copia consistente de la base y la envía — junto con los archivos del proyecto — a restic. Sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de SQLite solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila contiene una copia monofichero consistente de la base — producida por la API de respaldo en línea, sin sidecars -wal ni -shm que reconciliar — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Ejecuta sqlite3 <archivo-restaurado> \"PRAGMA integrity_check;\" — una base sana responde con un único « ok ». Abre luego el archivo con sqlite3 y sondea las tablas de tu app: recuentos de filas y registros recientes son la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados: para la app, sustituye su archivo de base por la copia restaurada y arranca de nuevo (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro semanal produzca esta prueba automáticamente.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "La base restaurada abre pero faltan las filas más recientes.",
      cause: "El respaldo fue una copia cruda solo del archivo .db mientras la app corría en modo WAL — las escrituras más nuevas seguían en el sidecar -wal y nunca llegaron a la copia.",
      fix: "Nunca copies en crudo una base WAL viva. Usa sqlite3 \".backup\" o VACUUM INTO, que pasan por la API de respaldo en línea y pliegan el WAL en la copia. Dockstash usa la API de respaldo precisamente por esto.",
    },
    {
      symptom: "El comando .backup falla con « database is locked ».",
      cause: "Una transacción de escritura larga (o un escritor colgado) retiene el candado de la base, y sqlite3 desistió antes de que se liberara.",
      fix: "Define un busy timeout (sqlite3 -cmd \".timeout 30000\" o PRAGMA busy_timeout) para que el respaldo espere en lugar de fallar, y programa los respaldos a una hora tranquila. Si el candado nunca se libera, busca un proceso escritor colgado en el contenedor.",
    },
    {
      symptom: "PRAGMA integrity_check sobre un archivo copiado responde « database disk image is malformed ».",
      cause: "El archivo se copió mientras la app escribía en él — una captura de página rota que ninguna herramienta repara de forma fiable.",
      fix: "Descarta la copia rota y restaura desde una instantánea producida por la API de respaldo. Cada instantánea de Dockstash se toma con \".backup\": integrity_check debe responder « ok » — exactamente lo que comprueba el paso de verificación.",
    },
    {
      symptom: "Ejecutaste PRAGMA wal_checkpoint(TRUNCATE) antes de una copia cruda, pero la copia sigue inconsistente.",
      cause: "Un checkpoint pliega las páginas WAL en el archivo principal en un instante, pero los escritores pueden añadir nuevos frames WAL en cuanto termina — checkpoint y luego cp no es una instantánea atómica bajo escrituras concurrentes.",
      fix: "Trata « checkpoint y copia » como una idea equivocada, no una técnica. La única instantánea en caliente segura es la API de respaldo en línea (\".backup\" o VACUUM INTO); la copia cruda solo es segura con la app parada.",
    },
  ],
  gotchas: [
    "Nunca copies un archivo .db vivo mientras la app corre en modo WAL — perderás los sidecars -wal/-shm y capturarás una base rota, irrecuperable.",
    "Usa sqlite3 \".backup\" o « VACUUM INTO », que pasan por la API de respaldo en línea y manejan el WAL correctamente.",
    "Un checkpoint (PRAGMA wal_checkpoint(TRUNCATE)) antes de una copia cruda no sustituye a la API de respaldo bajo escrituras concurrentes.",
  ],
  faq: [
    {
      question: "¿No puedo simplemente copiar el archivo .db?",
      answer:
        "No con seguridad mientras la app escribe. En modo WAL los datos más nuevos viven en el sidecar -wal; un simple cp solo del .db captura un estado obsoleto y roto. Usa sqlite3 \".backup\" o « VACUUM INTO », que leen una copia consistente vía la API de respaldo en línea.",
    },
    {
      question: "¿Qué es VACUUM INTO?",
      answer:
        "VACUUM INTO 'file.db' escribe una copia fresca, desfragmentada y transaccionalmente consistente de la base en un archivo nuevo. Una forma limpia de capturar una base SQLite viva sin parar la app.",
    },
    {
      question: "¿Debo respaldar los archivos -wal y -shm?",
      answer:
        "Con la API de respaldo, no — consolida el WAL en la copia. Si insistes en una copia cruda (no recomendada en caliente), debes incluir -wal y -shm, y aun así queda expuesta a carreras.",
    },
    {
      question: "¿Cómo restauro un respaldo de SQLite?",
      answer:
        "Para la app, sustituye el archivo de base por la salida de .backup y arranca la app. Como el respaldo es un único archivo consistente, no hay sidecars que reconciliar.",
    },
    {
      question: "Mi app incorpora SQLite (PocketBase, Vaultwarden, Uptime Kuma) — ¿Dockstash la encontrará?",
      answer:
        "Sí. No hay contenedor SQLite separado que detectar: Dockstash lee la config compose y las claves de entorno de la app (DATABASE_PATH, DATABASE_URL, DB_PATH) para localizar el archivo, y lo captura con la API de respaldo. Revisa la ruta detectada en la pestaña Plan antes de la primera ejecución.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar SQLite?",
      answer:
        "Diario es el valor por defecto práctico para la mayoría de apps monofichero; cada hora si perder un día de escrituras es inaceptable. En el plan Free los respaldos son manuales (Backup Now); Pro permite hasta cada hora, Business cualquier expresión cron.",
    },
    {
      question: "¿Dónde viven realmente los respaldos?",
      answer:
        "En tu propio VPS de almacenamiento, como instantáneas restic cifradas enviadas por SSH. Dockstash nunca guarda tus datos en una nube de terceros — lo apuntas a una máquina que controlas, y el repositorio está cifrado con una contraseña que solo tú tienes.",
    },
    {
      question: "¿Cómo sé que el respaldo es restaurable sin hacer una restauración manual?",
      answer:
        "Programa un simulacro de restauración. Dockstash restaura la última instantánea en un espacio de trabajo aislado, compara cada archivo byte a byte con la fuente y verifica el volcado restaurado — luego estampa una insignia de éxito/fallo en el proyecto. Un simulacro semanal significa prueba siempre fresca.",
    },
  ],
};
