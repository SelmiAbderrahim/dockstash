// Textos en español del guía de Redis. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.redis walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const REDIS_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta Redis",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio Redis. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que Redis fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen redis y añade una capa de base de datos con la estrategia correcta de guardar-y-capturar — más el nombre del contenedor resuelto y las claves encontradas (REDIS_PASSWORD, REDIS_ARGS). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba la instantánea a mano",
      body: "Si quieres una prueba antes de automatizar, dispara el mismo guardado que Dockstash: ejecuta redis-cli BGSAVE en el contenedor. Redis responde « Background saving started », bifurca y escribe un dump.rdb a instante preciso en /data. Ese archivo RDB terminado — nunca el estado vivo en memoria — es lo que se respalda.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Para un Redis usado como almacén principal (colas, sesiones), diario es un suelo razonable y cada hora es habitual. Añade un prune semanal con tu política de retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash dispara un guardado en segundo plano, espera el dump.rdb terminado y lo respalda — junto con appendonly.aof cuando la persistencia AOF está activa — directamente en restic. Sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de Redis solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu instancia viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila contiene un dump.rdb completo a instante preciso (más el AOF si está activado) y los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Coloca el dump.rdb restaurado en el directorio de datos de un contenedor Redis de prueba y arráncalo — Redis carga el RDB al inicio. Ejecuta redis-cli PING: debes recibir PONG; luego sondea las claves de tu aplicación con DBSIZE y algunos GET.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El dump.rdb restaurado no carga: « Short read or OOM loading DB » o error de archivo truncado.",
      cause: "El RDB se copió mientras Redis aún lo reescribía — una captura a mitad de reescritura produce un archivo parcial.",
      fix: "Dispara siempre SAVE o BGSAVE y espera a que termine antes de capturar dump.rdb. Dockstash hace exactamente eso: dispara el guardado, espera el final y respalda el archivo terminado.",
    },
    {
      symptom: "Una restauración funciona pero faltan las escrituras más recientes.",
      cause: "La persistencia AOF está activa y appendonly.aof contenía escrituras más nuevas que la instantánea RDB — el RDB solo va con retraso.",
      fix: "Respalda ambos archivos. Dockstash captura /data/dump.rdb y appendonly.aof juntos en la misma ejecución.",
    },
    {
      symptom: "Colocaste el dump.rdb restaurado en /data pero el Redis en marcha sigue sirviendo datos viejos.",
      cause: "Redis solo lee el RDB al arrancar — no se puede intercambiar en caliente. Y con appendonly activo, Redis carga el AOF al inicio e ignora el RDB por completo.",
      fix: "Para el contenedor, coloca el dump.rdb restaurado (y el AOF si restauraste uno) en el directorio de datos y arráncalo de nuevo. Si solo restauraste un RDB en un montaje con AOF, pon temporalmente appendonly no para el primer arranque y reactívalo después.",
    },
    {
      symptom: "BGSAVE falla con « Can't save in background: fork: Cannot allocate memory ».",
      cause: "El fork necesario para el guardado en segundo plano fue denegado por las heurísticas de overcommit de memoria del kernel, en un host con un conjunto de datos Redis grande.",
      fix: "Configura vm.overcommit_memory=1 en el host Docker (sysctl) — el ajuste que el propio Redis recomienda al arrancar. El fork usa copy-on-write: no necesita una segunda copia completa del conjunto de datos.",
    },
  ],
  gotchas: [
    "Copiar un dump.rdb en plena reescritura da un archivo truncado; dispara SAVE (o BGSAVE) primero y respalda el RDB terminado.",
    "Si la persistencia AOF está activa, respalda también los archivos appendonly.aof — el RDB solo puede ir por detrás de las últimas escrituras.",
    "La restauración de Redis exige un servidor parado o reiniciado para cargar el RDB; no se puede intercambiar dump.rdb en caliente en una instancia en marcha.",
  ],
  faq: [
    {
      question: "¿Vale la pena respaldar Redis siquiera?",
      answer:
        "Depende del uso. Como caché puro, un Redis perdido se repuebla solo. Como almacén principal (colas, sesiones, sorted sets), sí — respalda el RDB, y el AOF si está activado.",
    },
    {
      question: "SAVE o BGSAVE — ¿cuál usa Dockstash?",
      answer:
        "BGSAVE bifurca y hace la instantánea en segundo plano sin bloquear; SAVE bloquea hasta terminar. Dockstash prefiere el guardado en segundo plano y respalda después el dump.rdb terminado.",
    },
    {
      question: "¿Qué pasa con el AOF (append-only file)?",
      answer:
        "Si appendonly está activo, el AOF contiene las escrituras más recientes que el RDB quizá aún no refleja. Dockstash captura /data/dump.rdb y appendonly.aof para no perder datos recientes.",
    },
    {
      question: "¿Puedo copiar dump.rdb mientras Redis corre?",
      answer:
        "Solo tras un SAVE/BGSAVE completado. Copiar durante una reescritura puede atrapar un archivo parcial. Dockstash dispara el guardado y espera a que termine antes de capturar.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar Redis?",
      answer:
        "Ajusta la programación a lo que Redis contiene. Para colas y sesiones, cada hora es habitual; para datos más lentos, diario basta. En el plan Free los respaldos son manuales (Backup Now); Pro permite hasta cada hora, Business cualquier expresión cron.",
    },
    {
      question: "¿Dónde viven realmente los respaldos?",
      answer:
        "En tu propio VPS de almacenamiento, como instantáneas restic cifradas enviadas por SSH. Dockstash nunca guarda tus datos en una nube de terceros — lo apuntas a una máquina que controlas, y el repositorio está cifrado con una contraseña que solo tú tienes.",
    },
    {
      question: "¿Cómo sé que un respaldo de Redis realmente se restaura?",
      answer:
        "Programa un simulacro de restauración. Dockstash restaura la última instantánea en un espacio aislado, compara cada archivo byte a byte con la fuente y verifica el volcado capturado — luego estampa una insignia de éxito/fallo en el proyecto. Un simulacro semanal es prueba siempre fresca.",
    },
  ],
};
