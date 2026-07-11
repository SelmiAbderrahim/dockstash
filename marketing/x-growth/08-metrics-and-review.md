# 08 — Metrics & the Weekly Review

What we measure, what we ignore, and the standing weekly ritual that keeps the system
honest. One principle above all: **the north-star metric is quality followers.**
Followers see tomorrow's post; everything else is a step toward or a consequence of
that.

Business-level numbers (signups, activation, paid conversion, CAC) are owned by doc 11.
This file measures the *channel*; doc 11 measures the *funnel it feeds*.

## 1. The metric stack

### Organic posts
| Metric | Why it matters | Weight |
|---|---|---|
| **Comments** | Strongest algorithm + social-proof signal; cold visitors judge by it | ★★★ |
| **Bookmarks** | "Genuinely useful" signal; predicts format worth repeating | ★★★ |
| **Follows attributed** | The actual goal | ★★★ |
| Impressions | Reach context; outlier detector | ★★ |
| Likes / RTs | Fine, weak | ★ |
| Link clicks | Only meaningful on BOF/promo posts | context-dependent |

Outliers are **relative to your own baseline** — at 500 followers, 3 comments is a
win; at 3,000, ~10 comments / 1k+ impressions. When a post outperforms: figure out
why (hook? format? topic?), repeat the format, and feed it to ads 24h+ later.

### Ads (set up a custom column preset once — the default view hides all of this)
Columns: cost per 1K impressions · frequency · follows · engagements · engagement
rate · profile visits · link clicks · spend.

| Metric | Healthy direction | Benchmark (source account) |
|---|---|---|
| Cost / 1K impressions | Falling after week 2 | ~0.1¢ per 1K (mature account) |
| **Followers per ad / per $** | The kill/keep decider | 5,400 followers on $1,300 |
| Frequency | Climbing toward ~6 | ~6 (repetition builds recall) |
| Unforced link clicks | Growing as trust builds | 19K on $1,300 (bio-link, self-driven) |
| Unfollows | Near zero | a trickle is normal |

Benchmarks are the *source creator's* mature numbers — expect to be far off them in
month one; watch the trend, not the absolute. Never quote them as ours.

### Account / business (monthly)
- Follower count + growth rate (and gut-check quality: are new followers Sam, Ines,
  Marco, or Dana? — personas in doc 01).
- Profile visits → bio-link clicks (`dockstash.com` traffic with `utm_source=x`, per
  doc 11's UTM convention). Remember doc 11's warning: this audience blocks ads at
  high rates, so GA4 undercounts 25–40%. Treat the DB as truth for signups.
- Signups, activations (first successful backup), and Free→Pro conversions with X as
  the attributed source. These are doc-11 metrics; we read them, we don't own them.
- DM conversations started (the real conversion surface).
- Creator-program progress if desired (needs 500 verified followers + 5M
  impressions/3mo — a side effect, never the goal).

## 2. The weekly review (20 minutes, same day every week)

1. **Top 3 posts** — why did each work? (hook / topic / format / timing) → queue 2–3
   more in that format next week.
2. **Bottom 3 posts** — wrong pillar? weak hook? off-audience? One lesson each.
3. **Follower delta** — number + eyeball the new followers: right people?
4. **Ads pass** (if running): any ad ≥2 weeks old with spend but no follows → kill.
   Winners → +budget or duplicate. Two-week mark hit? → toggle optimized targeting
   OFF (calendar item from `06` §2.11).
5. **Routine audit** — did the daily loop actually happen (comments, replies, DMs)?
   Skipped days correlate with dead weeks; the data will show it.
6. **Queue check** — ≥1 week of scheduled posts remaining? If not, run the batch
   (`03` §3).
7. Log one line per week in `review-log.md` (create on first review): date, follower
   count, top post link, one lesson, one change for next week. Trend > memory.

## 3. Kill / keep / scale rules

| Situation | Action |
|---|---|
| Ad ran 2 weeks, no follows | Kill |
| Ad brings followers at acceptable $ | Keep; scale $5→$10–20/day slowly |
| Organic format outperforms twice | Make it a recurring series |
| Post flopped once | Nothing — single flops are noise; patterns are signal |
| Pillar consistently dead over a month | Reduce its share, don't zero it instantly |
| Engagement dropping account-wide | Check drift first (are we still serving the sushi? `03` §4), then hooks, then cadence |
| X ads spending with no follows *and* no bio-link clicks after a fair 4 weeks | Kill the ads test, return the budget to Reddit (`06` §0) |

Doc 07's channel-level rule still applies above all of this: **X stays regardless** of
short-term numbers, because it feeds community presence and AI-answer visibility. The
kill rules govern *ads and formats*, never the channel.

## 4. What we deliberately do NOT optimize

- **Likes** — vanity; nobody hires you for likes.
- **Going viral off-niche** — a 2M-impression post outside our topic adds followers
  who will never engage again (and teach the algorithm wrong things about us).
- **Link clicks at TOF/MOF** — asking cold traffic to click is the $1.50 tax we
  built this whole system to avoid.
- **Speed** — the buyer who DMs in month 6 having never liked a post is the normal
  case, not the exception. The system is judged on quarters.
