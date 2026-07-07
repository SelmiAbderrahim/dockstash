# Email Marketing

Infrastructure already exists: Resend (`RESEND_API_KEY`/`RESEND_FROM` in env). Sequences below are plain-text-style, founder-signed — matches ICP expectations (HTML-heavy marketing email reads as spam to this crowd). All behavioral triggers map to funnel events in doc 11.

**Deliverability first (week 2):** SPF/DKIM/DMARC verified for the sending domain, separate subdomain optional at this volume, one-click unsubscribe in every non-transactional mail (legal + deliverability).

## Sequence 1 — Onboarding (trigger: signup)

Goal: signup → **first successful backup** → **first restore drill** (Free users see drills are Pro — the drill email doubles as upgrade nudge). Skip emails whose goal the user already completed.

**E1 — immediately: "Your first backup in ~10 minutes"**
> Subject: `Get your first Docker backup running`
>
> Hey — thanks for signing up for Dockstash. I'm the founder; this address reaches me directly.
>
> Fastest path to a protected project:
> 1. Connect your server
> 2. Dockstash scans your compose project and proposes the plan — databases dumped from running containers, volumes, config
> 3. Point it at your storage (SFTP/SSH) — repos are plain restic, encrypted with your key
> 4. Run the first backup
>
> That's it. One question, since you just went through it: what were you using for backups before? (Reply — I read every one.)

**E2 — day 1, if no first backup: "Stuck?"**
> Subject: `Anything in the way?`
>
> You signed up but no backup has run yet. Usually it's one of: server connection, storage setup, or "I'll do it later" (fair).
>
> If it's a technical snag, reply with what you hit — I'll help directly. If it's later: your data doesn't know the difference between "no backup" and "backup I'll set up next week."

**E3 — day 3, after first backup succeeds: "Your backup exists. Is it real?"**
> Subject: `A backup you've never restored is a hypothesis`
>
> Your first backup ran — good. Now the uncomfortable question: would it restore?
>
> Most backup failures are discovered during the emergency. Restore drills flip that: on a schedule, Dockstash restores your backup to scratch and verifies it, so you get proof — not a cron log that says "success".
>
> [Run a restore drill] *(Free plan: drills are part of Pro — try it with a 10-second upgrade, $9/mo, cancel anytime.)*

**E4 — day 7: the objection-killer**
> Subject: `What happens to your backups if Dockstash disappears?`
>
> Fair question — you're trusting us with orchestration, so here's the honest answer: nothing bad. Your repositories are standard restic — encrypted with your key, stored on your storage. `restic snapshots` and `restic restore` work with the plain restic CLI, no Dockstash required. We orchestrate; we don't hold your data hostage.
>
> Also worth knowing: [how we back up Dockstash itself] (yes, with Dockstash).

**E5 — day 12, Free users with 1 active project: upgrade**
> Subject: `Your second project isn't backed up`
>
> Free covers one project — daily backups, 7-day retention, forever. If that one project is all you run, ignore this email, genuinely.
>
> But if there's a second compose stack on that server: Pro is $9/mo for 10 projects, continuous backups instead of daily, 30-day retention, point-in-time restore, restore drills, and email alerts when anything fails. Annual = 2 months free.
>
> [Upgrade to Pro]

## Sequence 2 — Upgrade nudges (behavioral, one-off)

- **Cap hit** (tried to add 2nd project on Free / 11th on Pro): `Subject: You just hit the {n}-project limit` — one line of empathy, plan comparison table, upgrade CTA. Send within minutes of the event (intent is hottest).
- **Backup failed, no alerts (Free):** `Subject: A backup failed yesterday — you found out from this email` — "Pro sends alerts the moment a backup fails, plus runs restore drills. $9/mo."
- **Multi-VPS interest** (2nd server connected / fleet page visits, Pro user): Business pitch — unlimited projects, fleet dashboard, mirror to second storage, 90-day retention, $29/mo.

## Sequence 3 — Win-back

- **Trial-of-intent lapse** (visited pricing 2×, no upgrade, day 14): one email, one question: `Subject: what stopped you?` — plain ask for the objection; answers are gold.
- **Churned paid** (immediately on cancel, automated): confirm cancel, data stays restorable (plain restic), one-question exit survey link.
- **Churned paid +30 days:** `Subject: your backups are still running (the free ones)` — status of what's still protected on Free, what lapsed (retention window, drills), one-click resubscribe.
- **Dormant Free** (no login 60 days, backups still running): monthly-ish digest email doubles as this — see below.

## Ongoing — Monthly digest (all active users)

`Subject: {Month}: {n} backups, {n} drills passed` — per-user stats (backups run, data protected, drills passed/failed), one product update, one backup tip from the blog. This email *is* retention: it shows the product working silently. Free users' digest shows "drills: — (Pro)" — passive nudge every month.

## Newsletter (public, optional from month 3)

"Restore Drill" — monthly, 500 words: one real-world data-loss lesson, one Docker backup tip, one product note. Signup on blog posts. Feeds doc 10 cross-promo inventory.

## Rules

- From: founder name `<founder@dockstash.com>` via Resend; replies actually read.
- Localize subjects/bodies via existing 7-locale i18n infra as volume justifies (start EN-only).
- Suppression: any user who replied "stop"/unsubscribed from marketing still gets transactional (backup-failed) mail only.
- Measure per email: open (directional only), click, and conversion event (doc 11) — kill or rewrite anything under 1% click after 200 sends.
