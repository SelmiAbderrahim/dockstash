// Textos en español del guía de RabbitMQ. Las claves de pasos reflejan
// content/guides.ts → SERVICE_GUIDES.rabbitmq walkthrough/restoreVerify.

import type { ServiceGuideCopy } from '../../types';

export const RABBITMQ_COPY: ServiceGuideCopy = {
  walkthrough: {
    'add-server': {
      title: "Crea tu cuenta de Dockstash y abre el panel",
      body: "Regístrate gratis en dockstash.com/register. El asistente de configuración único te pide tu VPS de almacenamiento (la máquina que guardará los respaldos cifrados) y genera una contraseña de cifrado — guárdala de inmediato en un gestor de contraseñas: se muestra exactamente una vez.",
    },
    'add-project': {
      title: "Añade el proyecto Docker que ejecuta RabbitMQ",
      body: "En la pantalla Projects, Dockstash detecta automáticamente cada carpeta de proyecto Compose del servidor (por defecto bajo /var/www). Elige el proyecto que contiene tu servicio RabbitMQ. Aún no se respalda nada — solo le indicas a Dockstash dónde vive el proyecto.",
    },
    'review-detection': {
      title: "Comprueba que RabbitMQ fue detectado",
      body: "Abre el proyecto y mira la pestaña Plan. Dockstash lee docker-compose.yml, reconoce la imagen rabbitmq y añade una capa que exporta las definiciones del broker — más el nombre del contenedor resuelto y las claves encontradas (RABBITMQ_DEFAULT_USER, RABBITMQ_DEFAULT_PASS, RABBITMQ_DEFAULT_VHOST). Puedes activar o desactivar archivos, bases y configuraciones de proxy antes de guardar.",
    },
    'test-dump': {
      title: "Opcional: comprueba la exportación a mano",
      body: "Si quieres una prueba antes de automatizar, ejecuta rabbitmqctl export_definitions en el contenedor. Escribe un JSON con toda la topología del broker — vhosts, exchanges, colas, bindings, usuarios y policies. Ábrelo: reconocerás cada cola que declara tu app; ese JSON es lo que se respalda.",
    },
    'choose-destination': {
      title: "Confirma tu destino de almacenamiento",
      body: "Los respaldos se guardan como instantáneas restic cifradas en tu propio VPS de almacenamiento, vía SSH. Si completaste el asistente, ya está configurado; puedes cambiar host, usuario, puerto o la clave SSH en cualquier momento en Settings → Storage.",
    },
    'schedule': {
      title: "Define una programación de respaldo",
      body: "En la pestaña Schedule elige diario, semanal o una expresión cron personalizada (validada al escribir). Diario sobra para la mayoría de brokers — la topología cambia al desplegar, no cada minuto. Añade un prune semanal con tu retención.",
    },
    'run-first-backup': {
      title: "Ejecuta el primer respaldo ahora",
      body: "Haz clic en Backup Now. Dockstash ejecuta rabbitmqctl export_definitions en el contenedor en marcha y entrega el JSON a restic junto con los archivos del proyecto — sigue la salida en vivo en el panel de logs. Las definiciones se exportan limpias mientras el broker sirve tráfico; nada se para ni se bloquea.",
    },
    'confirm-snapshot': {
      title: "Confirma que la instantánea existe",
      body: "Al terminar la ejecución, la tarjeta del proyecto muestra la nueva hora del último respaldo, el número de instantáneas y el tamaño del repositorio. Abre la pantalla Snapshots: el punto de restauración aparece en la línea de tiempo — tu prueba de que el respaldo llegó fuera del servidor.",
    },
  },
  restoreVerify: {
    intro:
      "Un respaldo de RabbitMQ solo es real una vez restaurado. Las restauraciones de Dockstash nunca sobrescriben tu broker vivo por defecto — primero restauras a una ubicación nueva, verificas la topología y promocionas deliberadamente. Recuerda qué restauras: el JSON de definiciones reconstruye la topología, no los mensajes que esperaban en las colas.",
    steps: {
      'pick-snapshot': {
        title: "Elige un punto de restauración",
        body: "Abre Snapshots, selecciona el proyecto y recorre la línea de tiempo. Cada fila contiene el JSON de definiciones exportado — la topología completa del broker en ese momento — más los archivos del proyecto de la misma ejecución.",
      },
      'restore-scratch': {
        title: "Restaura a una nueva ubicación",
        body: "Haz clic en Restore y mantén el modo por defecto « Restore to new location ». Escribe el nombre del proyecto para confirmar — una acción deliberada con confirmación tecleada. El volcado y los archivos aterrizan en la ruta de destino que elijas, sin tocar el proyecto vivo.",
      },
      'verify-data': {
        title: "Verifica la topología restaurada",
        body: "Ejecuta rabbitmqctl list_queues en el broker de prueba: imprime cada nombre de cola con su recuento de mensajes. Cada cola que declara tu app debe aparecer (los recuentos serán cero — los mensajes no forman parte del respaldo). Verifica exchanges, bindings, usuarios y policies igual o por la UI de management.",
      },
      'promote': {
        title: "Promociona cuando estés conforme",
        body: "Cuando los datos restaurados estén validados, apunta tu aplicación a ellos (o repite la restauración en modo « Overwrite existing » — un opt-in explícito). Mejor aún: deja que el simulacro de restauración semanal produzca esta prueba automáticamente, para que una restauración nunca sea tu primer ensayo.",
      },
    },
  },
  troubleshooting: [
    {
      symptom: "La restauración « funcionó » pero todas las colas están vacías.",
      cause: "Definiciones y mensajes son cosas distintas. export_definitions captura la topología — vhosts, exchanges, colas, bindings, usuarios, policies —, nunca los cuerpos de mensajes encolados al momento del respaldo.",
      fix: "Es lo esperado. Trata los mensajes encolados como transitorios: productores que republiquen y consumidores que toleren el replay. Un mensaje que deba sobrevivir a la pérdida del broker se persiste en una base de datos, no en una cola.",
    },
    {
      symptom: "Un broker arrancado desde una copia del directorio /var/lib/rabbitmq/mnesia se cae o no arranca.",
      cause: "Mnesia se escribe continuamente mientras el broker corre: una copia en caliente es internamente inconsistente — y el almacén está además ligado al nombre del nodo, así que rompe en un host con otro hostname.",
      fix: "No copies Mnesia como respaldo. Exporta las definiciones e impórtalas en un broker nuevo; esa es la vía soportada y restaurable.",
    },
    {
      symptom: "import_definitions en un broker en marcha da error o deja una mezcla de topología vieja y nueva.",
      cause: "La importación fusiona con lo existente — argumentos de colas en conflicto, usuarios ya presentes o policies chocan con las entradas del JSON en lugar de reemplazarlas.",
      fix: "Importa en un broker nuevo siempre que puedas. Si debe ser el broker en marcha: espera una fusión, no un reinicio — borra antes las entidades en conflicto y verifica el resultado con rabbitmqctl list_queues y la UI de management.",
    },
  ],
  gotchas: [
    "Respalda las definiciones del broker (topología) vía export_definitions — es la parte duradera y restaurable de RabbitMQ.",
    "El almacén de mensajes Mnesia guarda mensajes en vuelo y no es seguro copiarlo en caliente; trata los mensajes persistidos como transitorios y confía en productores/consumidores para recuperar.",
    "Restaurar las definiciones recrea la topología pero no los mensajes que estaban en las colas al momento del respaldo.",
  ],
  faq: [
    {
      question: "¿Qué parte de RabbitMQ debo respaldar?",
      answer:
        "Las definiciones: vhosts, exchanges, colas, bindings, usuarios y policies. Exportarlas como JSON captura toda la topología del broker — lo que de verdad necesitas para reconstruir tras una pérdida.",
    },
    {
      question: "¿Puedo respaldar los mensajes que esperan en las colas?",
      answer:
        "No de forma fiable con el broker en marcha. El almacén Mnesia no es consistente a instante preciso bajo carga, y los mensajes están pensados como transitorios. Diseña consumidores que toleren el replay en lugar de confiar en un respaldo de mensajes.",
    },
    {
      question: "¿Cómo restauro un broker RabbitMQ?",
      answer:
        "Levanta un broker nuevo y ejecuta rabbitmqctl import_definitions con tu JSON exportado. Se recrea la topología completa — exchanges, colas, bindings, usuarios, policies.",
    },
    {
      question: "¿Copiar /var/lib/rabbitmq/mnesia es un respaldo válido?",
      answer:
        "No. Mnesia se escribe continuamente y una copia en caliente es inconsistente. Exporta las definiciones en su lugar; esa es la vía de respaldo soportada y restaurable.",
    },
    {
      question: "¿Con qué frecuencia debo respaldar RabbitMQ?",
      answer:
        "Diario sobra para la mayoría de brokers — las definiciones solo cambian al desplegar nuevas colas, usuarios o policies. En Free los respaldos son manuales (Backup Now); Pro desbloquea hasta cada hora, Business cualquier cron.",
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
