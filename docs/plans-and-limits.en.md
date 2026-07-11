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
| Connected servers    | 1          | 5           | Unlimited      |

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
- **Lapse → read-only.** Existing backups are **never deleted** by a billing
  lapse. Over-cap projects are marked `paused` (read-only): no new runs, and
  the prune job **skips paused projects entirely**, so their stored snapshots
  are retained indefinitely. A paused project's scheduled jobs are disabled
  too, and re-enabled only if the user re-upgrades (a schedule the user
  disabled themselves stays disabled).
- **Retention narrowing is grandfathered.** When a still-active project's tier
  shrinks (e.g. Pro 30-day → Free 7-day retention), the narrower ceiling does
  **not** take effect immediately — for a 14-day grace window the prune job
  keeps applying the pre-downgrade (wider) policy, so history that predates the
  downgrade survives the window rather than being deleted on the next prune.
  After the window the tier ceiling applies to future growth.
- **Downgrade over cap.** If a Pro user with 8 projects downgrades to Free,
  the account enters a `selection-required` state. The user picks the one
  project that stays active; the rest are paused. **Nothing is deleted.**
- **Refund / chargeback.** The subscription is revoked; the account drops
  to Free entitlements. Projects retained, over-cap paused.
- **Trial abuse.** Trials are one-per-customer-email. A second trial claim
  for the same email fails `409 trialAlreadyClaimed`.

## Storage retention for paused / abandoned projects

Because backups are never deleted on a lapse, a paused project's restic
repository is **retained indefinitely** — there is deliberately **no automatic
storage reclamation** today for accounts that downgrade and never return. This
is a current product decision (data safety over disk cost), not an oversight.
An operator who needs to bound storage growth must reclaim it manually; the
only code path that ever deletes a repository is the opt-in GDPR account
deletion flow (`legal.service.ts`). A future opt-in retention policy could
automate this. (prompt 13 / F7)

## Merchant of Record

Polar acts as **Merchant of Record**: VAT / sales tax collection, invoicing,
and dispute handling are Polar's responsibility. Dockstash does not run a
tax engine.

## Editing pricing without a redeploy

1. Change the row in Mongo: `db.pricingtiers.updateOne({slug:'pro'}, {$set:{priceMonthly: 1200}})`
2. Reload the pricing grid — the new price is served immediately.
3. Re-running `seedPricingTiers` on boot never overwrites operator edits
   to `priceMonthly` / `priceYearly` / `active`.

## Invitation grants

A superadmin can mint a single-use invitation link (**Superadmin → Invitations**)
that comps `pro` or `business` for **1 month** or **1 year**. The recipient opens
`/invite/<token>`, signs in (or signs up) and activates it.

- **Prefix semantics.** A claim writes one `Subscription` row whose
  `providerSubscriptionId` is `invite-grant-<invitationId>`. That prefix is the
  only discriminator: the entitlement resolver, the nightly expiry sweep, the
  webhook supersede, and the reconcile exclusion all scope on it. Polar rows keep
  status-only semantics and are never affected.
- **Lapse.** The grant stops entitling the instant `currentPeriodEnd` passes —
  enforced at read time, not by the sweep. A nightly job
  (`billing.invite-grant-expiry`, 03:30) then flips the row to `canceled` and
  lands the user on `free` through the same `applyProjectCap` funnel as every
  other free landing: over-cap projects are **paused, never deleted**, and the
  retention grandfather window is stamped. The user sees the normal upgrade
  surfaces at `/billing?tab=plans`.
- **A purchase supersedes a grant.** When a Polar subscription activates, any
  live grant row for that user is canceled first. A user who already holds an
  active paid plan cannot claim a link (`invitations.error.alreadySubscribed`);
  the link stays pending for someone else.
- **Reconcile never touches grants.** They have no Polar counterpart, so the
  drift healer skips `invite-grant-` rows entirely.
- **Revocation** is soft (`revokedAt`) and only applies to an unclaimed link. It
  never cancels an already-activated grant.
