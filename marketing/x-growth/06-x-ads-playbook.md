# 06 — X Ads Playbook: The Exact Setup

The full paid-reach system, step by step. Philosophy in one line: **use ads to start
relationships (followers), let organic + retargeting close.** Benchmarks from the
source account: $1,300 spend → 130M impressions at ~6x frequency, ~0.1¢ per 1,000
impressions, 5,400 followers, 19,000 self-driven link clicks — versus ~$1.50+ per
click if you ask cold traffic to click. Those are the source creator's numbers on his
account, in his niche. They are a direction, not a forecast.

## 0. Non-negotiables before spending

### Budget reality first

**X ads are not funded in the current plan.** `../README.md` allocates $500/mo across
Google Search ($250), Reddit ads ($100), and newsletter sponsorships ($100), with $50
of tooling. There is no X line, and this document does not create one by existing.

The trigger to fund it: **Week 9+, and only if Reddit ads have underperformed.** Reddit
is the closest substitute — same audience, same intent, already budgeted. If Reddit's
CAC is above doc 11's blended **$30 ceiling** after a fair test, move that **$100/mo**
to X and run the TOF campaign at $3/day instead of $5. Everything below still works;
it just takes longer to leave the warm-up.

If Reddit is working, leave it alone. Do not fund both from a $500 budget.

Until then, this file has two jobs: it is the spec for when the money exists, and §2.9
tells you which keywords our people actually use — which is worth reading even if you
never buy an impression.

### Then the mechanics

- [ ] Verified (Premium) account, with weeks of organic posts on it.
- [ ] Bio link (`dockstash.com`) matches any destination you'll ever use in ads —
      mismatch gets ads rejected or throttled.
- [ ] **Never use the "boost/promote" button on a post.** That's donating money to X
      with no targeting. Always ads.x.com with a real campaign.
- [ ] **Never run a post as an ad within 24h of posting it** — it kills the post's
      organic reach. Post organically, let it breathe a day, then promote.
- [ ] Accept the warm-up: the first ~2 weeks of any new ad account have ugly costs.
      X doesn't trust you yet. Hold the daily budget and wait; costs drop dramatically
      around week two. Don't judge, don't touch.
- [ ] Every ad destination is UTM-tagged (`utm_source=x&utm_medium=cpc`, doc 11).

## 1. The three-layer funnel

| Layer | Objective | Audience | Creative | Ask |
|---|---|---|---|---|
| **TOF — Top of funnel** | Reach | Cold: keywords + follower lookalikes | Best organic posts (education, horror stories, the pin tweet) | None. No link. Follow/engage if they feel like it |
| **MOF — Middle of funnel** | Reach | Warm: engaged with our tweets / followers | Product proof: the drill-report demo video, the "why I built this" story, a technical thread | Still no hard ask; deepen trust |
| **BOF — Bottom of funnel** | Reach (or site traffic, only here) | Hot: engaged multiple times, follows us | Product post with CTA | NOW ask: `dockstash.com` / signup |

Start with TOF only. Add MOF ~week 4–6, BOF ~week 8+. People need the ~6+ exposures
before an ask converts.

## 2. TOF campaign — click-by-click

