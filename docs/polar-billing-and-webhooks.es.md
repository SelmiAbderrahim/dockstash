# Facturación con Polar y webhooks

Dockstash usa Polar como proveedor de pago activo detrás de una interfaz
neutral. El adaptador de Stripe permanece en el código pero está inactivo por
defecto.

## Endpoints

- `POST /api/billing/checkout` (auth) — iniciar una sesión de pago alojada.
- `GET  /api/billing/portal` (auth) — abrir el portal del cliente alojado.
- `POST /api/billing/change-plan` (auth) — cambiar el producto de la suscripción activa.
- `POST /api/billing/webhook` — entregas de Polar. Verificar antes de analizar.

## URL del webhook

Configura `https://<tu-servidor>/api/billing/webhook` en el panel de Polar.

## Firma Standard Webhooks

Dockstash verifica cada entrega con el esquema [Standard Webhooks](https://standardwebhooks.com):

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- Cabecera: `webhook-signature: v1,<sig> [v1,<sig> ...]`
- Se rechazan las marcas de tiempo fuera de ±5 minutos.

La verificación se ejecuta sobre los bytes crudos; el cuerpo nunca se
`JSON.parse` antes de que la firma sea válida.

## Idempotencia

Cada entrega se INSERTA en la colección `webhook_event` con la restricción única
`(provider, eventId)`. Las entregas duplicadas responden `200` con el estado
almacenado — ningún handler se ejecuta dos veces. Si el handler falla, la fila
pasa a `failed` y `retryCount` se incrementa; Polar reintenta con backoff.

## Reconciliación

`reconcileSubscriptions()` se ejecuta cada 15 minutos. Consulta las
suscripciones activas de Polar y repara la desviación en las filas locales de
`Subscription` (estado, `currentPeriodEnd`, `cancelAtPeriodEnd`). Nunca crea
filas que Polar no reporte, y un registro fallido no aborta el bucle.

## Entorno

| Variable | Propósito |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. Predeterminado `none`. |
| `POLAR_ACCESS_TOKEN` | Solo servidor. Cifrado en reposo con `MASTER_ENCRYPTION_KEY`. |
| `POLAR_WEBHOOK_SECRET` | Secreto Standard Webhooks. Se acepta `whsec_…`. |
| `POLAR_SERVER` | `sandbox` (predeterminado) o `production`. |
| `POLAR_PRO_PRODUCT_ID` | ID de producto → plan `pro`. |
| `POLAR_BUSINESS_PRODUCT_ID` | ID de producto → plan `business`. |
