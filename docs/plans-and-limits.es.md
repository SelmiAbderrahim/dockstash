# Planes y límites

Dockstash ofrece tres planes. **Free** es el predeterminado open-source /
auto-hospedaje y funciona sin proveedor de pagos configurado; **Pro** y
**Business** requieren una suscripción activa.

## La matriz

| Función              | Free       | Pro         | Business       |
|----------------------|------------|-------------|----------------|
| Proyectos            | 1          | 10          | Ilimitados     |
| Retención            | 7 días     | 30 días     | 90 días        |
| Frecuencia horario   | Solo diaria| Máx. horaria| Cualquier cron |
| Copias programadas   | —          | ✔           | ✔              |
| Alertas por correo   | —          | ✔           | ✔              |
| Servidores conectados| 1          | 5           | Ilimitado      |

Facturación anual = **10× mensual** (dos meses gratis). Los precios viven en
`PricingTier` y se editan sin redesplegar.

## Ciclo de vida

- **Dunning / gracia.** Un pago `past_due` abre una gracia de **14 días** con
  los derechos del plan pagado intactos.
- **Expiración = solo lectura.** Las copias **nunca se eliminan**. Los proyectos
  por encima del cupo quedan `paused`.
- **Downgrade por encima del cupo.** El estado pasa a `selection-required`; el
  usuario elige qué proyectos siguen activos.
- **Reembolso.** La suscripción se revoca; vuelta a Free.
- **Protección de prueba.** Una prueba por correo.

## Merchant of Record

Polar es **Merchant of Record**: IVA, impuestos y facturación los gestiona Polar.
No hay motor fiscal interno.

## Concesiones por invitación

Un superadministrador puede crear un enlace de invitación de un solo uso
(**Superadmin → Invitaciones**) que concede `pro` o `business` durante **1 mes**
o **1 año**. El destinatario abre `/invite/<token>`, inicia sesión (o se
registra) y lo activa.

- **Semántica del prefijo.** Al canjearlo se escribe una fila `Subscription` con
  `providerSubscriptionId` = `invite-grant-<invitationId>`. Ese prefijo es el
  único discriminante: el resolvedor de entitlements, el barrido nocturno, la
  sustitución por webhook y la exclusión de reconciliación se basan en él. Las
  filas de Polar conservan su semántica basada solo en el estado.
- **Caducidad.** La concesión deja de otorgar derechos en el instante en que se
  supera `currentPeriodEnd` — se aplica en lectura, no en el barrido. El trabajo
  nocturno (`billing.invite-grant-expiry`, 03:30) pasa la fila a `canceled` y
  lleva al usuario a `free` mediante `applyProjectCap`: los proyectos por encima
  del límite se **pausan, nunca se eliminan**.
- **Una compra sustituye a una concesión.** Al activarse una suscripción de
  Polar, se cancela cualquier concesión activa. Quien ya tiene un plan de pago
  activo no puede canjear un enlace (`invitations.error.alreadySubscribed`).
- **La reconciliación nunca toca las concesiones** — no tienen equivalente en Polar.
- **La revocación** es lógica (`revokedAt`) y solo afecta a enlaces sin canjear.
