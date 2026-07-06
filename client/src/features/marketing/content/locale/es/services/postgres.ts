// Textos en español del guía de PostgreSQL. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.postgres walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const POSTGRES_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta PostgreSQL",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio PostgreSQL. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que PostgreSQL fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen postgres y añade una capa de base de datos con el comando de volcado correcto — más el nombre del contenedor resuelto y las claves de entorno encontradas (POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB). Puedes activar o desactivar archivos, bases de datos y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el volcado a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta el mismo volcado que ejecutará Dockstash. Deberías ver fluir sentencias SQL — esa salida es lo que se respalda, nunca el directorio de datos vivo.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule del proyecto elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor por defecto correcto para la mayoría de proyectos PostgreSQL. Añade una programación de prune semanal con tu política de retención para recortar automáticamente las instantáneas antiguas.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash ejecuta pg_dumpall dentro del contenedor en ejecución y envía el volcado directamente a restic — puedes seguir la salida de restic en vivo, línea a línea, en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de PostgreSQL solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base de datos viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo de puntos de restauración. Cada fila es un volcado completo y consistente de todas las bases del clúster, más los archivos del proyecto capturados en la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Carga el volcado restaurado en un contenedor PostgreSQL de prueba con psql, lista las bases y sondea las tablas de las que depende tu aplicación. Los recuentos de filas y los registros recientes son la prueba de verdad más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El volcado falla con « role does not exist » o errores de autenticación.",
      cause: "El valor POSTGRES_USER del compose ya no corresponde a un rol real en la base — habitual tras renombrar un rol a mano o restaurar un volumen de otro proyecto.",
      fix: "Ejecuta psql en el contenedor, comprueba los roles reales con \\du y alinea el env del compose (o las credenciales de volcado del plan) con un rol superusuario existente.",
    },
    {
      symptom: "El SQL restaurado falla con « extension ... is not available ».",
      cause: "El volcado referencia CREATE EXTENSION (PostGIS, pgvector, …) pero la imagen destino de la restauración no incluye esos binarios de extensión.",
      fix: "Restaura en la misma imagen que usa tu servicio de producción (por ejemplo postgis/postgis o builds con pgvector), no en una imagen postgres básica.",
    },
    {
      symptom: "Los respaldos de pronto tardan mucho más o el repositorio crece rápido.",
      cause: "La salida de pg_dumpall cambia en bloque cuando las tablas grandes se mueven mucho, lo que reduce la deduplicación de restic.",
      fix: "Mantén la programación diaria y deja que prune + retención recorten el historial; en clústeres muy grandes, confirma en la tendencia de tamaño de la tarjeta del proyecto que la retención (keep daily/weekly/monthly) realmente poda.",
    },
    {
      symptom: "Una ejecución de respaldo falla con un candado restic obsoleto tras un fallo o reinicio.",
      cause: "Un job anterior murió a mitad de ejecución y dejó el repositorio bloqueado.",
      fix: "No hay nada que hacer a mano: la siguiente ejecución detecta el candado huérfano y ejecuta restic unlock automáticamente antes de continuar. Si las ejecuciones siguen fallando, revisa el panel de logs en vivo para ver el error de fondo.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio vivo /var/lib/postgresql/data — una página del heap copiada en plena escritura queda rota e irrecuperable.",
    "pg_dumpall captura los roles y todas las bases; un pg_dump suelto pierde objetos globales como roles y tablespaces.",
    "Las extensiones (PostGIS, pgvector) deben estar instaladas en la imagen destino antes de restaurar, o el SQL fallará.",
  ],
  faq: [
    {
      question: "¿Por qué pg_dumpall en lugar de copiar el directorio de datos?",
      answer:
        "Un directorio de datos Postgres vivo se escribe constantemente. Copiarlo captura un estado roto e inconsistente que no arrancará. pg_dumpall lee una instantánea MVCC consistente del servidor en marcha y produce un volcado que se restaura limpio.",
    },
    {
      question: "¿Dockstash bloquea la base durante el respaldo?",
      answer:
        "No. pg_dumpall usa instantáneas MVCC: las lecturas son consistentes sin bloquear escrituras. Tu aplicación sigue sirviendo tráfico durante el volcado.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar PostgreSQL?",
      answer:
        "Diario es el valor por defecto práctico para la mayoría de proyectos; cada hora si perder un día de escrituras es inaceptable. En el plan Free los respaldos son solo manuales; Pro permite programaciones hasta cada hora, Business cualquier cron. Combina la programación con un simulacro de restauración semanal.",
    },
    {
      question: "¿Cómo restauro una sola base en lugar de todas?",
      answer:
        "Un archivo pg_dumpall es SQL plano; puedes restaurar todo el clúster con psql, o usar pg_dump/pg_restore por base si solo necesitas una. Por defecto, Dockstash restaura la instantánea consistente completa.",
    },
    {
      question: "¿Y las extensiones como PostGIS o pgvector?",
      answer:
        "El volcado referencia CREATE EXTENSION pero no incluye los binarios. Asegúrate de que la imagen destino de la restauración tenga las mismas extensiones antes de restaurar.",
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
