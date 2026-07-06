// Textos en español del guía de MongoDB. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.mongodb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MONGODB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta MongoDB",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio MongoDB. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que MongoDB fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen mongo y añade una capa de base de datos con el comando de volcado correcto — más el nombre del contenedor resuelto y las claves encontradas (MONGO_INITDB_ROOT_USERNAME, MONGO_INITDB_ROOT_PASSWORD, MONGO_INITDB_DATABASE). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el volcado a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta el mismo volcado que ejecutará Dockstash — mongodump escribiendo un archivo único a stdout, redirigido a un contador de bytes. Un total de bytes grande y distinto de cero prueba que el archivo fluye limpio. Ese archivo es lo que se respalda, nunca el directorio vivo /data/db.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor por defecto correcto para la mayoría de proyectos MongoDB. Añade un prune semanal con tu política de retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash ejecuta mongodump con --archive y --oplog dentro del contenedor y envía el archivo directamente a restic — sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de MongoDB solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a un staging nuevo, reproduces allí el archivo, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila es un archivo mongodump completo — todas las bases y colecciones, más las entradas de oplog capturadas durante el volcado — junto a los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "En el contenedor de prueba, lista las bases con mongosh, confirma que cada una volvió y sondea las colecciones de tu aplicación. Recuentos de documentos y registros recientes son la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El volcado falla con « --oplog mode only supported on replica set members » (o similar).",
      cause: "Tu mongod corre en standalone. --oplog necesita un oplog que leer, y solo los miembros de un replica set lo mantienen — en un servidor standalone no hay nada que capturar.",
      fix: "Convierte a replica set de un solo nodo: arranca mongod con --replSet rs0 y ejecuta rs.initiate() una vez. Mismo contenedor, mismos datos, y ganas la garantía point-in-time.",
    },
    {
      symptom: "mongodump falla con « Authentication failed » aunque compose define MONGO_INITDB_ROOT_USERNAME.",
      cause: "Las variables MONGO_INITDB_* solo crean el usuario en la primera inicialización de un volumen /data/db vacío. Si el volumen ya existía, o las credenciales cambiaron después, los valores del compose ya no reflejan la realidad.",
      fix: "Autentícate con las credenciales que realmente existen en la base (compruébalo con mongosh), o recrea el usuario, y alinea después el env del compose.",
    },
    {
      symptom: "mongorestore en un contenedor de prueba falla con un error de versión no soportada o de archivo inválido.",
      cause: "El archivo viene de un servidor o mongodump más nuevo de lo que entiende el destino — restaurar un archivo de mongo:7 en mongo:5 no está soportado.",
      fix: "Restaura en la misma versión mayor del volcado (por ejemplo mongo:7) y mantén mongodump/mongorestore de la misma versión de Database Tools. Subir de versión lo hace el servidor tras la restauración, no mongorestore.",
    },
    {
      symptom: "Una ejecución de respaldo falla con un candado restic obsoleto tras un fallo o reinicio.",
      cause: "Un job anterior murió a mitad de ejecución y dejó el repositorio bloqueado.",
      fix: "No hay nada que hacer a mano: la siguiente ejecución detecta el candado huérfano y ejecuta restic unlock automáticamente antes de continuar. Si las ejecuciones siguen fallando, revisa el panel de logs en vivo para ver el error de fondo.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre los archivos WiredTiger vivos de /data/db — copiados a mitad de checkpoint son inconsistentes y a menudo irrecuperables.",
    "--oplog exige que el servidor sea miembro de un replica set (aunque sea de un solo nodo); en un mongod standalone es un no-op sin garantía point-in-time.",
    "Al restaurar, --oplogReplay debe acompañar a los volcados con --oplog o se pierde la consistencia point-in-time.",
  ],
  faq: [
    {
      question: "¿Qué hace --oplog exactamente?",
      answer:
        "Registra las entradas del log de operaciones producidas mientras corre mongodump y las guarda en el archivo. Al restaurar, --oplogReplay las aplica para que el volcado refleje un único instante consistente en lugar de un difuminado sobre la ventana del volcado.",
    },
    {
      question: "¿Necesito un replica set para respaldos consistentes?",
      answer:
        "Para consistencia point-in-time, sí — --oplog solo funciona en un miembro de replica set. Muchos despliegues de un solo nodo corren como replica set de un miembro precisamente por esta garantía.",
    },
    {
      question: "¿Por qué no copiar /data/db directamente?",
      answer:
        "WiredTiger escribe checkpoints continuamente. Una copia de archivos a mitad de checkpoint captura un estado inconsistente que con frecuencia no arranca. mongodump lee una instantánea lógica y restaurable.",
    },
    {
      question: "¿Cómo restauro en una base limpia?",
      answer:
        "mongorestore --archive --oplogReplay --drop elimina las colecciones existentes antes de restaurar para no mezclar datos viejos y nuevos. Dockstash restaura primero a un destino de staging por defecto.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar MongoDB?",
      answer:
        "Diario es el valor por defecto práctico para la mayoría de proyectos; cada hora si perder un día de escrituras es inaceptable. En el plan Free los respaldos son solo manuales; Pro permite programaciones hasta cada hora, Business cualquier cron. Combina la programación con un simulacro de restauración semanal.",
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
