# Tarife & Limits

Dockstash bietet drei Tarife. **Free** ist der Open-Source / Selbst-Host-Default
und funktioniert ohne konfigurierten Zahlungsanbieter; **Pro** und **Business**
sind an ein aktives Abo gebunden.

## Matrix

| Feature              | Free       | Pro         | Business       |
|----------------------|------------|-------------|----------------|
| Projekte             | 1          | 10          | Unbegrenzt     |
| Aufbewahrung         | 7 Tage     | 30 Tage     | 90 Tage        |
| Planungsfrequenz     | Nur täglich| Max stündlich | Beliebiger cron |
| Geplante Backups     | —          | ✔           | ✔              |
| E-Mail-Alarme        | —          | ✔           | ✔              |
| Verbundene Server    | 1          | 5           | Unbegrenzt     |

Jährliche Abrechnung = **10× monatlich** (zwei Monate gratis). Preise leben in
`PricingTier`-Zeilen und sind ohne Redeploy editierbar.

## Lebenszyklus

- **Dunning / Kulanz.** Eine `past_due`-Zahlung startet eine **14-tägige
  Kulanzfrist**. Während dieser Frist bleiben die bezahlten Rechte erhalten.
- **Auslauf = read-only.** Backups werden **nie gelöscht**. Über-Cap-Projekte
  werden `paused` markiert.
- **Downgrade über Cap.** Konto geht in den Zustand `selection-required`; der
  Nutzer wählt, welches Projekt aktiv bleibt.
- **Rückerstattung.** Abo wird widerrufen; Rückfall auf Free.
- **Trial-Missbrauch.** Ein Trial pro E-Mail.

## Merchant of Record

Polar ist **Merchant of Record**: MwSt., Sales Tax und Rechnungsstellung
übernimmt Polar. Kein interner Tax-Engine.

## Einladungs-Freischaltungen

Ein Superadmin kann einen Einladungslink zur einmaligen Nutzung erstellen
(**Superadmin → Einladungen**), der `pro` oder `business` für **1 Monat** oder
**1 Jahr** freischaltet. Der Empfänger öffnet `/invite/<token>`, meldet sich an
(oder registriert sich) und aktiviert ihn.

- **Präfix-Semantik.** Eine Einlösung schreibt eine `Subscription`-Zeile mit
  `providerSubscriptionId` = `invite-grant-<invitationId>`. Dieses Präfix ist das
  einzige Unterscheidungsmerkmal: Entitlement-Resolver, nächtlicher Sweep,
  Webhook-Supersede und Reconcile-Ausschluss greifen darauf zu. Polar-Zeilen
  behalten ihre reine Status-Semantik.
- **Ablauf.** Die Freischaltung endet in dem Moment, in dem `currentPeriodEnd`
  überschritten wird — beim Lesen erzwungen, nicht erst durch den Sweep. Der
  nächtliche Job (`billing.invite-grant-expiry`, 03:30) setzt die Zeile dann auf
  `canceled` und führt den Nutzer über `applyProjectCap` auf `free`: Projekte
  über dem Limit werden **pausiert, nie gelöscht**.
- **Ein Kauf übersteuert eine Freischaltung.** Bei Aktivierung eines
  Polar-Abonnements werden alle aktiven Freischaltungen des Nutzers storniert.
  Wer bereits ein aktives kostenpflichtiges Abo hat, kann keinen Link einlösen
  (`invitations.error.alreadySubscribed`).
- **Reconcile fasst Freischaltungen nicht an** — sie haben kein Polar-Gegenstück.
- **Widerruf** ist weich (`revokedAt`) und gilt nur für nicht eingelöste Links.
