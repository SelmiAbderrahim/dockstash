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
