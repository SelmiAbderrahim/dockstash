# Usar el panel de control

Dockstash ofrece cuatro pantallas y un asistente de configuración único. Cada pantalla tiene una acción principal.

## Asistente de configuración
1. **VPS de almacenamiento** — host, usuario, puerto y clave SSH privada.
2. **Contraseña de cifrado** — se muestra una sola vez. Cópiala al instante.
3. **Confirmar** — marca "La guardé — perderla = repositorios irrecuperables" para habilitar **Hecho**.

## Proyectos
Cada carpeta en `/var/www` aparece como tarjeta. Acción principal: **Copiar ahora** con salida restic en vivo.

## Detalle de proyecto
Tres pestañas en `?tab=`:
- **Plan** — archivos, bases, Traefik.
- **Programación** — diaria / semanal / cron personalizado con validación inline.
- **Prueba de restauración** — estado del último drill.

## Instantáneas
Selecciona proyecto y punto de restauración, luego **Restaurar**. El diálogo exige escribir el nombre exacto del proyecto. Modo por defecto: nueva ubicación; sobrescribir requiere opt-in explícito.

## Ajustes
Tres pestañas en `?tab=`: Almacenamiento, Retención, Contraseña de cifrado.
