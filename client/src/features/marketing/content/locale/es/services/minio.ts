// Textos en español del guía de MinIO. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.minio walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MINIO_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta MinIO",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio MinIO. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que MinIO fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen minio/minio y añade una capa de object store construida alrededor de mc mirror — más el nombre del contenedor resuelto y las claves encontradas (MINIO_ROOT_USER, MINIO_ROOT_PASSWORD, o el par antiguo MINIO_ACCESS_KEY / MINIO_SECRET_KEY). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el listado de buckets a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta mc ls contra el alias local dentro del contenedor. Deberías ver cada bucket con su tamaño y número de objetos — esos buckets son exactamente lo que mc mirror copiará por la API S3, objeto a objeto, nunca el directorio crudo /data.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor correcto para la mayoría de object stores — los espejos son incrementales, las siguientes ejecuciones solo copian lo cambiado. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash ejecuta mc mirror en el contenedor para copiar cada bucket por la API S3 — capturando cada objeto de forma atómica con sus metadatos — y envía el resultado a restic. Sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de MinIO solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tus buckets vivos por defecto — primero restauras a una ubicación nueva, verificas los objetos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila es un espejo completo a nivel de API de tus buckets — cada objeto con sus metadatos y tags — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los objetos restaurados",
        body: "Refleja el bucket restaurado en una instancia MinIO de prueba y lista su contenido con mc ls. Compara número de objetos y tamaño total con el bucket vivo, y sondea algunos objetos que tu app realmente sirve — una descarga que abre correctamente es la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Una copia restaurada del directorio /data no sirve objetos, o MinIO registra errores de xl.meta al arrancar.",
      cause: "El respaldo se hizo copiando el directorio crudo /data en lugar de reflejar por la API S3. MinIO guarda cada objeto junto a archivos de metadatos xl.meta; una copia cruda que los pierda o rompa deja los objetos ilegibles.",
      fix: "Respalda con mc mirror por la API S3 — el enfoque que Dockstash configura por defecto. Si heredas un respaldo de copia cruda, restáuralo en un MinIO parado de la misma versión y verifica cada bucket con mc ls antes de fiarte.",
    },
    {
      symptom: "Faltan en el respaldo algunos objetos subidos recientemente.",
      cause: "Eran subidas multipart en curso cuando corrió el espejo — las subidas incompletas son invisibles para el listado S3 hasta que llega la última parte, y una copia cruda las capturaría como fragmentos inservibles.",
      fix: "Nada está corrupto: el siguiente espejo programado recoge los objetos completados. Si una subida concreta importa, relanza Backup Now tras su finalización, o programa los respaldos fuera de tus ventanas de subida intensiva.",
    },
    {
      symptom: "Un bucket versionado se restaura con una sola versión de cada objeto.",
      cause: "Un mc mirror simple copia el estado actual de cada objeto — las versiones anteriores no se replican sin replicación de versiones explícita.",
      fix: "Si dependes del versionado para recuperación point-in-time, refleja las versiones explícitamente (mc mirror con replicación de versiones), o trata la propia línea de tiempo de instantáneas de Dockstash como tu historial de versiones — cada instantánea diaria preserva el estado de ese día.",
    },
    {
      symptom: "Los comandos mc fallan con « Access Denied » o « invalid credentials ».",
      cause: "Las credenciales del compose cambiaron (por ejemplo al rotar MINIO_ROOT_USER / MINIO_ROOT_PASSWORD) pero el alias mc configurado en el contenedor conserva el par antiguo.",
      fix: "Recrea el contenedor para que el alias se reconstruya desde el env actual, o vuelve a ejecutar mc alias set dentro del contenedor con las nuevas credenciales, y relanza el respaldo.",
    },
  ],
  gotchas: [
    "Prefiere mc mirror a copiar el directorio crudo /data — MinIO guarda objetos más metadatos xl.meta, y una copia cruda puede perder subidas multipart en curso.",
    "Refleja por la API S3 para preservar de forma consistente metadatos, versiones y tags de los objetos.",
    "Para buckets versionados, replica las versiones explícitamente o solo capturas el último estado de cada objeto.",
  ],
  faq: [
    {
      question: "¿Respaldo MinIO con mc mirror o con copia de archivos?",
      answer:
        "Con mc mirror. Lee los objetos por la API S3: cada objeto y sus metadatos se capturan de forma atómica. Una copia cruda de /data puede atrapar subidas multipart en curso o perder la estructura de metadatos.",
    },
    {
      question: "¿mc mirror preserva versiones y tags?",
      answer:
        "Preserva metadatos y tags de los objetos. Para buckets versionados debes reflejar las versiones explícitamente, o solo se captura la versión actual de cada objeto.",
    },
    {
      question: "¿Puedo restaurar en una instancia MinIO nueva?",
      answer:
        "Sí. Apunta mc a la nueva instancia, crea el bucket destino y refleja de vuelta el directorio del respaldo. Dockstash entrega los objetos reflejados a restic entre pasos.",
    },
    {
      question: "¿Copiar /data es aceptable alguna vez?",
      answer:
        "Solo con MinIO totalmente parado y sin escrituras en vuelo — y aun así la estructura de metadatos debe preservarse exactamente. El espejo a nivel de API es el enfoque más seguro y soportado.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar MinIO?",
      answer:
        "Diario es el valor práctico — mc mirror es incremental, un día tranquilo no cuesta casi nada. En Free los respaldos son Backup Now manuales; Pro añade programaciones hasta cada hora, Business cualquier cron. Acompaña con un simulacro semanal.",
    },
    {
      question: "¿Dónde viven realmente los respaldos?",
      answer:
        "En tu propio VPS de almacenamiento, como instantáneas restic cifradas enviadas por SSH. Dockstash nunca guarda tus datos en una nube de terceros — lo apuntas a una máquina que controlas, y el repositorio está cifrado con una contraseña que solo tú tienes.",
    },
    {
      question: "¿Cómo sé que el respaldo es restaurable sin una restauración manual?",
      answer:
        "Programa un simulacro de restauración. Dockstash restaura la última instantánea en un espacio aislado y compara cada archivo restaurado byte a byte con la fuente — luego estampa una insignia de éxito/fallo en el proyecto. Un simulacro semanal prueba de forma continua que tus buckets vuelven.",
    },
  ],
};
