# Cold Outreach — Agencies & MSPs (Business tier)

Target: **Marco** (doc 01) — agencies/freelancers hosting 10–50 client sites on VPSes. Business tier ($29/mo unlimited projects, fleet dashboard, mirror, 90-day retention) is priced to be an impulse yes against their current liability. Start week 6, after launch proof exists. Volume: **10–15 personalized emails/week** — quality over spray; this is a founder-signed channel, not a sequencer blast.

## Prospect sourcing (build list of 100, ~3 hrs)

1. **LowEndTalk + r/webhosting posters** who mention managing client VPSes.
2. **Agency directories:** Clutch/GoodFirms "web development" + "hosting/maintenance" filters, local dev-agency lists.
3. **WordPress maintenance providers** (they all host client sites): google `"wordpress maintenance" "care plan" site:*.com`, WP-agency Facebook groups.
4. **GitHub/portfolio signals:** agencies with docker-compose files in public repos = confirmed stack match.
5. Record per prospect: name, role, agency, evidence of VPS/Docker hosting (the personalization variable), client count if visible.

Legal note: B2B cold email is CAN-SPAM-legal (US) with accurate headers + address + opt-out; for EU prospects, ensure legitimate-interest basis and clean opt-out — when in doubt, skip EU or use LinkedIn instead.

## Sequence (3 touches, 4-day gaps, stop on any reply)

**E1 — the liability question**
> Subject: `client site backups at {Agency}`
>
> Hi {FirstName} — saw {evidence: "your care-plan page mentions daily backups" / "you host client sites on your own servers per your site"}.
>
> Quick question most agencies can't answer comfortably: if a client's server died today, have the backups ever actually been restore-tested — or would you find out live?
>
> I built Dockstash for exactly this: it backs up every Docker project on your servers (databases dumped correctly from running containers — not copied live), and runs scheduled restore drills so you have restore *proof* per client, not hope. One dashboard across all your VPSes. $29/mo flat for unlimited projects — not per-site.
>
> Worth a look? Happy to send a 2-minute video instead of a call.
>
> {Founder name} — founder, Dockstash

**E2 — day 4: the client-facing angle**
> Subject: `re: client site backups at {Agency}`
>
> One more thought and then I'll leave you alone: agencies using restore drills turn them into a deliverable — a monthly "your backup was restore-tested on {date}" line in client reports. Backup goes from invisible cost to visible value you're already charging for.
>
> Free tier if you want to trial it on one internal project first — no card.

**E3 — day 8: the breakup**
> Subject: `closing the loop`
>
> No response needed — I'll assume backups are handled and stop here. If restore-tested, per-client Docker backups become relevant later: dockstash.com. The free tier is a zero-risk way to kick the tires.
>
> Either way — good luck with {Agency}.

## Personalization variables (minimum viable: 1 and 2)

1. `{evidence}` — the specific thing you saw (their care plan, stack, a LowEndTalk post). No evidence = don't send.
2. `{Agency}` / `{FirstName}` — obviously.
3. Optional power-up: name one of their public client sites and the stack you can infer ("looks like Ghost behind nginx").

## LinkedIn parallel track (for EU or no-email prospects)

Superseded by `linkedin-growth/03-outbound-dm-playbook.md` — the full DM motion
(Sales Navigator list build, blank-invite → value-DM sequence, scripts, follow-ups).
It shares this doc's prospect sheet and personalization rules; one prospect is never
in both sequences at once.

## Ops & metrics

- Send from founder address (same domain reputation rules as doc 08); 10–15/wk keeps volume under spam thresholds and personalization honest.
- Track in a simple sheet/CRM: sent, opened (if tracked), replied, demo/video sent, trial, converted.
- Benchmarks to beat: >5% reply rate = healthy; <2% after 50 sends = rewrite E1 (usually: evidence too weak or pitch too long).
- Every reply objection → log → feed docs 01 (objections), 03 (content ideas), FAQ.
- After 100 sends: review whether agency ICP converts; if yes, scale list-building; if no, redirect hours to community/content.
