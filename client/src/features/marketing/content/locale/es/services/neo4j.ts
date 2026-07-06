// Textos en español del guía de Neo4j. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.neo4j walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const NEO4J_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta Neo4j",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio Neo4j. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que Neo4j fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen neo4j y registra el contenedor resuelto y las claves encontradas (NEO4J_AUTH, NEO4J_PLUGINS). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Entiende cómo funciona el volcado de Neo4j",
      body: "Neo4j es el único motor donde la edición importa. Enterprise permite respaldos en línea en caliente con neo4j-admin database backup mientras la base sigue sirviendo. Community exige la base parada para neo4j-admin database dump — el patrón seguro es una breve parada programada a la hora más tranquila, o volcar una instancia secundaria. Dockstash captura el artefacto de volcado resultante, nunca el directorio /data vivo.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Para Neo4j en Community, programa el respaldo a tu hora más tranquila para que la breve ventana de volcado sea indolora. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash captura el volcado del grafo y los archivos del proyecto y envía todo a restic — sigue la salida en vivo, línea a línea, en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de Neo4j solo es real una vez recargado en un grafo consultable. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a una ubicación nueva, cargas en una instancia de prueba y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila contiene un artefacto de volcado neo4j-admin consistente más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Carga y verifica el grafo restaurado",
        body: "Arranca un contenedor Neo4j de prueba (misma imagen y mismos plugins que producción), carga el volcado con neo4j-admin database load sobre el destino parado, arranca y sondea con algunas consultas Cypher — los recuentos de nodos y relaciones sobre tus labels principales son la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El paso de volcado falla con « database is in use » en Community.",
      cause: "neo4j-admin database dump exige la base parada en Community; el volcado en caliente no está soportado.",
      fix: "Programa el respaldo a una hora tranquila con una breve parada, vuelca una instancia secundaria, o pasa a Enterprise para respaldos en línea en caliente con neo4j-admin database backup.",
    },
    {
      symptom: "La base restaurada arranca pero las consultas con APOC o GDS fallan.",
      cause: "Los plugins son parte de la imagen y la config, no del volcado — la imagen destino no los trae.",
      fix: "Restaura en una imagen con los mismos NEO4J_PLUGINS (APOC, GDS) instalados antes de cargar el volcado, y relanza los procedimientos fallidos.",
    },
    {
      symptom: "neo4j-admin database load se niega a sobrescribir el destino.",
      cause: "El comando load no reemplaza una base existente sin indicación explícita, y el destino debe estar parado.",
      fix: "Para la base destino y pasa --overwrite-destination=true (exactamente lo que hace el comando de restauración documentado), luego arranca Neo4j.",
    },
    {
      symptom: "Los respaldos son mucho mayores de lo que sugiere el grafo.",
      cause: "El volcado incluye el almacén completo; la agitación de los registros de transacciones entre volcados también reduce la deduplicación de restic.",
      fix: "Mantén los volcados en programación diaria y deja que prune + retención recorten el historial; vigila la tendencia de tamaño en la tarjeta del proyecto para confirmar que la retención actúa.",
    },
  ],
  gotchas: [
    "En la edición Community, `neo4j-admin database dump` exige la base parada — volcar un almacén vivo no está soportado y copiar /data en caliente es inconsistente.",
    "La edición Enterprise permite respaldos en línea en caliente vía `neo4j-admin database backup`; Community debe programar una breve parada o volcar una secundaria.",
    "El puerto Bolt (7687) es para clientes; los respaldos corren por neo4j-admin dentro del contenedor, no por Bolt.",
  ],
  faq: [
    {
      question: "¿Puedo respaldar Neo4j sin pararlo?",
      answer:
        "En Enterprise, sí — usa `neo4j-admin database backup` para un respaldo en línea en caliente. En Community, el comando `database dump` necesita la base parada: Dockstash programa una breve parada o vuelca una réplica.",
    },
    {
      question: "¿Por qué no copiar el directorio /data/databases?",
      answer:
        "El almacén del grafo y los registros de transacciones se escriben continuamente. Una copia en caliente es inconsistente y puede no cargar. neo4j-admin dump/backup producen un artefacto consistente y restaurable.",
    },
    {
      question: "¿Cómo restauro un volcado de Neo4j?",
      answer:
        "Usa `neo4j-admin database load ... --overwrite-destination=true` sobre un destino parado y arranca Neo4j. Dockstash carga primero en una base de staging antes de cualquier sobrescritura.",
    },
    {
      question: "¿El respaldo incluye los plugins instalados?",
      answer:
        "No — los plugins (APOC, GDS) son parte de la imagen/config, no del volcado de la base. Asegúrate de que la imagen destino tenga los mismos plugins antes de cargar.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar Neo4j?",
      answer:
        "Diario es el valor práctico — elige tu hora más tranquila si usas Community y necesitas la breve ventana de parada. Free = solo respaldos manuales; Pro permite hasta cada hora, Business cualquier expresión cron.",
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
