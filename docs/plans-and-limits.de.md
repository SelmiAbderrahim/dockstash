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
