# 03 — The Daily Routine: Traffic → Conversion → Retention

Growth on X is a cycle: **traffic** (people see you) → **conversion** (they follow) →
**retention** (they keep engaging, so the algorithm keeps showing them your posts,
which produces more traffic). This file is the daily/weekly rhythm that turns the
flywheel. Budget: **30–45 minutes/day**, plus one weekly batching block.

## 1. Phase map — where are we?

| Phase | Followers | Primary traffic source | Posting | Commenting |
|---|---|---|---|---|
| **Phase 1: Comments-first** | 0 – ~1,500 | Replies under bigger accounts | 1–2/day | 10–20 quality replies/day |
| **Phase 2: Posts-first** | ~1,500 – 5,000 | Your own posts + ads | 2–4/day | 5–10 replies/day |
| **Phase 3: Compounding** | 5,000+ | Posts, ads, lead magnets, collabs | 2–4/day | 5–10 replies/day (more strategic) |

Why the shift: reply-driven growth is **linear** — results are tied 1:1 to replies
sent. Post-driven growth is **exponential** — posts get shared, found in search, and
surfaced on the For You page. Start where replies work, move your energy to posts as
soon as they get traction. Don't stay in Phase 1 out of comfort.

## 2. The daily loop (30–45 min)

### A. Respond to everything on your posts (5–10 min)
Every reply to your post gets a reply back. This doubles your comment count (algorithm
signal), trains repliers to come back, and starts DM-able relationships. Answers >
"thanks!" — ask something back when natural. (Doc 07's rule holds: reply to every
reply for the first two hours after posting.)

### B. Comment on 10–20 target-account posts (15 min)
This is where new people discover you in Phase 1, and it stays valuable forever.

How to do it well:
- Hang out where your ideal follower hangs out: the comment sections of bigger
  accounts in the docker / self-hosted / devops / indie-hacker niches.
- Engage **like a normal person**. Add an insight, a related war story, a genuine
  question, or a respectful disagreement. Never "Great post 🔥". Never force it — if
  you have nothing to say, scroll on; people smell try-hard.
- Reply *early* on big accounts (first 15–30 min after they post) — early replies ride
  the post's reach.
- Comments are also ad inventory: X shows ads in reply sections, keyword-matched — the
  same mechanism we'll buy in `06-x-ads-playbook.md`. Being genuinely present in those
  threads now makes our later ads feel native.
- Disclose that you build Dockstash any time a comment could read as a pitch. The
  self-host crowd punishes stealth marketing permanently (ground rule, `../README.md`).

Build and maintain a **target list of 20–50 accounts** (restic/borg/backup-tool
authors, self-hosted and homelab creators, docker & devops educators, indie hackers
posting build-in-public numbers, agency owners talking about client infrastructure).
Criteria: active in the last week, real comment engagement (not just likes), audience
overlaps ours. Follow them all; check the list daily. Many will follow back and start
engaging with you — that's the first 1–2k followers.

### C. Post (from the queue) (0 min — scheduled)
Content is written in the weekly batch (`07-ai-writing-system.md`) and scheduled via
Typefully. The daily job is only to post anything *live* that's reactive (a public
data-loss postmortem, a provider incident, a vendor shutdown — see the reactive
material in `05-post-bank.md`).

### D. DMs (5 min)
2–3 genuine DMs/day to people who engaged meaningfully — a thank-you, an answer to
their question, a "saw you're running Nextcloud on a single box — what's your restore
story?" No pitch. The pitch happens months later, or never, and that's fine. DMs are
where customers and collaborators actually convert. (Creators worth gifting a free
year of Business → hand off to `../influencer-outreach/x-dm.md`, which owns that
motion and its disclosure rules.)

## 3. The weekly batch (2–3 hours, one sitting)

1. Run the research loop (`07-ai-writing-system.md` §2): harvest Reddit
   (r/selfhosted, r/homelab, r/docker, r/devops, r/sysadmin, r/webhosting,
   r/indiehackers), X explore, and any Dockstash-development moments from the week.
2. Feed the Claude project; generate and refine ~10–15 posts + 1 thread.
3. Pull anything relevant from `05-post-bank.md`.
4. Schedule 2 weeks ahead in Typefully; leave gaps for live posts. Cross-adapt the
   keepers to Mastodon and LinkedIn per `../07-social-content.md` — same idea, adjusted
   tone, don't double the writing.
5. Do the weekly review (`08-metrics-and-review.md`): what worked, what died, adjust
   next week's mix.

## 4. Retention — keep serving the sushi

People followed for a reason. **Keep giving them what they followed for.** The sushi
restaurant rule: if they came for sushi and you serve burgers — even great burgers —
they're disappointed. Tactically, the algorithm shows people content similar to what
they previously engaged with; if your topic drifts, your own followers stop *seeing*
you, then quietly stop being followers.

For us the "sushi" is: backup correctness, restore proof, self-hosting, and building
Dockstash in public. The allowed seasoning is personality — quirks, humor, opinions
(that's a differentiator, not a drift). The forbidden move is pivoting the account to
generic growth/AI/motivation content because it briefly performs.

Second retention lever: **get followers results.** Every genuinely useful post (a dump
command that saves someone a corrupt restore, a drill script that catches a broken
backup before it matters) creates a follower for life — the Hormozi effect: people who
profit from your advice never unfollow.

## 5. The boost network

When a bigger account comments or retweets within minutes of your post going live, X
reads the post as valuable and pushes it to more people. Build this deliberately:

- The daily comment routine (§2B) *is* the long game for this — reciprocity compounds.
- Form a small group (3–10 peers at similar or larger size in the niche) who ping each
  other on new posts and share what's working with the algorithm.
- It is fine to *ask* a friend to look at a post; it is not fine to run engagement
  pods with fake accounts or to buy likes. (Paying for legitimate *republishing* —
  e.g. a newsletter or account openly sharing your content — is a disclosed
  sponsorship, handled under `../influencer-outreach/` rules.)

## 6. Daily checklist

- [ ] Replied to every comment on my posts
- [ ] 10–20 genuine comments on target accounts (Phase 1) / 5–10 (Phase 2+)
- [ ] Scheduled queue has ≥1 post going out today
- [ ] 2–3 relationship DMs sent
- [ ] Anything reactive worth posting live? (a public data-loss story, provider
      incident, vendor shutdown, milestone)
- [ ] Logged any post idea that popped up (voice-note it into the Claude project)
