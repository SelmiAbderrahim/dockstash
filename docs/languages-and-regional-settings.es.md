# Idiomas y configuración regional

Dockstash incluye siete idiomas de interfaz. El que ves se elige automáticamente en tu primera visita y puedes cambiarlo cuando quieras.

## Idiomas admitidos

- English (`en`) — predeterminado
- العربية (`ar`) — diseño de derecha a izquierda
- Français (`fr`)
- Deutsch (`de`)
- Español (`es`)
- Русский (`ru`)
- 中文 (`zh`)

## Detección automática

- **En el navegador** leemos `navigator.language`. Si coincide con uno de los siete idiomas (incluidas variantes como `es-419` → español), lo usamos. Si no, volvemos a inglés.
- **En el servidor** analizamos el encabezado `Accept-Language` (con valores de calidad) para que los mensajes de error, los correos transaccionales y las respuestas de la API estén traducidas. Un encabezado `x-lang` o una cookie `lang` tienen prioridad.

## Cambiar de idioma

Usa el conmutador **Idioma** en la navegación. Tu elección se guarda un año en la cookie `lang`.

## De derecha a izquierda (RTL)

Al elegir **العربية**, establecemos `<html lang="ar" dir="rtl">` y todo el diseño se refleja.

## Para desarrolladores

- La variable de entorno opcional `DEFAULT_LOCALE` controla el idioma predeterminado del servidor.
- Consulta `client/src/shared/i18n/README.md` y `server/src/shared/i18n/README.md`.
