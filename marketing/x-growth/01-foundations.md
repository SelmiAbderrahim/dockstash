# 01 — Foundations: Who, Why, and the Rules of the Game

Read this once, before anything else. Everything downstream (profile, content, ads)
inherits from the decisions on this page.

This folder is the X-specific deep dive. It **inherits** its pillar mix, cadence, UTM
discipline, and disclosure rules from `../07-social-content.md` — that doc owns X as a
channel alongside Mastodon and LinkedIn. Nothing here may contradict it. Product facts
trace to `../01-positioning-and-icp.md` and `server/src/modules/billing/plans.ts`.

## 1. Is our customer even on X? (Yes.)

The qualifying question is never "do they go to X to buy backup software?" — nobody
goes to X to buy anything. The question is **"do they go to X to spend time?"** Our
people demonstrably do. The four personas from doc 01, and where X reaches them:

- **Ines — indie dev / solo SaaS founder.** Build-in-public culture lives on X.
  Ship posts, MRR screenshots, dev hot takes. She has paying customers on a single
  droplet and an untested backup script. **X is her primary watering hole** — the one
  persona doc 01 names X for explicitly. She is who this account is for.
- **Sam — self-hoster / homelabber.** Lives on r/selfhosted and the fediverse, but
  cross-posts to X and argues about Docker there. Data is irreplaceable (Nextcloud
  photos, a password vault). Reach him here, close him on Mastodon and Reddit.
- **Marco — agency / freelancer.** On X for business development and dev news; a
  client site losing its database is his liability, not just his outage. He converts
  in DMs, not from ads.
- **Dana — small DevOps team.** On X for infrastructure news. Long sales cycle, needs
  the security model and the audit trail, not a tweet. X is a first touch, nothing more.

Educators, B2B, and online-service businesses do well on X. Local businesses don't
(not enough X users in one geography). Dockstash is squarely in the "does well" column:
a developer tool sold to people who live online.

X is also "the new LinkedIn" — same professionals, minus the suit. The barrier to DM a
CTO on X is dramatically lower than on LinkedIn. That matters for the endgame (sales
happen in DMs, not from ads — and the DM motion is already specified in
`../influencer-outreach/x-dm.md`).

## 2. The niche: problem + person (the magnet principle)

A niche is two things: **the problem you solve** and **the person you solve it for**.

- **Problem:** your Docker backup copies live database files and will not restore —
  and you won't discover that until the day you need it.
- **Person:** developers, self-hosters, and agencies running compose stacks that hold
  something they can't afford to lose.

Your profile should work like a magnet: it must clearly **attract** those people and
clearly **repel** everyone else. Trying to attract everyone attracts no one. When a
self-hoster lands on the profile, the bio, banner, pinned tweet, and last 10 posts
should all confirm the same idea: *this person thinks about whether backups actually
restore.* That's what converts a profile visit into a follow (see
`02-profile-setup.md`).

Corollary: it is fine — good, even — that enterprise-procurement people and no-code
tourists bounce off the profile. They were never the customer.

## 3. Personal account vs @dockstash account

**Lead with the personal account.** People buy from people they trust. The founder
becomes the face; the product inherits the trust. The pattern to aim at: the founder
becomes synonymous with the category — we want "Docker backups that actually restore"
→ Dockstash.

- **Personal account (primary, `<your handle>`):** all pillars from
  `04-content-playbook.md` — backup education, restore-drill proof, build in public,
  community. Runs the ads. Does the daily engagement. Signs DMs "— Selmi".
- **@dockstash product account (secondary, optional at first):** release notes,
  changelog screenshots, drill-report images, retweets of the founder + community.
  Value-first if it ever runs ads. **Claim the handle now, use it later** — don't split
  energy until the personal account has momentum.

## 4. Core principles (internalize these — they veto tactics)

1. **Nobody buys from a stranger's ad.** A cold viewer will not click "sign up" — they
   scroll past or block. Ads exist to *start a relationship*, not to close.
2. **Followers are the success metric.** Every organic post and every ad is judged by
   one number: quality followers gained. Followers see the next post, and the next,
   until they're ready. (Full metric stack in `08-metrics-and-review.md`.)
