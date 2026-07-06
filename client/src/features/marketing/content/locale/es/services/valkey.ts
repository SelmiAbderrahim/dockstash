// Textos en español del guía de Valkey. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.valkey walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const VALKEY_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta Valkey",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio Valkey. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que Valkey fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen valkey/valkey y añade una capa con la estrategia correcta de guardar-y-capturar — más el nombre del contenedor resuelto y las claves encontradas (VALKEY_PASSWORD, VALKEY_ARGS y la antigua REDIS_PASSWORD). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba la instantánea a mano",
      body: "Si quieres una prueba antes de automatizar, dispara el mismo guardado que Dockstash: ejecuta valkey-cli BGSAVE en el contenedor. Valkey responde « Background saving started », bifurca y escribe un dump.rdb a instante preciso en /data — la misma persistencia RDB heredada de Redis. Ese archivo terminado es lo que se respalda, nunca el estado vivo en memoria.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Para un Valkey usado como almacén principal (colas, sesiones), diario es un suelo razonable y cada hora es habitual. Añade un prune semanal con tu política de retención.",
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
      "Un respaldo de Valkey solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu instancia viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
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
        body: "Coloca el dump.rdb restaurado en el directorio de datos de un contenedor Valkey de prueba y arráncalo — Valkey carga el RDB al inicio. Ejecuta valkey-cli PING: debes recibir PONG; luego sondea las claves de tu aplicación con DBSIZE y algunos GET.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El dump.rdb restaurado no carga: error de archivo truncado o lectura corta.",
      cause: "El RDB se copió mientras Valkey aún lo reescribía — el mismo riesgo de mitad-de-reescritura que Redis, pues Valkey conserva el modelo de persistencia RDB idéntico.",
      fix: "Dispara siempre SAVE o BGSAVE y espera a que termine antes de capturar dump.rdb. Dockstash hace exactamente eso.",
    },
    {
      symptom: "Una prueba manual con redis-cli funciona pero valkey-cli responde « not found » (o al revés).",
      cause: "El binario cliente varía según la imagen: las imágenes oficiales valkey/valkey traen valkey-cli, mientras algunas imágenes de compatibilidad enlazan redis-cli.",
      fix: "Usa el binario que traiga la imagen — protocolo y comandos son iguales. Dockstash detecta automáticamente el cliente presente; el respaldo funciona en ambos casos.",
    },
    {
      symptom: "Colocaste el dump.rdb restaurado en /data pero el Valkey en marcha sigue sirviendo datos viejos.",
      cause: "Como Redis, Valkey solo lee el RDB al arrancar — no hay intercambio en caliente. Y con appendonly activo, el AOF tiene prioridad al inicio y el RDB se ignora.",
      fix: "Para el contenedor, coloca el dump.rdb restaurado (y el AOF si procede) en el directorio de datos y arranca de nuevo. Si solo restauraste un RDB en un montaje con AOF, pon temporalmente appendonly no para el primer arranque y reactívalo después.",
    },
    {
      symptom: "Una restauración funciona pero faltan las escrituras más recientes.",
      cause: "La persistencia AOF está activa y appendonly.aof contenía escrituras más nuevas que la instantánea RDB.",
      fix: "Respalda ambos archivos. Dockstash captura /data/dump.rdb y appendonly.aof juntos en la misma ejecución.",
    },
  ],
  gotchas: [
    "Como con Redis, nunca captures un dump.rdb a mitad de reescritura — dispara SAVE/BGSAVE primero y respalda el archivo terminado.",
    "valkey-cli es el binario cliente; en algunas imágenes de compatibilidad redis-cli es un enlace simbólico — Dockstash detecta el que esté presente.",
    "Activa y captura el AOF cuando necesites las escrituras más frescas; el RDB solo puede ir por detrás.",
  ],
  faq: [
    {
      question: "¿En qué difiere respaldar Valkey de Redis?",
      answer:
        "En nada significativo. Valkey es un fork de Redis y conserva el mismo modelo de persistencia RDB y AOF. La única diferencia práctica es el nombre del binario cliente (valkey-cli), que Dockstash detecta automáticamente.",
    },
    {
      question: "¿Puedo restaurar un RDB de Redis en Valkey?",
      answer:
        "Sí para las versiones actuales — el formato RDB es compartido desde el punto del fork. A medida que los proyectos diverjan, mantén las restauraciones en el mismo motor por prudencia.",
    },
    {
      question: "¿Dockstash detecta Valkey automáticamente?",
      answer:
        "Sí. Se reconocen las imágenes valkey/valkey y el binario valkey-cli, y se captan tanto VALKEY_PASSWORD como la antigua REDIS_PASSWORD.",
    },
    {
      question: "¿Debo capturar también el AOF?",
      answer:
        "Si appendonly está activo y no puedes perder los últimos segundos de escrituras, sí. Dockstash respalda el RDB y los archivos AOF.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar Valkey?",
      answer:
        "Ajusta la programación al contenido. Para colas y sesiones, cada hora es habitual; para datos más lentos, diario basta. En el plan Free los respaldos son manuales (Backup Now); Pro permite hasta cada hora, Business cualquier expresión cron.",
    },
    {
      question: "¿Dónde viven realmente los respaldos?",
      answer:
        "En tu propio VPS de almacenamiento, como instantáneas restic cifradas enviadas por SSH. Dockstash nunca guarda tus datos en una nube de terceros — lo apuntas a una máquina que controlas, y el repositorio está cifrado con una contraseña que solo tú tienes.",
    },
    {
      question: "¿Cómo sé que un respaldo de Valkey realmente se restaura?",
      answer:
        "Programa un simulacro de restauración. Dockstash restaura la última instantánea en un espacio aislado, compara cada archivo byte a byte con la fuente y verifica el volcado capturado — luego estampa una insignia de éxito/fallo en el proyecto.",
    },
  ],
};
