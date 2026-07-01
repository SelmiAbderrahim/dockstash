# Polar-Abrechnung & Webhooks

Dockstash betreibt Polar als aktiven Zahlungsanbieter hinter einer
anbieterneutralen Schnittstelle. Der Stripe-Adapter bleibt im Code, ist aber
standardmäßig inaktiv.

## Endpunkte

- `POST /api/billing/checkout` (auth) — gehostete Checkout-Sitzung starten.
- `GET  /api/billing/portal` (auth) — gehostetes Kundenportal öffnen.
- `POST /api/billing/change-plan` (auth) — Produkt des aktiven Abonnements wechseln.
- `POST /api/billing/webhook` — Polar-Zustellungen. Prüfen vor Parsen.

## Webhook-URL

`https://<Ihr-Server>/api/billing/webhook` im Polar-Dashboard eintragen.

## Standard-Webhooks-Signatur

Dockstash verifiziert jede Zustellung nach [Standard Webhooks](https://standardwebhooks.com):

- `signed_content = "{webhook-id}.{webhook-timestamp}.{rawBody}"`
- `signature      = base64(HMAC-SHA256(secret, signed_content))`
- Header: `webhook-signature: v1,<sig> [v1,<sig> ...]`
- Zeitstempel außerhalb ±5 Minuten werden abgelehnt.

Die Prüfung läuft auf den Roh-Bytes; der Body wird niemals `JSON.parse`'t, bevor
die Signatur besteht.

## Idempotenz

Jede Zustellung wird in die `webhook_event`-Collection mit dem eindeutigen
Constraint `(provider, eventId)` eingefügt. Doppelte Zustellungen liefern
sofort `200` mit dem gespeicherten Status — kein Handler läuft doppelt. Bei
Handler-Fehlern wechselt der Status auf `failed`, `retryCount` wird erhöht;
Polar wiederholt mit Backoff.

## Reconciliation

`reconcileSubscriptions()` läuft alle 15 Minuten. Sie fragt aktive Polar-
Abonnements ab und heilt Drift auf lokalen `Subscription`-Zeilen (Status,
`currentPeriodEnd`, `cancelAtPeriodEnd`). Sie erstellt niemals Zeilen, die Polar
nicht meldet, und ein fehlgeschlagener Datensatz bricht die Schleife nicht ab.

## Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `PAYMENT_PROVIDER` | `none` / `polar` / `stripe`. Standard `none`. |
| `POLAR_ACCESS_TOKEN` | Serverseitig. Ruhend mit `MASTER_ENCRYPTION_KEY` verschlüsselt. |
| `POLAR_WEBHOOK_SECRET` | Standard-Webhooks-Geheimnis. `whsec_…` akzeptiert. |
| `POLAR_SERVER` | `sandbox` (Standard) oder `production`. |
| `POLAR_PRO_PRODUCT_ID` | Produkt-ID → Plan `pro`. |
| `POLAR_BUSINESS_PRODUCT_ID` | Produkt-ID → Plan `business`. |
