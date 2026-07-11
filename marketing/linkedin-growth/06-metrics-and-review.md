# 06 — Metrics & the Weekly Review

What we measure, what we ignore, and the weekly ritual. One principle above all:
**the north-star metric is conversations with the right people** — replies, booked
walkthroughs, Business-tier trials. LinkedIn follower count is a vanity number in
this program; it matters on X (`../x-growth/08`), not here.

Business-level numbers (signups, activation, paid conversion, CAC) are owned by
doc 11. This file measures the channel; doc 11 measures the funnel it feeds.

## 1. The metric stack

### Outbound DMs (the core motion — log weekly in the shared sheet)

| Metric | Healthy | Notes |
|---|---|---|
| Invites sent | 75–100/wk | Capped by LinkedIn, not ambition |
| **Accept rate** | ≥ 25–30% | Below that: profile or list segment broken (`02`/`03` §3) — fix before volume |
| **Reply rate to touch 1–2** | ≥ 5–10% | The script grader. <5% after ~100 DMs = rewrite (usually: list too broad or resource not compelling) |
| Resource link clicks | tracked via UTM `dm-audit` | Proxy for offer strength |
| **Conversations → walkthroughs/trials** | the point | Every one logged with segment + script variant |
| Business conversions attributed | doc-11 read | We read it, doc 11 owns it |

Reply-rate benchmark logic mirrors doc 09 (>5% healthy, <2% after 50 = rewrite);
DMs typically run higher than cold email — hold them to the higher bar.

### Content (doc 07's tracking, LinkedIn slice)

Doc 07 already requires weekly follows / link clicks / signups per platform. Add
one LinkedIn-specific signal: **profile views from prospects** (visible on free
tier, richer in Sales Nav). Outreach weeks should spike profile views; if invites
go out and views don't move, the invites aren't landing.

### Ads (only if `05` is live)

Cost per lead-form submit · submit → booked-walkthrough rate · show rate · cost per
booked call · remarketing frequency. Judged against Business-tier pipeline, not the
$30 blended CAC (doc 11) — a $60 booked call with a 10-server agency is fine; a $6
click that never converts is not.

## 2. The weekly review (15 minutes, same day as the x-growth review)

1. **Sheet pass:** invites → accepts → DMs → replies → conversations, by script
   variant and list segment. One line: which combination is winning?
2. **Objection harvest:** every "no" reason this week → doc 01's objection list and
   next week's content ideas (`04`). A repeated objection is a post, an ad, and a
   FAQ entry.
3. **Post check:** did 1–2 doc-07 LinkedIn posts ship? Any comment/DM from a
   prospect on them? (Content-assisted replies get a sheet column — that's the
   compounding we're paying for.)
4. **Follow-up hygiene:** nobody stuck past day 8, nobody double-sequenced with
   doc 09's email track.
5. Log one line in `review-log.md` (create on first review): date, invites,
   accept %, reply %, conversations, one lesson, one change.

## 3. Kill / keep / scale rules

| Situation | Action |
|---|---|
| Accept rate < 25% after 100 invites | Pause volume; fix profile/segment first |
| Script variant < 5% replies after ~100 DMs | Kill it; promote the challenger, write a new challenger |
| A list segment converts to conversations 2× another | Rebuild next week's list toward it |
| Zero conversations after 8 weeks of honest execution | The doc-07 kill rule fires: stop the LinkedIn program, write the postmortem, fold learnings into doc 09's email motion. (Doc 07's caveat holds: X/Mastodon stay regardless; LinkedIn is the one channel allowed to die.) |
| DM motion producing Business conversations steadily | Consider `03` §6 automation gate, then `05` ads |
| Ads: $500–800 spent, no walkthroughs/trials | Kill ads, keep DMs + content (`05` §5) |

## 4. What we deliberately do NOT optimize

- **Follower count / impressions** — Marco doesn't care how many followers we
  have; he cares whether the last three posts look competent.
- **Invite volume** — the cap is a feature; it forces list quality.
- **Engagement bait** — comment-gate mechanics and broetry would lift numbers doc
  07 doesn't count and burn credibility with the exact buyer we want.
- **Speed** — the agency that books in month 4 after 12 silent touches is the
  normal case. The program is judged on quarters, same as X.
