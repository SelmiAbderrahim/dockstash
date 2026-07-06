// Textos en español del guía de MySQL. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.mysql walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MYSQL_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta MySQL",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio MySQL. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que MySQL fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen mysql y añade una capa de base de datos con el comando de volcado correcto — más el nombre del contenedor resuelto y las claves de entorno encontradas (MYSQL_ROOT_PASSWORD, MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el volcado a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta el mismo volcado que ejecutará Dockstash. Deberías ver fluir SQL — sentencias CREATE DATABASE, CREATE TABLE e INSERT. Esa salida es lo que se respalda, nunca el directorio vivo /var/lib/mysql.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor por defecto correcto para la mayoría de proyectos MySQL. Añade un prune semanal con tu política de retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash ejecuta mysqldump con --single-transaction, --routines y --triggers dentro del contenedor y envía el volcado directamente a restic — sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de MySQL solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila es un volcado completo a instante único de todas las bases del servidor — esquemas, datos, rutinas y triggers — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Carga el volcado en un contenedor MySQL de prueba, ejecuta SHOW DATABASES para confirmar que cada esquema volvió y sondea las tablas de tu aplicación. Recuentos de filas y registros recientes son la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El volcado falla con « Access denied for user 'root'@'localhost' ».",
      cause: "El MYSQL_ROOT_PASSWORD del compose ya no coincide con la contraseña real del volumen de datos — la variable solo fija la contraseña en la primera inicialización; cambiarla después en el compose no afecta a un volumen existente.",
      fix: "Usa la contraseña con la que se inicializó el volumen, o restablece la contraseña root dentro del contenedor, y alinea después el env del compose.",
    },
    {
      symptom: "El volcado termina pero algunas tablas quedan inconsistentes tras restaurar.",
      cause: "Esas tablas son MyISAM. --single-transaction solo garantiza una instantánea consistente para tablas transaccionales InnoDB; las MyISAM se leen fuera de esa garantía.",
      fix: "Comprueba el motor con SHOW TABLE STATUS. Migra las tablas MyISAM a InnoDB (ALTER TABLE ... ENGINE=InnoDB) — el arreglo duradero — o acepta un bloqueo breve con --lock-tables.",
    },
    {
      symptom: "Restaurar en un contenedor de prueba da « Unknown collation: utf8mb4_0900_ai_ci ».",
      cause: "El volcado viene de MySQL 8.x pero restauras en una imagen 5.7; las colaciones por defecto de 8.0 no existen en servidores antiguos.",
      fix: "Restaura en la misma versión mayor del volcado (por ejemplo mysql:8). Volcar de antiguo a nuevo funciona; lo inverso suele fallar.",
    },
    {
      symptom: "Una ejecución de respaldo falla con un candado restic obsoleto tras un fallo o reinicio.",
      cause: "Un job anterior murió a mitad de ejecución y dejó el repositorio bloqueado.",
      fix: "No hay nada que hacer a mano: la siguiente ejecución detecta el candado huérfano y ejecuta restic unlock automáticamente antes de continuar. Si las ejecuciones siguen fallando, revisa el panel de logs en vivo para ver el error de fondo.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio vivo /var/lib/mysql — tablespaces InnoDB copiados en plena escritura son inconsistentes y fallarán en la recuperación.",
    "--single-transaction solo da una instantánea consistente para tablas transaccionales (InnoDB); las MyISAM no están cubiertas y necesitan bloqueo.",
    "Añade --routines y --triggers o los procedimientos almacenados y triggers desaparecen en silencio del volcado.",
  ],
  faq: [
    {
      question: "¿Por qué es importante --single-transaction?",
      answer:
        "Sin él, mysqldump lee las tablas una a una y una escritura entre tablas produce un volcado inconsistente. --single-transaction lo envuelve todo en una transacción InnoDB: el volcado entero refleja un único instante, sin bloqueo de escritura.",
    },
    {
      question: "¿El volcado incluye procedimientos almacenados y triggers?",
      answer:
        "Solo si pasas --routines y --triggers, que Dockstash incluye. Un mysqldump por defecto los omite — causa habitual de una base « restaurada pero rota ».",
    },
    {
      question: "¿Puedo respaldar MySQL copiando /var/lib/mysql?",
      answer:
        "No. El tablespace InnoDB y los redo logs se escriben continuamente; una copia de archivos en plena escritura es inconsistente. Dockstash ejecuta mysqldump dentro del contenedor en su lugar.",
    },
    {
      question: "¿Y si uso tablas MyISAM?",
      answer:
        "--single-transaction no hace consistente a MyISAM porque ese motor no es transaccional. Si dependes de MyISAM, hace falta un bloqueo breve (--lock-tables) — migrar esas tablas a InnoDB es el arreglo duradero.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar MySQL?",
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
