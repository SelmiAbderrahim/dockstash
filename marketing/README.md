# Dockstash Marketing Playbook

Complete go-to-market playbook for dockstash.com. Every doc contains strategy **and** copy-paste-ready assets (posts, ads, emails). Assumes a solo founder with a **$300–1,000/mo budget** and ~10 hours/week for marketing.

## The one-line strategy

> Win the "docker backup" niche through honest, technically-deep content and community presence, convert with the Free tier, and let the restore-drill differentiator do the selling.

Your buyers (self-hosters, indie devs, agencies) live on Reddit, HN, and YouTube, distrust ads, and reward technical honesty. Organic + community is the core engine; paid is a small accelerant on high-intent search terms only.

## Reading order

| Doc | What it covers | When you need it |
|---|---|---|
| [01-positioning-and-icp.md](01-positioning-and-icp.md) | Who buys, why, messaging hierarchy, competitor angles | Read first — everything else builds on it |
| [02-launch-plan.md](02-launch-plan.md) | Product Hunt, Show HN, Reddit launch week — drafted posts | Weeks 3–4 |
| [03-seo-content-strategy.md](03-seo-content-strategy.md) | Keyword clusters, programmatic page expansion, 12-week editorial calendar | Weeks 1–12, ongoing |
| [04-ai-seo.md](04-ai-seo.md) | Getting cited by ChatGPT / Perplexity / AI Overviews | Weeks 2+, compounds with 03 |
| [05-community-marketing.md](05-community-marketing.md) | Reddit / HN / forums — rules, cadence, drafted posts | Week 1, ongoing forever |
| [06-paid-ads.md](06-paid-ads.md) | Google Search + Reddit ads + sponsorships, full ad copy | Week 5+ (after launch data) |
| [07-social-content.md](07-social-content.md) | X / LinkedIn / Mastodon, 30-day drafted calendar | Week 1, ongoing |
| [08-email-marketing.md](08-email-marketing.md) | Onboarding, upgrade nudges, win-back — all drafted | Week 2 (before launch traffic arrives) |
| [09-cold-outreach.md](09-cold-outreach.md) | Agency/MSP outreach for Business tier — drafted sequences | Week 6+ |
| [10-partnerships-and-referrals.md](10-partnerships-and-referrals.md) | YouTube sponsorships, directories, referral program | Weeks 4–12 |
| [11-analytics-and-kpis.md](11-analytics-and-kpis.md) | Funnel, GA4 events, UTM convention, CAC targets | Week 1 (instrument before launch) |
| [12-calendar-90-day.md](12-calendar-90-day.md) | Week-by-week execution plan tying it all together | Your operating doc |
| [x-growth/](x-growth/) | X-only deep dive: profile, daily routine, 50-post bank, X Ads (extends doc 07) | Week 1, ongoing |
| [linkedin-growth/](linkedin-growth/) | LinkedIn-only deep dive: profile, outbound DM motion, ads funnel (extends docs 07 + 09) | Week 1 profile, Week 3+ outbound |
| [social-posts/](social-posts/) | Ready-to-ship posts, one file each: 8 X posts/threads + 4 LinkedIn posts + 2 LinkedIn articles, built on the viral-anatomy breakdown in its README | Week 1, ongoing |
| [influencer-outreach/examples/](influencer-outreach/examples/) | Worked DM examples per creator type + the do-not-pitch and inbound cases | With influencer outreach |

## Budget allocation

At **$500/mo** (scale proportionally within $300–1,000):

| Line | $/mo | Notes |
|---|---|---|
| Google Search ads (high-intent keywords) | 250 | See 06. Pause if CAC > 3× monthly plan price |
| Reddit ads (subreddit-targeted) | 100 | Test months 2–3; kill fast if no signups |
| Newsletter sponsorship tests | 100 | One slot/mo (selfh.st-class newsletters) |
| Tools (email sending via existing Resend, monitoring) | 50 | Most of the stack is free at this scale |

Zero-budget months: shift everything to community + content (05, 03, 07) — they compound; ads don't.

## 90-day priority order

1. **Weeks 1–2 — Foundation.** Analytics instrumentation (11), positioning locked (01), onboarding emails live (08), community accounts warmed up (05), first SEO articles drafted (03).
2. **Weeks 3–4 — Launch.** Product Hunt + Show HN + Reddit launch (02). All traffic lands on instrumented funnel.
3. **Weeks 5–12 — Compounding loops.** Weekly content (03/04), weekly community presence (05), 3×/week social (07), paid search on (06), directory listings + first YouTube sponsorship (10), agency outreach (09). Review KPIs weekly (11).

Full week-by-week detail: [12-calendar-90-day.md](12-calendar-90-day.md).

## Ground rules (apply to every channel)

- **Never astroturf.** The self-host crowd detects and punishes it permanently. Always disclose you built Dockstash.
- **Honesty about competitors wins.** The site's competitor pages already concede real Backrest/Duplicati strengths — keep that tone everywhere. Balanced comparisons also get cited more by AI engines.
- **Every claim traceable to the product.** Pricing is $0 / $9 / $29 monthly (yearly = 10× monthly, "2 months free"). Free = 1 project, daily backups, 7-day retention. Pro = 10 projects, continuous, 30-day, PITR, restore drills, email alerts. Business = unlimited projects, any cron, multi-VPS fleet, mirror, 90-day. Don't invent features or stats.
- **The hook is always the same:** most Docker "backups" copy live database files that won't restore. Dockstash dumps databases from the running container and *proves* restorability with scheduled restore drills.
- **UTM-tag every link you place anywhere** (convention in 11).
