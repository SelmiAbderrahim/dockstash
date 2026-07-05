import type { DictionaryShape } from './en.js';

export const es: DictionaryShape = {
  common: {
    ok: 'OK',
    cancel: 'Cancelar',
    save: 'Guardar',
    delete: 'Eliminar',
    yes: 'Sí',
    no: 'No',
  },
  errors: {
    badRequest: 'Solicitud no válida.',
    unauthorized: 'Debes iniciar sesión para hacer eso.',
    forbidden: 'No tienes permiso para hacer eso.',
    notFound: 'No se encontró el recurso solicitado.',
    conflict: 'Conflicto: el recurso ya existe.',
    internal: 'Algo salió mal por nuestra parte. Inténtalo de nuevo.',
    validationFailed: 'Validación fallida.',
    projectNotFound: 'Proyecto no encontrado.',
    userNotFound: 'Usuario no encontrado.',
    invalidCredentials: 'Correo o contraseña no válidos.',
    emailAlreadyRegistered: 'Ese correo ya está registrado.',
    passwordTooShort: 'La contraseña debe tener al menos 8 caracteres.',
    emailNotVerified: 'Verifica tu dirección de correo electrónico para continuar.',
  },
  auth: {
    login: {
      title: 'Iniciar sesión',
      email: 'Correo electrónico',
      password: 'Contraseña',
      submit: 'Entrar',
      submitting: 'Entrando…',
      forgot: '¿Olvidaste tu contraseña?',
    },
    register: {
      title: 'Crear cuenta',
      submit: 'Crear cuenta',
    },
    reset: {
      title: 'Restablecer contraseña',
      submit: 'Restablecer',
      sent: 'Se envió un enlace de restablecimiento a tu correo.',
      tokenInvalid: 'Ese enlace de restablecimiento no es válido o ha expirado. Solicita uno nuevo.',
    },
    verify: {
      success: 'Tu dirección de correo ha sido verificada. Ya puedes usar Dockstash.',
      resent: 'Si esa cuenta necesita verificación, un nuevo enlace está en camino.',
      tokenInvalid: 'Ese enlace de verificación no es válido o ha expirado.',
    },
    otp: {
      sent: 'Se ha enviado un código de verificación a tu correo electrónico.',
      invalid: 'Ese código de verificación no es válido o ha caducado.',
      tooManyAttempts: 'Demasiados códigos incorrectos. Inicia sesión de nuevo para obtener un código nuevo.',
    },
  },
  billing: {
    checkout: {
      title: 'Pago',
      submit: 'Pagar ahora',
      success: 'Pago recibido. ¡Gracias!',
    },
    portal: {
      title: 'Facturación',
    },
    error: {
      notConfigured: 'El proveedor de pagos no está configurado.',
      userNotFound: 'Usuario no encontrado.',
      noCustomer: 'No se encontró un cliente de facturación para este usuario.',
      noSubscription: 'No se encontró una suscripción activa para este usuario.',
      providerFailure: 'Error del proveedor de pagos: {{message}}',
    },
    entitlements: {
      projectLimitReached: 'Tu plan no permite más proyectos. Actualiza para añadir otro.',
      schedulesLocked: 'Las copias de seguridad programadas no están disponibles en tu plan actual.',
      frequencyNotAllowed: 'Tu plan no permite esa frecuencia de programación.',
      restoreDrillsLocked: 'Las pruebas de restauración automáticas están disponibles en los planes Pro y Business.',
      pitrLocked: 'La restauración a un punto en el tiempo está disponible en los planes Pro y Business.',
      mirrorLocked: 'El modo espejo está disponible en el plan Business.',
      multiVpsLocked: 'La vista de flota multi-VPS está disponible en el plan Business.',
      projectPaused: 'Este proyecto está en pausa. Reactívalo o actualiza tu plan para ejecutar copias.',
      selectionInvalid: 'Debes elegir entre uno y {{cap}} proyectos para mantener activos.',
      notOwner: 'No eres propietario de uno o más de esos proyectos.',
    },
  },
  email: {
    contact: {
      confirmation: 'Tu mensaje ha sido enviado. Te contactaremos pronto.',
    },
    verifyEmail: {
      subject: 'Verifica tu dirección de correo electrónico',
      body:
        'Bienvenido a Dockstash. Confirma tu dirección de correo para activar tu cuenta.\n\n' +
        'Haz clic en el siguiente enlace o pégalo en tu navegador:\n\n{{verifyUrl}}\n\n' +
        'Este enlace caduca en 24 horas. Si no creaste una cuenta, ignora este correo.\n',
    },
    passwordReset: {
      subject: 'Restablece tu contraseña',
      body:
        'Recibes este correo porque tú (u otra persona) has solicitado restablecer la contraseña de tu cuenta.\n\n' +
        'Haz clic en el siguiente enlace, o pégalo en tu navegador, para completar el proceso:\n\n{{resetUrl}}\n\n' +
        'Si no lo solicitaste, ignora este correo y tu contraseña no cambiará.\n',
    },
    passwordChanged: {
      subject: 'Tu contraseña fue cambiada',
      body:
        'Recibes este correo porque la contraseña de tu cuenta acaba de cambiar.\n\n' +
        'Si no fuiste tú, contáctanos de inmediato.',
    },
    welcome: {
      subject: 'Te damos la bienvenida a Dockstash',
      body:
        'Te damos la bienvenida a Dockstash, {{name}}.\n\n' +
        'Inicia sesión y gestiona tus copias de seguridad en {{clientUrl}}.\n',
    },
    paymentReceipt: {
      subject: 'Tu recibo de Dockstash',
      body:
        'Gracias por tu pago de {{amount}} por el plan {{plan}}.\n\n' +
        'Gestiona la facturación en {{clientUrl}}/billing.\n',
    },
    dunning: {
      subject: 'Problema de pago en tu suscripción de Dockstash',
      body:
        'No pudimos cobrar tu método de pago para el plan {{plan}}.\n\n' +
        'Actualízalo antes del {{graceEndsAt}} para mantener el plan: {{clientUrl}}/billing.\n',
    },
    drillFailure: {
      subject: 'Ensayo de restauración FALLIDO — proyecto {{project}}',
      body:
        'Un ensayo de restauración programado para el proyecto «{{project}}» falló el {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Última copia de seguridad correcta: {{lastGoodAt}}\n\n' +
        'Abre el panel: {{clientUrl}}/projects/{{projectId}}\n',
    },
    backupFailure: {
      subject: 'Copia de seguridad FALLIDA — proyecto {{project}}',
      body:
        'Una ejecución de copia de seguridad para el proyecto «{{project}}» falló el {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Última copia de seguridad correcta: {{lastGoodAt}}\n\n' +
        'Abre el panel: {{clientUrl}}/projects/{{projectId}}\n',
    },
    restoreFailure: {
      subject: 'Restauración FALLIDA — proyecto {{project}}',
      body:
        'Una restauración para el proyecto «{{project}}» falló el {{failedAt}}.\n\n' +
        'Error: {{error}}\n' +
        'Última copia de seguridad correcta: {{lastGoodAt}}\n\n' +
        'Abre el panel: {{clientUrl}}/projects/{{projectId}}\n',
    },
    heartbeatMiss: {
      subject: 'Interrupción silenciosa — sin copia de seguridad desde hace {{hours}}h en {{project}}',
      body:
        'No se ha ejecutado ninguna copia de seguridad correcta para el proyecto «{{project}}» en las últimas {{hours}} hora(s).\n\n' +
        'Última copia de seguridad correcta: {{lastGoodAt}}\n\n' +
        'Abre el panel: {{clientUrl}}/projects/{{projectId}}\n',
    },
    loginOtp: {
      subject: 'Tu código de inicio de sesión de Dockstash',
      body:
        'Tu código de verificación de inicio de sesión es: {{code}}\n\n' +
        'Caduca en {{minutes}} minutos. Si no intentaste iniciar sesión, cambia tu contraseña de inmediato.\n',
    },
    neverRun: 'nunca',
  },
  audit: {
    error: {
      notOwner: 'No tienes permiso para ver este registro de auditoría.',
    },
  },
  health: {
    error: {
      unavailable: 'Comprobación de salud no disponible: {{reason}}',
    },
  },
  backups: {
    error: {
      pathNotAllowed: 'La ruta {{path}} no está dentro de los directorios de proyectos permitidos para este destino de respaldo.',
      projectNotFound: 'Proyecto no encontrado.',
      notOwner: 'No eres el propietario de este proyecto.',
      scanFailed: 'Fallo al escanear el proyecto: {{message}}',
      discoverFailed: 'Fallo en la detección: {{message}}',
      noAdapter: 'Ningún adaptador de copia de seguridad coincide con el servicio {{service}}.',
      dumpFailed: 'Fallo del volcado de base de datos para {{service}}: {{message}}',
      resticFailed: 'Fallo de la copia Restic: {{message}}',
      backupFailed: 'La copia de seguridad falló: {{message}}',
      noSpace: 'Espacio en disco insuficiente (libre={{free}} bytes).',
      runnerUnavailable: 'El listado de instantáneas no está disponible: el ejecutor de copias no está configurado.',
      snapshotsFailed: 'No se pudieron listar las instantáneas: {{message}}',
      noSnapshotBeforeTs: 'No existe ninguna instantánea en {{ts}} o antes.',
      restoreFailed: 'La restauración falló: {{message}}',
    },
    success: {
      backupComplete: 'Copia de seguridad completada con éxito.',
    },
    check: {
      pass: 'Verificación del repositorio superada.',
      fail: 'Verificación del repositorio fallida: {{message}}',
    },
    drill: {
      pass: 'Simulacro de restauración superado: diffs de bytes y filas limpios.',
      fail: 'Simulacro de restauración fallido: {{message}}',
      failMismatches: 'Simulacro de restauración fallido: {{count}} discrepancia(s) — {{details}}',
      nothingToRestore: 'No hay snapshots para restaurar.',
    },
  },
  scheduler: {
    error: {
      invalidCron: 'Expresión cron no válida: {{expr}}',
      scheduleNotFound: 'Programación no encontrada.',
      notOwner: 'No eres propietario de esta programación.',
      repoBusy: 'El repositorio {{projectId}} está ocupado — otro trabajo está en ejecución.',
      entitlementDenied: 'Tu plan no permite esta programación.',
      pruneFailed: 'Prune fallido: {{message}}',
    },
    success: {
      scheduled: 'Programación guardada.',
      enqueued: 'Trabajo puesto en cola.',
      prunePassed: 'Prune completado con éxito.',
    },
    job: {
      failedRetriesExhausted: 'Trabajo fallido tras {{attempts}} intentos: {{message}}',
    },
  },
  recovery: {
    error: {
      importInvalid: 'El sobre de importación no es válido: {{message}}',
      importTampered: 'La comprobación de integridad del sobre de importación falló — no se pudo descifrar un secreto.',
      keyVersionMismatch: 'El sobre de importación referencia la versión de clave {{version}} que este agente no puede descifrar.',
      plaintextForbidden: 'El sobre de importación contiene un campo de secreto en texto plano ({{field}}) — importación rechazada.',
      selfBackupFailed: 'Fallo en la copia interna: {{message}}',
      userNotFound: 'Cuenta no encontrada.',
      notOwner: 'No es propietario de uno o más de los proyectos referenciados.',
      storageUnreachable: 'El repositorio de almacenamiento no es accesible: {{message}}',
    },
    success: {
      exportReady: 'La exportación de configuración está lista.',
      imported: 'Importación de configuración completada correctamente.',
      escrowEnabled: 'Códigos de recuperación generados. Guárdalos ahora — no se volverán a mostrar.',
      selfBackupComplete: 'Copia interna completada correctamente.',
    },
  },
  settings: {
    error: {
      storageNotConfigured: 'El almacenamiento no está configurado. Añade primero la conexión de tu VPS de almacenamiento.',
      connectionFailed: 'La prueba de conexión al almacenamiento falló: {{message}}',
      hostKeyNotPinned: 'La clave de host del almacenamiento aún no se ha verificado. Ejecuta primero una prueba de conexión.',
    },
  },
  agents: {
    error: {
      notFound: 'Agente no encontrado.',
      notOwner: 'No eres el propietario de este agente.',
      unauthorized: 'Error de autenticación del agente.',
      jobNotFound: 'Tarea del agente no encontrada.',
      drillNotSupported: 'Los simulacros de restauración aún no son compatibles con agentes remotos.',
      duplicateHost: 'Ya existe un agente para este host.',
    },
  },
  language: {
    switcher: {
      label: 'Idioma',
    },
    names: {
      en: 'English',
      ar: 'العربية',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      ru: 'Русский',
      zh: '中文',
    },
  },
  superadmin: {
    error: {
      cannotModifySuperadmin: 'Las cuentas de superadministrador no se pueden modificar ni eliminar.',
    },
    success: {
      roleChanged: 'Rol de usuario actualizado.',
      userVerified: 'Correo del usuario marcado como verificado.',
      legalHoldUpdated: 'Retención legal actualizada.',
      deletionScheduled: 'Eliminación de la cuenta programada.',
    },
  },
  security: {
    error: {
      rateLimited: 'Demasiadas solicitudes. Inténtalo de nuevo más tarde.',
      csrfInvalid: 'Token CSRF ausente o inválido.',
      hostKeyMalformed: 'La huella de la clave del host de almacenamiento es incorrecta.',
      hostKeyMismatch: 'Discrepancia en la clave del host de almacenamiento. Se esperaba {{expected}}, se observó {{observed}}. Conexión rechazada.',
    },
    legalHold: {
      pruneSkipped: 'Purga de retención omitida: el proyecto está bajo retención legal.',
      deletionBlocked: 'La eliminación de la cuenta está bloqueada mientras la retención legal esté activa.',
    },
    deletion: {
      alreadyScheduled: 'La eliminación de la cuenta ya está programada.',
      notConfigured: 'La cola de eliminación no está configurada.',
      purgeFailed: 'Falló la purga del repositorio de copias de seguridad: {{message}}',
      warningSubject: 'Se eliminará tu cuenta de Dockstash',
      warningBody:
        'Hola {{name}}, solicitaste eliminar tu cuenta de Dockstash. Tus datos se eliminarán definitivamente el {{purgeAt}}.',
    },
  },
};
