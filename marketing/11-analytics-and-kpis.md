# Analytics & KPIs

GA4 is already integrated. This doc defines the funnel, events, UTM convention, and the weekly dashboard. **Instrument in week 1 — before launch traffic.** Un-attributed launch traffic is unrecoverable.

## Funnel

```
Visit → Signup → Server connected → First backup succeeded → (First restore drill) → Paid → Retained (M3)
```

The activation moment is **first successful backup** — everything upstream optimizes to it, everything downstream (upgrades, retention, referrals) depends on it.

## GA4 events

| Event | Trigger | Marked conversion |
|---|---|---|
| `sign_up` | account created | ✓ |
| `server_connected` | first server/agent linked | |
| `project_detected` | first compose scan completes | |
| `first_backup_succeeded` | first successful backup (the activation event) | ✓ |
| `restore_drill_run` | drill completed (pass/fail param) | |
| `begin_checkout` | Polar checkout opened (plan param) | |
| `purchase` | webhook-confirmed subscription (plan, value: 9/29, currency: USD) | ✓ |
| `plan_limit_hit` | cap encountered (which_cap param) — upgrade-intent signal, feeds doc 08 triggers | |
| `churn` | subscription canceled | |

Server-truth events (`purchase`, `first_backup_succeeded`) should fire from the backend (GA4 Measurement Protocol) — client-side only misses adblockers, which this ICP uses at very high rates. **Assume GA4 undercounts 25–40% for this audience**; treat the DB as source of truth for signups/revenue, GA4 for acquisition attribution only. (Optional later: self-hosted Plausible/Umami — a use-case guide already exists for both, and "we self-host our analytics" is itself credible marketing.)

## UTM convention (mandatory on every placed link)

`utm_source` = platform (`reddit`, `hn`, `producthunt`, `google`, `newsletter-selfhst`, `youtube-{channel}`, `x`, `mastodon`, `linkedin`, `email`)
`utm_medium` = `community | launch | cpc | sponsorship | social | email | referral`
`utm_campaign` = specific: `launch-2026-07`, `rsa-core`, `guide-postgres`, `digest-2026-08`
Short ref codes (`?ref=`) for YouTube/podcast spoken links. Keep a registry sheet of every UTM ever used.

## Weekly KPI dashboard (one sheet, 15 min/week)

| Metric | Source | Target trajectory |
|---|---|---|
| Unique visitors | GA4 | up-and-right after wk 3 |
| Visitor→signup | GA4 | ≥ 2% (landing problem if <1%) |
| Signup→first backup (activation) | DB | ≥ 40% (onboarding problem if <25%) |
| Activation→paid within 30d | DB | 3–8% of Free actives |
| MRR / paid count by plan | Polar | doubling-ish monthly from tiny base |
| CAC per channel | spend ÷ attributed paid | blended ≤ $30 |
| Churn (paid, monthly) | Polar/DB | < 5%/mo |
| Organic clicks + indexed pages | GSC | compounding wks 8+ |
| AI citations (8 queries × 3 platforms) | manual audit (doc 04) | 0 → ≥1 by day 90 |
| Community: posts/comments + referral signups | log (doc 05) | 90/10 ratio held |

## Unit economics guardrails

- Pro $9/mo, ~$90/yr realistic blended (monthly+annual mix). At <5% churn, LTV ≈ $110–180. **CAC ceiling: $30 blended** (≈3-month payback) — the doc-06 kill rule derives from this.
- Business $29/mo → LTV $350–600; justifies doc-09 founder-time outreach and higher per-lead cost.
- Free tier cost is the marketing budget's silent line item — watch storage/compute per free user; the 1-project/7-day cap bounds it by design.

## Review cadence

- **Weekly (30 min):** fill dashboard, per-channel signups, kill/scale decisions per docs 05/06/07 rules.
- **Monthly (90 min):** cohort view (do wk-N signups activate/convert better as changes land?), AI-citation audit, objection-log review → route to FAQ/content/email.
- **Day 45 + day 90:** step back — which 2 channels produced 80% of activated signups? The 90-day plan's whole purpose is to earn the right to *cut* channels in month 4.