### Campaign level
1. Go to ads.x.com → Create campaign.
2. Objective: **Reach.** (Ignore the inviting green "Sales" button — most expensive
   objective, and nobody buys from a stranger's ad. Also pick plain **max reach**,
   not "reach with engagement" — you can't force engagement, you can only earn it.)
3. Name it so future-you can read reports:
   `Reach - TOF - <YYYY-MM-DD> - <audience>` → e.g. `Reach - TOF - 2026-09-15 - selfhosters`.
4. Budget: **$5/day** (or $3/day on the reallocated Reddit money, §0). Hold for two
   weeks. Scale only after cost/result drops.

### Ad group level
5. **Brand safety → Limited.** (Default "Standard" wastes spend next to bot/NSFW
   adjacent content.)
6. Placements: leave broadly on — including **replies**; keyword-matched ads inside
   comment sections are some of the most native-feeling inventory.
7. Demographics: **Age 21–54** (under 21 is bots and irrelevance; adjust upper bound
   if data says otherwise). **Language: English.** Countries: up to **5 max per
   campaign** — start **US only**; if data supports it, a second campaign for
   DE/NL/UK/CA/AU (strong self-hosting cultures; DE and NL are also where a lot of
   Hetzner-hosted compose stacks live). Only add countries whose people could actually
   become users.
8. Devices/OS: leave alone. Don't over-slice a $5/day budget.

### Targeting — the fun part
9. **Keywords.** Matches words people use in their bio, posts, and comments — your ad
   appears in those contexts. Dockstash's keyword set:
   - Competitors/tools: `restic`, `backrest`, `duplicati`, `kopia`, `borgbackup`,
     `simplebackups`, `velero`
   - Problem space: `backup`, `restore`, `data loss`, `pg_dump`, `postgres backup`,
     `disaster recovery`, `ransomware`
   - Identity space: `docker`, `docker compose`, `self-hosted`, `selfhosted`,
     `homelab`, `vps`, `hetzner`, `devops`, `sysadmin`, `indie hacker`
   Watch the audience-size meter as you add; target roughly **~90k starting
   audience** for a campaign — big enough to learn, small enough to stay relevant.
   Note `backup` alone is far too broad (every phone-photo thread on X uses it) —
   it only earns its slot paired with the identity keywords in the same ad group.
10. **Follower lookalikes** ("target the followers of…"). Steal the audiences of
    accounts whose followers are our ideal users. **Vet every account first**:
    - Open their profile → check recent posts get real **comments** (not just likes).
    - Prefer newer, active accounts. Old large accounts (100k+, aged) are often
      full of bought/dead followers — big number, zero pulse.
    - Confirm they still talk about our topic *now* (people pivot).
    Candidate categories to fill in (vet at time of setup, don't assume):
    self-hosted/homelab creators, backup- and restic-adjacent tool authors,
    indie-hacker/build-in-public accounts, docker/devops educators, agency owners
    posting about client infrastructure. 5–15 vetted handles per campaign.
11. **Optimized targeting: ON — for the first two weeks only.** This lets X expand
    beyond your targeting to find cheap engagement, which trains the account and
    crushes costs. **Calendar reminder: after two weeks, edit the campaign and turn
    it OFF** so spend concentrates on the actual audience. (This on-then-off toggle
    is the single biggest cost trick in the source playbook.)

### Creative level
12. Choose **"Use existing ad"** — this means *promote an existing organic post*
    (you can select from roughly the last 3 months; if the list is empty it's a UI
    bug — refresh or retry tomorrow).
13. Pick posts that already proved themselves organically (outliers per `04` §5) or
    the pin tweet — social proof (existing likes/comments) rides along with the ad
    and substitutes for follower count. **The ad must not ask for a click.** No
    link in the post. Education, horror-story, or question posts only — P1 is the
    natural TOF pillar.
14. The preview may show the post cut off — display bug, ignore; it serves in full.
15. Name each ad with its first sentence (so reports are readable).
16. Launch **3–5 ads** in the campaign for the first two weeks.

## 3. Operating the TOF campaign

- **Weeks 1–2:** touch nothing. Costs are high on purpose (warm-up).
- **End of week 2:** turn OFF optimized targeting. Review per-ad: which ads produced
  **followers**? Kill the ones that didn't; keep the ones that did; scale budget
  gently on winners ($5 → $10–20/day) — but only within whatever §0 actually freed up.
- **Ongoing:** rotate in new organic outliers — mature state is **10–20 posts
  tested** as ads, continuously pruned by followers-per-dollar.
- **Reporting view:** set up a custom metrics preset (columns) once: cost per 1K
  impressions, frequency, follows, link clicks, engagement rate — the default view
  hides everything useful. Details in `08-metrics-and-review.md`.

## 4. MOF campaign — retarget the warm crowd

Duplicate the TOF campaign (still **Reach**), rename `Reach - MOF - <date> -
engagers`, then change ONLY the targeting:

1. **Delete** all keywords and follower lookalikes.
2. Enable retargeting audiences: **"people who saw or engaged with your tweets"** →
   select **all engagement**, from **organic tweets AND campaign tweets**, and pick
   the TOF campaign specifically. Add **your followers**.
3. Creative: proof and depth — the compose-detection-to-passing-drill demo video, a
   "why I built this" story post, a technical thread on dump correctness. Still no
   hard CTA.
4. Budget: $5/day is plenty (the audience is small and cheap to re-reach).

## 5. BOF campaign — finally, the ask

Same duplication, rename `Reach - BOF - <date> - hot`. Targeting = engaged with
tweets (all) + followers, ideally narrowed to people who engaged with MOF-era posts.
Creative: **now** the product post with a link — `dockstash.com` or a signup page,
UTM-tagged. This is the only layer where a link-click ask is allowed, because by now
they've seen us 6+ times, many follow us, and the click costs behave like warm
traffic, not the $1.50 cold-click tax.

The ask that converts this audience is the Free tier, not the paid one: *one project,
free forever, no card.* Doc 01 is explicit that Free is the acquisition engine — BOF
sells the signup, the product sells the upgrade.

Keep BOF small ($3–5/day). If BOF posts also work organically, even better — run
release announcements here.

## 6. Success metrics & kill rules (summary — full version in `08`)

- **Primary: quality followers per ad.** An ad that brings followers resonates;
  keep it. An ad with impressions but no follows is dead weight; kill it after
  ~2 weeks of fair chance.
- Secondary: cost per 1K impressions trending down; frequency climbing toward ~6;
  profile visits; *unforced* bio-link clicks.
- Explicitly NOT the metric at TOF/MOF: link clicks, signups, sales. Those are
  measured at BOF and in the bio-link/DM funnel.
- **Channel-level kill rule:** if 4 fair weeks produce neither followers nor bio-link
  clicks, the X-ads experiment is over — return the $100 to Reddit. Killing the *ads*
  never means killing the *channel*; organic X stays regardless (doc 07).
- The sale itself closes in organic follow-up: they follow → see daily posts → DM
  or click the bio link when ready — weeks later. That's the design, not a failure.

## 7. Recap card

```
Funding:          NOT in the $500/mo table. Week 9+, only if Reddit underperforms.
Objective:        Reach (max reach) — never Sales, never boost button
Budget:           $5/day ($3 on reallocated Reddit money), 2-week warm-up, touch nothing
Brand safety:     Limited
Age/Lang/Geo:     21-54 - English - <=5 countries (start US)
TOF targeting:    keywords + vetted follower lookalikes, ~90k audience
Optimized tgt:    ON weeks 1-2 -> OFF forever after
Creative:         existing organic posts (24h+ old), no links, 3-5 ads -> scale to 10-20
Funnel:           TOF (cold, no ask) -> MOF (engagers, prove) -> BOF (hot, ask for signup)
North star:       followers per dollar
```
