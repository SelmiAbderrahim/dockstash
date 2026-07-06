// Textos en español del guía de InfluxDB. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.influxdb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const INFLUXDB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta InfluxDB",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio InfluxDB. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que InfluxDB fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen influxdb y su versión mayor, y añade una capa con el comando de respaldo correcto — influx backup para v2, influxd backup -portable para v1 — más el nombre del contenedor resuelto y las claves encontradas (DOCKER_INFLUXDB_INIT_USERNAME, DOCKER_INFLUXDB_INIT_PASSWORD, DOCKER_INFLUXDB_INIT_ORG). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el comando de respaldo a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta influx backup hacia una ruta temporal en el contenedor. Lo verás escribir archivos de shards y metadatos mientras captura cada bucket por la API HTTP — esa instantánea coordinada por el motor es lo que se respalda, nunca el directorio TSM vivo.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Las series temporales se acumulan rápido: diario es el valor correcto — cada hora si tus métricas son críticas. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash ejecuta el comando correcto para la versión dentro del contenedor — influx backup por la API HTTP en v2, influxd backup -portable en v1 — y envía la instantánea directamente a restic. Sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de InfluxDB solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tus series temporales vivas por defecto — primero restauras a una ubicación nueva, verificas los buckets y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila es una instantánea consistente a nivel de motor de tus shards TSM y metadatos — buckets, políticas de retención y usuarios — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Carga el respaldo restaurado en un contenedor InfluxDB de prueba con influx restore (o influxd restore -portable en v1) y lista los buckets. Cada bucket esperado debe aparecer con su política de retención; una consulta rápida sobre un rango temporal reciente confirma que los últimos puntos están dentro.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El comando de respaldo falla con « unknown command » u opciones no reconocidas.",
      cause: "Las líneas de comando v1 y v2 son totalmente distintas: v2 usa influx backup contra la API HTTP, v1 usa influxd backup -portable. Ejecutar el comando de una generación contra la otra falla al instante — habitual tras subir el tag de la imagen.",
      fix: "Comprueba la versión mayor del contenedor (influxd version) y usa el comando correspondiente. Dockstash detecta la versión mayor por la imagen y elige bien automáticamente; relanza la detección en la pestaña Plan tras una subida de versión.",
    },
    {
      symptom: "influx backup falla con « unauthorized » o un 401 de la API.",
      cause: "Los respaldos v2 pasan por la API HTTP y requieren un token operador (all-access). Un token de solo lectura — o ninguno con la autenticación activada — no basta.",
      fix: "Provee un token operador con lectura sobre los buckets. Si usaste las claves DOCKER_INFLUXDB_INIT_*, el token admin de inicialización sirve; si no, crea uno con influx auth create --all-access y añádelo a las credenciales del plan.",
    },
    {
      symptom: "Un respaldo hecho copiando /var/lib/influxdb2 no arranca, o las consultas devuelven datos parciales.",
      cause: "InfluxDB compacta shards TSM en segundo plano. Una copia cruda del directorio vivo atrapa shards a mitad de compactación — unos archivos de antes, otros de después — produciendo un almacén roto e inconsistente.",
      fix: "Nunca copies el directorio de datos vivo. Usa el comando de respaldo del motor, que captura shards y metadatos de forma consistente — es lo que ejecuta Dockstash. Una copia cruda rota suele ser irrecuperable; restaura desde un respaldo real.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio TSM/WAL vivo — los shards se compactan en segundo plano, una copia cruda es inconsistente.",
    "InfluxDB v2 usa `influx backup` (API HTTP + token); v1 usa `influxd backup -portable`. Dockstash detecta la versión mayor.",
    "Los respaldos v2 necesitan un token operador con lectura; sin él la llamada queda no autorizada.",
  ],
  faq: [
    {
      question: "¿Qué comando respalda InfluxDB correctamente?",
      answer:
        "Para v2, `influx backup` contra la API HTTP con token operador. Para v1, `influxd backup -portable`. Ambos capturan shards TSM y metadatos de forma consistente. Dockstash detecta la versión y ejecuta el correcto.",
    },
    {
      question: "¿Puedo copiar los archivos de shards directamente?",
      answer:
        "No. InfluxDB compacta shards TSM en segundo plano: una copia del directorio vivo es inconsistente. Usa el comando de respaldo, que coordina una instantánea consistente a través del motor.",
    },
    {
      question: "¿Qué token necesita el respaldo v2?",
      answer:
        "Un token operador (all-access) con permiso de lectura sobre los buckets. Dockstash detecta las claves de env del token inicial; provee un token si la autenticación está activa.",
    },
    {
      question: "¿Cómo restauro un respaldo de series temporales?",
      answer:
        "Usa `influx restore` (v2) o `influxd restore -portable` (v1) contra una instancia nueva. Dockstash restaura primero a una instancia de staging antes de cualquier sobrescritura.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar InfluxDB?",
      answer:
        "Diario sirve para la mayoría de cargas de métricas; cada hora si perder una hora de puntos dolería. En Free los respaldos son Backup Now manuales; Pro añade programaciones hasta cada hora, Business cualquier cron. Acompaña con un simulacro semanal.",
    },
    {
      question: "¿El respaldo bloquea las escrituras de InfluxDB?",
      answer:
        "No. El comando de respaldo captura shards a través del motor mientras el servidor sigue aceptando escrituras — tus colectores y dashboards siguen funcionando durante el respaldo.",
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
