// Textos en español del guía de Elasticsearch. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.elasticsearch walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const ELASTICSEARCH_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta Elasticsearch",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio Elasticsearch. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que Elasticsearch fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen elasticsearch y añade una capa construida sobre la API de snapshots — más el nombre del contenedor resuelto y las claves encontradas (ELASTIC_PASSWORD, ELASTICSEARCH_USERNAME, discovery.type). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el clúster a mano",
      body: "Si quieres una prueba antes de automatizar, consulta con curl el endpoint _cluster/health dentro del contenedor. Un estado green o yellow significa listo para el snapshot (yellow es normal en un solo nodo — los shards réplica no tienen destino). Red significa que al menos un shard primario está caído; arréglalo antes de respaldar.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Tras el asistente ya está configurado; modificable en Settings → Storage. Elasticsearch necesita además un repositorio de snapshots registrado — una ruta de sistema de archivos (lo más simple: un directorio bind-montado) o un object store — donde escribe la API de snapshots y que Dockstash entrega a restic fuera del servidor.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario es el valor correcto para la mayoría de clústeres de búsqueda — los snapshots son incrementales dentro del repositorio, cada ejecución solo guarda segmentos nuevos. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash dispara un snapshot por la API (PUT _snapshot/<repo>/<snap>): Elasticsearch escribe una vista consistente y datada de cada índice en el repositorio, que Dockstash entrega después a restic hacia tu VPS de almacenamiento — sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de Elasticsearch solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu clúster vivo por defecto — primero restauras a una ubicación nueva, verificas los índices y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila contiene el repositorio de snapshots con una vista consistente y datada de cada índice, más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Consulta _cat/indices?v en el nodo de prueba y lee la tabla: cada índice esperado debe aparecer con salud green o yellow, estado open y un docs.count acorde a producción. Sondea algunos documentos con una consulta de búsqueda.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "Las llamadas de snapshot fallan con repository_missing_exception o un error de verificación del repositorio.",
      cause: "No hay repositorio de snapshots registrado, o la ruta no está en path.repo / no es escribible desde el contenedor.",
      fix: "Bind-monta un directorio en el contenedor, añádelo a path.repo en elasticsearch.yml, reinicia y regístralo con PUT _snapshot/<repo> como repositorio fs. Los snapshots solo funcionan contra un repositorio registrado y verificado.",
    },
    {
      symptom: "La restauración se rechaza: « cannot restore index ... because an open index with same name already exists ».",
      cause: "La API de snapshots se niega a restaurar sobre un índice abierto — nunca fusiona ni sobrescribe datos vivos en silencio.",
      fix: "Cierra o elimina primero el índice existente, o restaura bajo otro nombre con rename_pattern/rename_replacement. Restaurar en un nodo de prueba evita la colisión por completo.",
    },
    {
      symptom: "La salud del clúster es red y los snapshots vuelven parciales o fallan.",
      cause: "Al menos un shard primario está sin asignar; un snapshot no puede capturar shards no disponibles.",
      fix: "Diagnostica con _cluster/allocation/explain y recupera los primarios (watermark de disco, nodo caído, shard corrupto) antes de respaldar. Un clúster mononodo yellow está bien; red no.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio de datos vivo — los segmentos Lucene se escriben y fusionan continuamente, una copia de archivos es inconsistente.",
    "Debes registrar un repositorio de snapshots (ruta fs compartida u object store) antes del primer snapshot; una ruta bind-montada compartida con el contenedor es el repo fs más simple.",
    "Restaurar un índice ya existente exige cerrarlo o eliminarlo primero, o la restauración se rechaza.",
  ],
  faq: [
    {
      question: "¿Por qué la API de snapshots en lugar de copiar la carpeta de datos?",
      answer:
        "Elasticsearch escribe y fusiona segmentos Lucene sin parar: una copia del directorio vivo es inconsistente y quizá no abra. La API de snapshots captura una vista consistente, incremental y datada de cada índice.",
    },
    {
      question: "¿Cómo registro un repositorio de snapshots?",
      answer:
        "Configura un repositorio de sistema de archivos apuntando a una ruta legible por Elasticsearch y Dockstash (o un object store) y regístralo con una llamada PUT _snapshot. Dockstash entrega ese directorio a restic.",
    },
    {
      question: "¿Los snapshots de Elasticsearch son incrementales?",
      answer:
        "Sí. Dentro de un repositorio, cada snapshot solo guarda los segmentos ausentes: los snapshots repetidos son baratos. La deduplicación de restic lo potencia.",
    },
    {
      question: "¿Funciona también para OpenSearch?",
      answer:
        "Sí — OpenSearch es un fork de Elasticsearch con el mismo modelo de API de snapshots. Registra un repositorio y captura igual.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar Elasticsearch?",
      answer:
        "Diario es el valor práctico — al ser incrementales dentro del repositorio, las ejecuciones diarias siguen siendo baratas incluso con índices grandes. En Free los respaldos son manuales (Backup Now); Pro desbloquea hasta cada hora, Business cualquier cron.",
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