3. **The 24-touch / 3-platform rule.** It now takes ~24 exposures across ~3 platforms
   (for us: X + Reddit/HN + email) to build buying trust. X ads at 6+ frequency are
   the cheapest touch machine that exists. Plan for months, not weeks.
4. **Keep people ON the platform.** X charges pennies when your ad keeps users on X and
   dollars when it asks them to leave. So we never run "click my link" ads to cold
   audiences — we run relationship ads and let people click the bio link themselves
   (benchmark from the source creator: 19,000 self-driven bio-link clicks on $1,300
   spend vs ~$1.50+ per forced link click).
5. **Engagement on ads goes viral for free.** Uniquely on X, when someone engages with
   an organic post you're running as an ad, X shows that post to *their* followers
   organically — you pay a penny for the like and get ~33% bonus organic reach.
6. **The buying journey is long and silent.** Real story from the source playbook: a
   client hired him six months after following, having never once liked or commented.
   Consistency compounds invisibly. Don't get discouraged by quiet weeks.
7. **You can't just post and log off.** Support others daily (10–15 min of genuine
   comments). The algorithm and the community both reciprocate. Organic posts +
   supporting others + ads — all three together, or none of it works.
8. **Never astroturf.** Always disclose you built Dockstash. This audience detects it
   and punishes it permanently, and it is the one mistake that cannot be undone by
   posting better next week. (Ground rule from `../README.md`.)
9. **It's a 5-year game, not a 2-month sprint.** Treat X as a permanent channel and,
   ideally, as fun. The people who win are the ones still posting in year three.

## 5. What we're selling (so posts stay honest)

Limits below are from `server/src/modules/billing/plans.ts` — the source of truth.
Never round them up in a post.

| | Free | Pro — $9/mo | Business — $29/mo |
|---|---|---|---|
| Projects | 1 | 10 | Unlimited |
| Backup frequency | Daily | Continuous (5-min floor) | Any cron (1-min floor) |
| Retention | 7 days | 30 days | 90 days |
| Schedules · email alerts · restore drills · PITR | — | ✓ | ✓ |
| Connected fleet agents | 1 | **5** | Unlimited |
| Fleet dashboard · mirror | — | — | ✓ |

Yearly = 10× monthly ("2 months free").

- **Free** is the acquisition engine and the self-host default — the code is
  Apache-2.0, one project is genuinely free forever, no card. It creates the upgrade
  path the moment someone adds a second project.
- **Pro ($9/mo)** is where Ines lives. PITR means a bad deploy or a fat-fingered
  DELETE is recoverable to the minute.
- **Business ($29/mo)** is where Marco and Dana live. Flat, not per-site — that
  sentence closes agencies by itself.
- **The trust base:** repos are plain restic, encrypted with the user's key, on the
  user's own storage. `restic restore` works even if Dockstash disappears. Say this
  out loud and often; it defuses the "what if the SaaS dies?" objection before it's
  asked.

Precision note: Pro allows **5 connected agents**, not zero. Do not post "fleet is
Business-only" — post "unlimited agents, the fleet dashboard, and mirroring are
Business."

## 6. Prerequisites checklist (before spending a single ad dollar)

- [ ] Account is **verified** (X Premium) — required by the ads platform and the
      creator revenue program (needs 500 verified followers + 5M impressions to
      monetize; a nice side quest, not the goal).
- [ ] `@dockstash` handle claimed (even if dormant).
- [ ] Profile rebuilt per `02-profile-setup.md` (bio, banner, pinned tweet, link).
- [ ] **Bio link ≈ ad link.** X rejects/penalizes accounts whose bio link differs
      wildly from ad destinations. Bio points at `dockstash.com` (or a page on it).
- [ ] At least ~2 weeks of organic posts on the account (X won't trust an empty
      account with ads).
- [ ] Claude project + swipe file built (`07-ai-writing-system.md`).
- [ ] Daily routine running (`03-daily-routine.md`).
- [ ] Ads budget actually exists — it isn't in the current $500/mo table. Read
      `06-x-ads-playbook.md` §0 before assuming otherwise.
