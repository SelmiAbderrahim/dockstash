// Textos en español de los guías de plataforma (usar el propio Dockstash).
// Las claves de pasos reflejan content/platform-guides.ts. Hechos tomados de
// la documentación del producto (docs/*.es.md).

import type { PlatformGuideCopy } from '../types';

export const PLATFORM: Record<string, PlatformGuideCopy> = {
  'connect-fleet-agent': {
    intro:
      'Un agente de flota es un pequeño demonio que ejecutas en otro VPS para que Dockstash respalde también los contenedores de esa máquina. El agente llama a casa por HTTPS — no se abre ningún puerto entrante en tu servidor — y ejecuta la misma tubería volcado-luego-restic que el servidor principal. La flota multi-VPS es una función del plan Business.',
    steps: {
      'open-fleet': {
        title: 'Abre la pantalla Fleet',
        body: 'En el panel, ve a Fleet. Esta pantalla lista cada agente registrado con su estado en línea/fuera de línea, versión y último heartbeat.',
      },
      'register-agent': {
        title: 'Registra el agente',
        body: 'Haz clic en Register agent y dale un nombre y el host donde correrá. En el mismo diálogo, rellena el campo Project directories con la ubicación de tus proyectos Compose en ese VPS (por defecto /var/www) — el agente solo descubrirá, respaldará y restaurará dentro de esos directorios.',
      },
      'copy-token': {
        title: 'Copia el token de un solo uso',
        body: 'El registro acuña un token con forma dsa_<agentId>.<secret> y lo muestra exactamente una vez — en el servidor solo se guarda como HMAC con clave y nunca puede recuperarse. Cópialo ahora. Si lo pierdes, usa Rotate key en la fila del agente; el token antiguo deja de funcionar en cuanto se acuña uno nuevo.',
      },
      'install-agent': {
        title: 'Instala el agente en el VPS',
        body: 'El diálogo de registro muestra un bloque docker-compose listo para copiar y pegar, prerrellenado con tu token y tus directorios de proyectos. Pégalo en el VPS destino y arráncalo. El docker-socket-proxy incluido concede al agente acceso Docker de privilegio mínimo (solo contenedores + exec) — nunca toca el socket crudo.',
      },
      'set-project-roots': {
        title: 'Comprueba el montaje de los directorios de proyectos',
        body: 'Cada directorio listado debe además estar bind-montado en lectura-escritura en el compose (misma ruta dentro y fuera) — las restauraciones escriben archivos de vuelta. Para añadir un directorio después, abre el diálogo Setup del agente, agrégalo y vuelve a ejecutar el comando compose mostrado.',
      },
      'verify-online': {
        title: 'Verifica que el agente está en línea',
        body: 'En unos 30 segundos llega el primer heartbeat y la fila de Fleet pasa a en línea. Si sigue fuera de línea, comprueba que ambos contenedores corren y que tu URL de Dockstash es alcanzable desde el VPS.',
      },
      'assign-project': {
        title: 'Asigna un proyecto al agente',
        body: 'Abre la pestaña Plan de un proyecto y pon « Runs on » en el nuevo agente (el valor por defecto es « This server (local) »). Desde entonces, los respaldos programados y bajo demanda de ese proyecto los reclama y ejecuta el agente, con logs en vivo de vuelta a tu panel.',
      },
    },
    faq: [
      {
        question: '¿El servidor de Dockstash se conecta a mi VPS?',
        answer:
          'No. La conectividad es solo saliente: el agente sondea y envía heartbeats por HTTPS con un token Bearer. Nunca abres un puerto entrante, y el servidor nunca llama a tu máquina.',
      },
      {
        question: '¿Qué puede ver el agente en mi servidor?',
        answer:
          'Solo lo que permitas. El acceso al sistema de archivos se limita a los directorios de proyectos configurados (que deben estar explícitamente bind-montados), y el acceso Docker pasa por un proxy de socket que expone solo listado de contenedores y exec — sin builds de imágenes, sin montajes de volúmenes, sin root del host.',
      },
      {
        question: '¿Qué pasa si el agente muere a mitad de un respaldo?',
        answer:
          'Cada job tiene un arriendo (15 minutos por defecto, renovado mientras fluyen los logs). Si el arriendo expira, el job se marca como fallido y sale una alerta — nunca se reintenta en silencio, así que siempre sabes que una ejecución no terminó.',
      },
      {
        question: '¿Los simulacros de restauración corren en los agentes de flota?',
        answer:
          'Todavía no — los simulacros siguen ejecutándose en el servidor principal. Respaldo, verificación (restic check), prune y restauración sí corren en remoto en el agente.',
      },
      {
        question: 'Roté la clave y ahora el agente recibe 401. ¿Qué hago?',
        answer:
          'El contenedor en marcha aún conserva el token antiguo. Actualiza DOCKSTASH_AGENT_TOKEN en docker-compose.agent.yml y recrea el contenedor. La rotación invalida el token antiguo de inmediato, por diseño.',
      },
    ],
  },

  'schedule-backups': {
    intro:
      'Dockstash programa cuatro tipos de jobs por proyecto — backup, prune, check y drill — cada uno con su propia expresión cron, ejecutados por una cola serializada que garantiza un job por repositorio a la vez. Configura un respaldo diario, un prune semanal con tu retención y un simulacro semanal, y la plataforma ejecuta y verifica tus respaldos sin ti.',
    steps: {
      'open-schedule': {
        title: 'Abre la pestaña Schedule del proyecto',
        body: 'Ve a la pantalla de detalle del proyecto y abre la pestaña Schedule. Programar exige un plan de pago: Free solo ejecuta respaldos manuales, Pro permite hasta cada hora, Business cualquier expresión cron.',
      },
      'pick-frequency': {
        title: 'Elige la frecuencia de respaldo',
        body: 'Escoge diario, semanal o una expresión cron personalizada — la sintaxis se valida mientras escribes (0 3 * * * = a diario a las 03:00). Diario a una hora tranquila es el valor por defecto correcto; pasa a cada hora solo si perder un día de escrituras es inaceptable.',
      },
      'add-prune': {
        title: 'Añade una programación de prune con retención',
        body: 'El prune es a propósito un tipo de job separado — retiene el candado del repositorio y borra datos, así que nunca corre en la misma ejecución que un respaldo. Añade un prune semanal y define tu política de retención (conservar N diarios / semanales / mensuales); se traduce directamente a restic forget --prune.',
      },
      'add-check-drill': {
        title: 'Añade verificaciones de integridad y un simulacro de restauración',
        body: 'Programa un check (restic check — integridad estructural, barato, diario está bien) y un drill (restauración completa a un espacio aislado con diffs de bytes y filas — costoso, semanal es el punto justo). El simulacro convierte « el respaldo existe » en « el respaldo se restaura ».',
      },
      'save-and-watch': {
        title: 'Guarda y observa la primera ejecución programada',
        body: 'Guarda la programación y deja que se dispare. Cada job en marcha transmite su salida restic en vivo al panel de logs. Dos programaciones que chocan sobre el mismo repositorio se serializan automáticamente — restic corrompe repositorios bajo acceso concurrente, así que la cola es el contrato de corrección, no una optimización.',
      },
    },
    faq: [
      {
        question: '¿Por qué el prune no puede correr dentro del job de respaldo?',
        answer:
          'El prune retiene el candado del repo y es destructivo. Si un job combinado fallara a medias, podrías quedarte sin respaldo fresco y sin prune terminado. Programaciones separadas hacen que cada operación triunfe o falle sola.',
      },
      {
        question: '¿Qué pasa cuando dos programaciones se disparan a la vez?',
        answer:
          'Mismo repositorio: se serializan — la segunda espera a la primera. Repositorios distintos corren en paralelo. Un repo nunca ve dos operaciones restic concurrentes.',
      },
      {
        question: '¿Qué frecuencias cron permite mi plan?',
        answer:
          'Free no tiene programaciones (solo Backup Now manual). Pro permite hasta cada hora. Business cualquier expresión cron. El formulario rechaza lo que exceda el techo de tu plan.',
      },
      {
        question: '¿Las ejecuciones programadas reintentan al fallar?',
        answer:
          'Sí, con backoff exponencial acotado. Los fallos repetidos marcan la programación como fallida y disparan un correo de alerta — los fallos son ruidosos por diseño.',
      },
      {
        question: '¿Puedo ver un respaldo programado mientras corre?',
        answer:
          'Sí. Cada job transmite el stdout/stderr de restic línea a línea al panel de logs del proyecto por un socket en vivo, igual que un Backup Now manual.',
      },
    ],
  },

  'restore-a-backup': {
    intro:
      'Restaurar en Dockstash es deliberadamente seguro: eliges una instantánea en la pantalla Snapshots, escribes el nombre del proyecto para confirmar y restauras por defecto a una nueva ubicación — sobrescribir el proyecto vivo es un opt-in separado y explícito. La salida de restic se transmite en vivo mientras corre la restauración.',
    steps: {
      'open-snapshots': {
        title: 'Abre la pantalla Snapshots',
        body: 'Elige tu proyecto en la pantalla Snapshots. Obtienes una línea de tiempo de puntos de restauración — cada respaldo exitoso es una instantánea con los archivos del proyecto, los volcados de bases y las configs capturados juntos.',
      },
      'pick-restore-point': {
        title: 'Elige el punto de restauración',
        body: 'Haz clic en Restore en la fila de la instantánea deseada. Normalmente la más reciente; tras un mal despliegue o corrupción de datos, la última instantánea anterior al incidente.',
      },
      'typed-confirm': {
        title: 'Escribe el nombre del proyecto para confirmar',
        body: 'Un diálogo de confirmación exige teclear el nombre exacto del proyecto. Es fricción intencionada — las restauraciones tienen consecuencias, y la confirmación tecleada elimina los accidentes de proyecto equivocado.',
      },
      'choose-mode': {
        title: 'Elige el modo de restauración',
        body: 'Mantén el valor por defecto « Restore to new location » e introduce una ruta destino: la instantánea se materializa allí y el proyecto vivo queda intacto. « Overwrite existing » reemplaza el proyecto vivo y es un opt-in explícito — úsalo solo tras validar una vez los datos restaurados.',
      },
      'watch-logs': {
        title: 'Observa el flujo de restauración',
        body: 'La salida de restic fluye al panel de logs bajo la tabla mientras se materializan archivos y volcados. Al terminar, la ruta destino contiene los archivos del proyecto más el volcado de base de esa instantánea.',
      },
      'validate-result': {
        title: 'Valida antes de conmutar',
        body: 'Carga el volcado restaurado en un contenedor de base de datos de prueba y sondea las tablas de tu app. Solo entonces reapunta tu aplicación o repite la restauración en modo sobrescritura. Para esta prueba en continuo, programa un simulacro de restauración.',
      },
    },
    faq: [
      {
        question: '¿Restaurar sobrescribirá mi proyecto en marcha?',
        answer:
          'No, salvo que elijas explícitamente « Overwrite existing ». El modo por defecto restaura a una nueva ubicación que tú indicas, dejando el proyecto vivo intacto.',
      },
      {
        question: '¿Puedo restaurar un solo archivo o solo la base de datos?',
        answer:
          'La instantánea contiene archivos, volcados y configs juntos. Restaura a una nueva ubicación y toma lo que necesites del árbol restaurado — la forma más segura de escoger piezas.',
      },
      {
        question: '¿Cómo restauro en un servidor totalmente nuevo?',
        answer:
          'Levanta un Dockstash nuevo, apúntalo al mismo VPS de almacenamiento e importa tu sobre de exportación de configuración con la misma clave maestra de cifrado. Los repositorios se descifran y cada instantánea es restaurable. Consulta el runbook de bootstrap recovery en la documentación.',
      },
      {
        question: '¿Qué tan rápida es una restauración?',
        answer:
          'Las restauraciones de restic van aproximadamente a la velocidad de tu red y tu disco; el panel muestra el progreso en vivo línea a línea. Restaurar a una nueva ubicación también significa que la app sigue en pie mientras corre la restauración.',
      },
    ],
  },

  'restore-drills': {
    intro:
      'Un respaldo está sin probar hasta que se restaura. Un simulacro de restauración restaura tu última instantánea en un espacio de trabajo aislado, compara byte a byte cada archivo restaurado con la fuente, hace diff de filas de los volcados de bases y estampa una insignia de éxito/fallo en el proyecto — automáticamente, con programación. Es la diferencia entre creer en tus respaldos y saber.',
    steps: {
      'schedule-drill': {
        title: 'Programa un simulacro semanal',
        body: 'En la pestaña Schedule del proyecto añade una programación de drill. Semanal es la cadencia recomendada: los simulacros son la prueba cara (una restauración real), mientras el check estructural barato (restic check) puede correr a diario en paralelo.',
      },
      'run-drill-now': {
        title: 'O dispara uno ahora',
        body: 'La pestaña Restore drill del detalle del proyecto muestra el último resultado y permite lanzar uno de inmediato. El simulacro restaura a un espacio aislado — tu proyecto vivo y tu repositorio nunca se tocan.',
      },
      'read-report': {
        title: 'Lee el informe del simulacro',
        body: 'Un simulacro solo pasa con cero discrepancias: cada archivo idéntico byte a byte, cada volcado consistente fila a fila. El proyecto muestra lastDrillAt y una insignia de éxito/fallo — « Verified » significa que una restauración real funcionó, no que un respaldo simplemente exista.',
      },
      'fix-failures': {
        title: 'Trata un simulacro fallido como un incidente',
        body: 'Un simulacro fallido dispara un correo de alerta con el detalle de discrepancias. Causas comunes: volcados rotos de un servicio que esquivó el adaptador, archivos cambiados por un despliegue concurrente durante el respaldo, o corrupción del repositorio (confírmala con un check con lectura de datos). Corrige la causa, ejecuta Backup Now y repite el simulacro.',
      },
    },
    faq: [
      {
        question: '¿Qué compara exactamente un simulacro?',
        answer:
          'Cada ruta fuente y config se compara por hash de bytes con su espejo restaurado, y el volcado restaurado de cada capa de base activa se compara fila a fila (o se parsea) contra la fuente. Cualquier discrepancia hace fallar el simulacro — no hay aprobado parcial.',
      },
      {
        question: '¿Un simulacro puede romper mi proyecto vivo?',
        answer:
          'No. Los simulacros restauran a un espacio aislado y lo limpian después, incluso si el simulacro lanza una excepción. Proyecto vivo, contenedores y repositorio son participantes de solo lectura.',
      },
      {
        question: '¿En qué difiere un simulacro de restic check?',
        answer:
          'restic check prueba que el repositorio está estructuralmente sano (sin packs perdidos, sin índice podrido). Solo un simulacro prueba que el repositorio realmente se restaura a datos funcionales. Checks diarios, simulacros semanales.',
      },
      {
        question: '¿Los simulacros corren en agentes de flota?',
        answer:
          'Todavía no — los simulacros se ejecutan en el servidor principal. Los proyectos remotos mantienen respaldo, check, prune y restauración en su agente.',
      },
    ],
  },

  'notifications-alerts': {
    intro:
      'Dockstash hace el fallo ruidoso. Cualquier respaldo, restauración o simulacro fallido dispara de inmediato un correo de alerta al dueño del proyecto, y un heartbeat de tipo dead-man\'s switch atrapa el caso silencioso en que nada falló porque nada corrió. Cada alerta lleva el proyecto, el error, la marca del último éxito y un enlace directo.',
    steps: {
      'understand-triggers': {
        title: 'Conoce qué dispara una alerta',
        body: 'Cuatro tipos: un respaldo fallido (cualquier capa — volcado, restic, espacio en disco), una restauración fallida, un simulacro fallido (discrepancia de bytes o filas) y una alerta de heartbeat cuando un proyecto no tuvo respaldo exitoso dentro de la ventana. No configuras reglas por fallo — los fallos siempre alertan.',
      },
      'set-heartbeat': {
        title: 'Ajusta la ventana de heartbeat',
        body: 'El umbral de heartbeat (24 horas por defecto) es la ventana de « el silencio es un fallo »: si el último respaldo exitoso de un proyecto es más antiguo, recibes una alerta — incluidos los proyectos que nunca han tenido éxito. Las alertas se deduplican dentro de la ventana y se reinician en cuanto un respaldo triunfa.',
      },
      'add-webhook': {
        title: 'Añade un webhook para tu guardia',
        body: 'Define una URL de webhook de alertas y cada alerta también hace POST de su carga JSON allí — conéctala a Slack, PagerDuty o tu propio bot. Correo y webhook llevan la misma carga: tus automatizaciones ven exactamente lo que tú ves.',
      },
      'review-audit': {
        title: 'Usa el registro de auditoría',
        body: 'Las acciones destructivas y facturables (ejecuciones de respaldo, disparos de restauración, borrados de programación, cambios de plan) se anexan a un registro de auditoría inmutable con actor, acción, objetivo, IP y marca temporal — sin vía de edición ni borrado. Revísalo desde tu cuenta o por la API de auditoría.',
      },
    },
    faq: [
      {
        question: '¿Me llenarán de correo si un proyecto falla sin parar?',
        answer:
          'Las alertas de heartbeat se deduplican durante la ventana antes de realertar, y un respaldo exitoso limpia la deduplicación al instante. Las alertas de fallo salen por ejecución fallida — si las ejecuciones fallan sin parar, eso es señal, no spam.',
      },
      {
        question: '¿Qué contiene la carga de la alerta?',
        answer:
          'El nombre del proyecto, el detalle del error, la marca del último éxito y un enlace directo al panel del proyecto. El webhook recibe los mismos campos como JSON.',
      },
      {
        question: '¿Por qué recibí una alerta si nada falló?',
        answer:
          'Es el heartbeat: ningún respaldo exitoso llegó dentro de la ventana. Una programación en pausa, un agente parado o un proyecto que nunca corrió se ven idénticos en el silencio — el dead-man\'s switch existe exactamente para esos casos.',
      },
      {
        question: '¿Un monitoreo externo puede vigilar al propio Dockstash?',
        answer:
          'Sí — apunta tu monitor de uptime al endpoint de salud sin autenticación (200 con la pila sana, 503 degradada). Hay contadores agregados en un endpoint de métricas sin datos personales.',
      },
    ],
  },

  'retention-policy': {
    intro:
      'La retención decide cuánta historia conservas: N instantáneas diarias, N semanales y N mensuales por proyecto. Dockstash mapea tu política directamente sobre restic forget --prune, ejecutado por un job de prune programado — las instantáneas viejas se recortan automáticamente y el repositorio se mantiene compacto sin tocar jamás los puntos de restauración recientes.',
    steps: {
      'open-retention': {
        title: 'Abre Settings → Retention',
        body: 'La retención se configura de forma central en Settings. Tu plan acota la ventana: Free conserva 7 días, Pro 30, Business 90 — la política que definas se limita al techo de tu plan.',
      },
      'choose-keep': {
        title: 'Elige los contadores de conservación',
        body: 'Un valor sólido: conservar 7 diarias, 4 semanales, 6 mensuales. Tienes restauraciones al día durante una semana, a la semana durante un mes y al mes durante medio año — mientras el repositorio se mantiene pequeño gracias a la deduplicación de restic.',
      },
      'schedule-prune': {
        title: 'Programa el job de prune',
        body: 'Añade una programación de prune semanal en cada proyecto. Tus contadores se traducen uno a uno en opciones de restic forget — el comando de abajo es exactamente lo que ejecuta una política 7/4/6. El prune es su propio tipo de job porque bloquea el repo y borra datos; nunca va a cuestas de un respaldo.',
      },
      'verify-prune': {
        title: 'Verifica que el prune funciona',
        body: 'Tras el primer prune, mira la tarjeta del proyecto: el número de instantáneas debe estabilizarse y el tamaño del repo dejar de crecer sin fin. La línea de tiempo de Snapshots muestra exactamente qué puntos de restauración quedan.',
      },
    },
    faq: [
      {
        question: '¿El prune puede borrar mi único respaldo reciente?',
        answer:
          'No. Los contadores de conservación siempre preservan las instantáneas más recientes de cada categoría — el prune recorta la cola vieja, nunca la cabeza fresca. Una política de 7 diarias siempre retiene las últimas siete instantáneas diarias.',
      },
      {
        question: '¿Qué pasa con la retención si bajo de plan?',
        answer:
          'El techo de retención del nuevo plan aplica en adelante, y los respaldos existentes nunca se borran al bajar de plan — los proyectos por encima del cupo se pausan (solo lectura), no se purgan.',
      },
      {
        question: '¿Por qué mi repositorio sigue grande tras el prune?',
        answer:
          'restic forget elimina instantáneas; el pase --prune después re-empaqueta y libera los datos sin referencia. El espacio baja al completar el prune, no tras el simple forget — revisa el resumen de re-empaquetado en el log del job.',
      },
      {
        question: '¿Necesito prune si tengo pocas instantáneas?',
        answer:
          'Con el tiempo, sí. Sin prune, cada instantánea vive para siempre y el repo crece sin límite. Un prune semanal con contadores sensatos es un seguro barato contra un disco de almacenamiento lleno — que es en sí un modo de fallo de respaldo.',
      },
    ],
  },

  'storage-destinations': {
    intro:
      'Dockstash guarda los respaldos en una máquina que tú controlas: un VPS de almacenamiento accesible por SSH, con repositorios restic cifrados. Ninguna nube de terceros se interpone entre tus datos y tú — la configuración es una identidad SSH más una contraseña de cifrado, y ambas quedan en tus manos.',
    steps: {
      'prepare-vps': {
        title: 'Prepara una máquina de almacenamiento',
        body: 'Sirve cualquier VPS Linux o servidor casero accesible por SSH — necesita espacio en disco y un usuario SSH, nada más que instalar. Usa una máquina distinta (idealmente otro proveedor u otra ubicación) de la que ejecuta tus proyectos: un respaldo en la misma caja muere con la caja.',
      },
      'add-ssh-key': {
        title: 'Añade la conexión SSH',
        body: 'En el asistente de configuración (o después en Settings → Storage) introduce host, usuario, puerto y una clave privada SSH. La clave es de solo escritura — tras guardarla no se muestra nunca más. Dockstash empuja instantáneas restic por SFTP con esa identidad.',
      },
      'save-encryption-password': {
        title: 'Guarda la contraseña de cifrado — se muestra una sola vez',
        body: 'El asistente genera una contraseña de cifrado de repositorio robusta y la muestra exactamente una vez. Cópiala a un gestor de contraseñas antes de pulsar Done. No es recuperable: perderla significa que los repositorios no podrán descifrarse, por nadie, nunca.',
      },
      'verify-connection': {
        title: 'Verifica con un primer respaldo',
        body: 'Ejecuta Backup Now en cualquier proyecto. Una ejecución verde prueba que el VPS de almacenamiento es alcanzable, que la identidad SSH funciona y que el repositorio se inicializó y cifró correctamente. La tarjeta del proyecto muestra después el tamaño del repo creciendo en la máquina de almacenamiento.',
      },
      'plan-recovery': {
        title: 'Planifica la recuperación ante pérdida total',
        body: 'Guarda tres cosas en lugares separados: el VPS de almacenamiento (tus repos), tu clave maestra de cifrado y tu sobre de exportación de configuración. Con las tres, un servidor de producción destruido es una reconstrucción, no una pérdida de datos — el runbook de bootstrap recovery lo recorre paso a paso.',
      },
    },
    faq: [
      {
        question: '¿Puedo usar cualquier proveedor como destino de almacenamiento?',
        answer:
          'Cualquier cosa a la que llegues por SSH: un VPS de almacenamiento barato, una storage box de Hetzner, un NAS en otro sitio. Si habla SSH/SFTP y tiene disco, restic puede mantener repositorios allí.',
      },
      {
        question: '¿Quién puede leer mis respaldos en la caja de almacenamiento?',
        answer:
          'Nadie sin tu contraseña de cifrado. restic cifra los repositorios con AES antes de que salgan de tu servidor; la caja de almacenamiento solo ve texto cifrado.',
      },
      {
        question: '¿Y si pierdo la contraseña de cifrado?',
        answer:
          'Los repositorios son irrecuperables — ese es el sentido del cifrado real. Guarda la contraseña en un gestor en cuanto el asistente la muestre, y respalda por separado la clave maestra y el sobre de exportación.',
      },
      {
        question: '¿Puedo rotar la contraseña de cifrado o la clave SSH?',
        answer:
          'Sí. Settings → Encryption password rota la contraseña del repo (con una confirmación explícita de « la he guardado »), y Settings → Storage acepta una clave SSH nueva en cualquier momento.',
      },
    ],
  },

  'troubleshooting-backups': {
    intro:
      'Cuando un respaldo falla, Dockstash lo dice alto y te muestra dónde: un correo de alerta con el error, una insignia de estado en la tarjeta del proyecto y la salida completa de restic en el panel de logs en vivo. Esta guía recorre las formas de fallo comunes — ejecuciones en rojo, agentes fuera de línea, la alarma de silencio — y sus arreglos.',
    steps: {
      'check-status': {
        title: 'Empieza por la tarjeta del proyecto',
        body: 'La pantalla Projects muestra insignia de estado, hora del último respaldo y tamaño por proyecto. Una ejecución fallida también llega como correo de alerta con el error y un enlace directo — empieza por cualquiera de los dos. La vista de detalle expone directamente el detalle del último fallo.',
      },
      'read-live-logs': {
        title: 'Lee la salida restic de la ejecución',
        body: 'Abre el panel de logs de la ejecución fallida. Las últimas líneas casi siempre nombran la causa: authentication failed (clave SSH o credenciales de base), no space left on device (caja de almacenamiento llena), connection refused (VPS de almacenamiento inalcanzable) o un error del comando de volcado dentro del contenedor.',
      },
      'stale-lock': {
        title: 'Los candados restic obsoletos se arreglan solos',
        body: 'Si una ejecución se estrelló o el servidor se reinició a mitad de respaldo, el repositorio puede quedar bloqueado. No intervengas: la siguiente ejecución detecta el candado huérfano y ejecuta restic unlock automáticamente. Un candado retenido por un job realmente en marcha nunca se rompe.',
      },
      'agent-offline': {
        title: 'Proyectos en agente: revisa primero el agente',
        body: 'Si un proyecto de agente de flota deja de respaldar, mira la pantalla Fleet. Un agente fuera de línea significa que los heartbeats pararon: en el VPS confirma que ambos contenedores del agente corren, que la URL de Dockstash es alcanzable y que el token no se rotó sin actualizar el contenedor. 401 repetidos en los logs significan que un contenedor viejo en alguna parte aún late con un token revocado.',
      },
      'heartbeat-alerts': {
        title: 'Entiende las alertas de « ningún respaldo corrió »',
        body: 'Una alerta de heartbeat significa que ningún respaldo exitoso llegó dentro de la ventana — nada falló, nada corrió. Sospechosos habituales: la programación se desactivó, el plan no permite programaciones, el proyecto quedó pausado tras una bajada de plan, o el agente asignado está fuera de línea. Corrige la causa y la siguiente ejecución verde limpia la alarma.',
      },
    },
    faq: [
      {
        question: 'Un respaldo falló una vez y triunfó al reintentar. ¿Debo preocuparme?',
        answer:
          'Mira la razón del fallo. Los jobs reintentan con backoff exponencial acotado: los tropiezos de red transitorios se curan solos. Reintentos recurrentes sobre el mismo error — disco llenándose, SSH inestable — merecen un arreglo real antes de volverse un fallo duro.',
      },
      {
        question: '¿Por qué mi segunda programación espera en lugar de correr?',
        answer:
          'Un job por repositorio a la vez, siempre. Las operaciones restic concurrentes corrompen repositorios, así que las programaciones que chocan sobre el mismo repo se serializan a propósito. Repos distintos corren en paralelo.',
      },
      {
        question: 'El selector Add-Project de mi agente está vacío. ¿Por qué?',
        answer:
          'El selector lee la instantánea que el agente empujó en su último heartbeat. Vacío significa: el agente aún no ha reportado, un directorio de proyectos no está realmente montado en el contenedor del agente, o el proxy del socket Docker es inalcanzable — el aviso del selector te dice cuál es. Arréglalo y pulsa Refresh now en lugar de esperar al siguiente ciclo de descubrimiento.',
      },
      {
        question: '¿Cómo pruebo que el propio repositorio está sano?',
        answer:
          'Ejecuta un job de check. restic check verifica la estructura del repositorio; con un porcentaje de lectura de datos también lee y verifica el contenido real de los packs. Pasar exige código de salida cero — no hay verdes falsos.',
      },
      {
        question: '¿Dónde veo por qué falló un simulacro?',
        answer:
          'El resultado del simulacro guarda un mensaje de detalle con el número de discrepancias, visible en la pestaña Restore drill y en el correo de alerta. Discrepancias de bytes apuntan a archivos que cambiaron durante el respaldo; de filas, a la consistencia del volcado — en ambos casos trata el respaldo como no probado hasta que una nueva ejecución pase.',
      },
    ],
  },
};
