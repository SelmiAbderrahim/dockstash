# Alertas, auditoría y salud

Dockstash hace ruido cuando algo falla. Cualquier copia de seguridad,
restauración o ensayo fallido dispara un correo inmediato (vía Resend) al
propietario del proyecto. Un heartbeat tipo dead-man's-switch detecta
interrupciones silenciosas — cuando nada falló pero nada corrió.

## Qué dispara una alerta

| Tipo | Cuándo |
|---|---|
| `backup` | Una ejecución de copia falla. |
| `restore` | Una restauración falla. |
| `drill` | Un ensayo programado falla. |
| `heartbeat` | Sin copia correcta en las últimas `ALERT_HEARTBEAT_HOURS` horas. |

Cada correo lleva nombre del proyecto, error, timestamp del último éxito y
enlace al panel. Si `ALERT_WEBHOOK_URL` está definido, la misma carga se envía
como JSON allí.

## Ventana del heartbeat

`ALERT_HEARTBEAT_HOURS` (por defecto `24`) marca el umbral. Si la última copia
correcta es más antigua, el barrido alerta una vez y deduplica dentro de la
misma ventana.

## Registro de auditoría

Acciones destructivas o facturables se añaden a un registro inmutable:
`backup.run`, `backup.restore`, `backup.delete`, `plan.change`. Cada entrada
guarda actor, acción, objetivo, IP y timestamp.

Obtén tu registro: `GET /api/audit` (ámbito propietario, requiere auth).

## Endpoints de salud y métricas

- `GET /api/health` — sonda de readiness (200/503).
- `GET /api/metrics` — contadores agregados.
- `GET /api/health/projects` — por proyecto, ámbito propietario.

## Variables de entorno

| Var | Propósito |
|---|---|
| `RESEND_API_KEY` | Clave Resend. |
| `RESEND_FROM` | Remitente. |
| `ALERT_HEARTBEAT_HOURS` | Umbral de interrupción silenciosa. |
| `ALERT_WEBHOOK_URL` | Webhook opcional. |
