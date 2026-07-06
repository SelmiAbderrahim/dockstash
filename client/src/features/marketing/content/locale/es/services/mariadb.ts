// Textos en español del guía de MariaDB. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.mariadb walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const MARIADB_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta MariaDB",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio MariaDB. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que MariaDB fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen mariadb y añade una capa de base de datos con el comando de volcado correcto — más el nombre del contenedor resuelto y las claves encontradas (MARIADB_ROOT_PASSWORD, o la antigua MYSQL_ROOT_PASSWORD, más MARIADB_DATABASE y MARIADB_USER). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el volcado a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta el mismo volcado que ejecutará Dockstash — mariadb-dump con --single-transaction. Verás fluir SQL: CREATE DATABASE, CREATE TABLE e INSERT. Esa salida es lo que se respalda, nunca el directorio vivo /var/lib/mysql.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor por defecto correcto para la mayoría de proyectos MariaDB. Añade un prune semanal con tu política de retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now en la tarjeta del proyecto. Dockstash ejecuta mariadb-dump con --single-transaction, --routines y --triggers dentro del contenedor y envía el volcado directamente a restic — sigue la salida en vivo en el panel de logs.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de MariaDB solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
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
        body: "Carga el volcado en un contenedor MariaDB de prueba, ejecuta SHOW DATABASES con el cliente mariadb para confirmar que cada esquema volvió y sondea las tablas de tu aplicación.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "El volcado manual falla con « mariadb-dump: command not found ».",
      cause: "Las imágenes MariaDB antiguas (10.4 y anteriores) solo traen el binario mysqldump; mariadb-dump llegó después, con mysqldump como enlace de compatibilidad en las imágenes nuevas.",
      fix: "Usa mysqldump con las mismas opciones en imágenes antiguas — la salida es idéntica. Dockstash detecta qué binario trae la imagen y llama al correcto automáticamente.",
    },
    {
      symptom: "El volcado falla con « Access denied for user 'root'@'localhost' ».",
      cause: "La clave de contraseña root del compose (MARIADB_ROOT_PASSWORD o la antigua MYSQL_ROOT_PASSWORD) ya no coincide con la contraseña real del volumen — la variable solo la fija en la primera inicialización.",
      fix: "Usa la contraseña con la que se inicializó el volumen, o restablécela dentro del contenedor, y alinea después el env del compose.",
    },
    {
      symptom: "Restaurar el volcado en un contenedor MySQL falla con errores de sintaxis.",
      cause: "MariaDB y MySQL han divergido — secuencias de MariaDB, ciertas colaciones y opciones de almacenamiento no existen en MySQL; una restauración cruzada puede romper.",
      fix: "Restaura en una imagen MariaDB de la misma versión mayor del volcado. Aborda una migración MariaDB → MySQL solo de forma deliberada, tras limpiar el volcado.",
    },
    {
      symptom: "Una ejecución de respaldo falla con un candado restic obsoleto tras un fallo o reinicio.",
      cause: "Un job anterior murió a mitad de ejecución y dejó el repositorio bloqueado.",
      fix: "No hay nada que hacer a mano: la siguiente ejecución detecta el candado huérfano y ejecuta restic unlock automáticamente antes de continuar. Si las ejecuciones siguen fallando, revisa el panel de logs en vivo para ver el error de fondo.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio vivo /var/lib/mysql — una copia InnoDB en plena escritura es irrecuperable.",
    "Las imágenes nuevas traen mariadb-dump; las antiguas usan mysqldump. Dockstash detecta qué binario provee la imagen.",
    "MariaDB acepta MARIADB_ROOT_PASSWORD o la clave antigua MYSQL_ROOT_PASSWORD: ambas se detectan.",
  ],
  faq: [
    {
      question: "¿MariaDB se respalda igual que MySQL?",
      answer:
        "Casi idéntico. Ambos usan --single-transaction para una instantánea InnoDB consistente. La diferencia es el binario cliente: las imágenes MariaDB recientes traen mariadb-dump (mysqldump es un enlace de compatibilidad). Dockstash elige el correcto.",
    },
    {
      question: "¿Qué clave de contraseña root detecta Dockstash?",
      answer:
        "Tanto MARIADB_ROOT_PASSWORD como la antigua MYSQL_ROOT_PASSWORD se reconocen, ya que las imágenes MariaDB aceptan una u otra según la versión.",
    },
    {
      question: "¿Puedo restaurar un volcado MariaDB en MySQL, o al revés?",
      answer:
        "A menudo, pero no siempre — la deriva de funciones y sintaxis entre ambos rompe casos límite. Restaura en la misma familia de motor del volcado para un resultado fiable.",
    },
    {
      question: "¿Por qué no simplemente hacer snapshot del volumen?",
      answer:
        "El volumen /var/lib/mysql se escribe continuamente. Un snapshot en plena escritura es inconsistente. El volcado lógico vía mariadb-dump es la vía restaurable.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar MariaDB?",
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
