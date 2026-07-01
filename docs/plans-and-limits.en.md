# Plans & limits

Dockstash ships three tiers. The **Free** tier is the open-source /
self-host default and works without a payment provider configured; **Pro**
and **Business** are gated by an active subscription.

## The matrix

| Feature              | Free       | Pro         | Business       |
|----------------------|------------|-------------|----------------|
| Projects             | 1          | 10          | Unlimited      |
| Retention            | 7 days     | 30 days     | 90 days        |
| Schedule frequency   | Daily only | Hourly max  | Any cron       |
| Scheduled backups    | —          | ✔           | ✔              |
| Email alerts         | —          | ✔           | ✔              |
| Multi-VPS            | —          | —           | ✔              |

Yearly billing costs **10× monthly** ("two months free"). All prices are
data-backed in `PricingTier` rows — you can edit them without a redeploy.

## What the caps mean

- **Projects.** Backup-Now is blocked when the user's active project count
  is over their tier cap. The response is `403` with
  `{ reason: 'projectLimitReached' }` so the client can render an upgrade
  prompt.
- **Schedule frequency.** Schedule create is blocked when the requested cron
  frequency is above the tier ceiling. Free tier has no schedules at all
  (`403 schedulesLocked`); Pro allows up to hourly (`403 frequencyNotAllowed`
  otherwise); Business allows any cron.
- **Retention.** `restic forget --keep-days` is clamped to the tier cap.

## Lifecycle

- **Dunning / grace.** A `past_due` payment starts a **14-day grace** window.
  During grace the user keeps their paid entitlements. If the payment isn't
  recovered by grace expiry, the account is demoted to Free.
- **Lapse → read-only.** Existing backups are **never deleted**. Over-cap
  projects are marked `paused` (read-only): no new runs until the user
  re-upgrades or reactivates them via the selection UI.
- **Downgrade over cap.** If a Pro user with 8 projects downgrades to Free,
  the account enters a `selection-required` state. The user picks the one
  project that stays active; the rest are paused. **Nothing is deleted.**
- **Refund / chargeback.** The subscription is revoked; the account drops
  to Free entitlements. Projects retained, over-cap paused.
- **Trial abuse.** Trials are one-per-customer-email. A second trial claim
  for the same email fails `409 trialAlreadyClaimed`.

## Merchant of Record

Polar acts as **Merchant of Record**: VAT / sales tax collection, invoicing,
and dispute handling are Polar's responsibility. Dockstash does not run a
tax engine.

## Editing pricing without a redeploy

1. Change the row in Mongo: `db.pricingtiers.updateOne({slug:'pro'}, {$set:{priceMonthly: 1200}})`
2. Reload the pricing grid — the new price is served immediately.
3. Re-running `seedPricingTiers` on boot never overwrites operator edits
   to `priceMonthly` / `priceYearly` / `active`.
