// Textos en español del guía de ClickHouse. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.clickhouse walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const CLICKHOUSE_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta ClickHouse",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio ClickHouse. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que ClickHouse fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen clickhouse/clickhouse-server y añade una capa con el comando de respaldo correcto — más el nombre del contenedor resuelto y las claves encontradas (CLICKHOUSE_USER, CLICKHOUSE_PASSWORD, CLICKHOUSE_DB). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba el servidor a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta clickhouse-client con SHOW DATABASES en el contenedor. Deberías ver tus bases listadas (default, system y las de tu app) — son las que la sentencia nativa BACKUP DATABASE capturará como partes de tablas consistentes.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario a una hora tranquila es el valor correcto para la mayoría de cargas analíticas — los datos de ClickHouse suelen llegar en bloque, cada hora rara vez aporta. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash ejecuta la sentencia nativa BACKUP DATABASE en el contenedor para producir una instantánea consistente de partes de tablas y entrega el resultado a restic — sigue la salida en vivo en el panel de logs. La primera ejecución sobre una tabla MergeTree grande puede tardar; las siguientes deduplican contra ella.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de ClickHouse solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu base viva por defecto — primero restauras a una ubicación nueva, verificas los datos y promocionas deliberadamente.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila es un BACKUP consistente de tu base ClickHouse — partes de tablas congeladas, no una copia de archivos rota — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica los datos restaurados",
        body: "Ejecuta RESTORE DATABASE en un contenedor ClickHouse de prueba y consúltalo: SELECT count() FROM system.tables confirma que las tablas volvieron, y un count() sobre tu mayor tabla MergeTree comparado con producción es la prueba más rápida.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "BACKUP DATABASE falla con un error de disco desconocido o ausente.",
      cause: "La sentencia nativa BACKUP escribe en un disco de respaldo con nombre, y no hay ninguno declarado en la configuración del servidor.",
      fix: "Añade un disco backups bajo <storage_configuration> (o una entrada de disco permitido <backups>) en la config de ClickHouse y reinicia, o pásate a la herramienta clickhouse-backup, que congela partes vía hardlinks sin disco configurado.",
    },
    {
      symptom: "Una copia cruda de /var/lib/clickhouse restaurada da un servidor con partes rotas o ausentes.",
      cause: "ClickHouse fusiona y muta partes de tablas continuamente en segundo plano; una copia tomada durante las fusiones captura directorios a medio reescribir.",
      fix: "Nunca copies el directorio de datos vivo. Usa BACKUP DATABASE o clickhouse-backup — ambos congelan primero un conjunto consistente de partes — y deja que Dockstash entregue esa salida a restic.",
    },
    {
      symptom: "El primer respaldo es enorme y tarda mucho más de lo esperado.",
      cause: "Con tablas MergeTree grandes, el BACKUP inicial materializa cada parte una vez; no existe un punto de partida menor.",
      fix: "Deja terminar la primera ejecución — la deduplicación de restic y el modo incremental de BACKUP mantienen pequeñas todas las siguientes. Sigue el progreso en el panel de logs y la tendencia de tamaño en la tarjeta del proyecto.",
    },
  ],
  gotchas: [
    "Nunca ejecutes restic sobre el directorio vivo /var/lib/clickhouse/store — las partes se fusionan y mutan en segundo plano, una copia cruda es inconsistente.",
    "El SQL de BACKUP/RESTORE exige un disco de respaldo configurado en el servidor; sin él, usa la herramienta clickhouse-backup que congela partes vía hardlinks.",
    "Las tablas MergeTree grandes producen respaldos grandes; la deduplicación incremental de restic ayuda, pero el BACKUP inicial puede ser considerable.",
  ],
  faq: [
    {
      question: "¿Cuál es la forma correcta de respaldar ClickHouse?",
      answer:
        "Usa la sentencia nativa BACKUP (BACKUP DATABASE ... TO Disk(...)) o la herramienta clickhouse-backup. Ambas producen una instantánea consistente de las partes de tablas. Dockstash entrega después el directorio resultante a restic.",
    },
    {
      question: "¿Puedo copiar /var/lib/clickhouse en su lugar?",
      answer:
        "No. ClickHouse fusiona y muta partes continuamente en segundo plano: una copia del directorio vivo es inconsistente. La sentencia BACKUP o clickhouse-backup congelan las partes con seguridad.",
    },
    {
      question: "Sentencia BACKUP o clickhouse-backup — ¿cuál usar?",
      answer:
        "La sentencia nativa es lo más simple con un disco de respaldo configurado. clickhouse-backup es útil para congelar partes vía hardlinks y enviarlas, sobre todo en versiones antiguas. Dockstash acepta ambas salidas.",
    },
    {
      question: "¿Los respaldos de ClickHouse son incrementales?",
      answer:
        "La sentencia BACKUP admite respaldos incrementales contra una base, y restic añade su propia deduplicación encima: las instantáneas repetidas se mantienen compactas.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar ClickHouse?",
      answer:
        "Diario es el valor práctico — los datos analíticos llegan en bloque y la deduplicación de restic abarata las instantáneas diarias. En Free los respaldos son manuales (Backup Now); Pro desbloquea programaciones hasta cada hora, Business cualquier cron.",
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
