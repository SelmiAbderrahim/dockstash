# 04 — Content Playbook: Pillars, Formats, Hooks, and Lead Magnets

What to post, in what mix, and how to make each post earn its slot. Ready-made posts
live in `05-post-bank.md`; the machine that writes new ones lives in
`07-ai-writing-system.md`.

## 1. Content pillars (the mix)

**These are doc 07's pillars, unchanged.** `../07-social-content.md` owns the mix
across X, Mastodon, and LinkedIn; this folder does not get its own. If you change the
percentages, change them there first.

| Pillar | % | What it is | Why it works for Dockstash |
|---|---|---|---|
| **P1 — Backup education & horror stories** | 40% | The live-DB-copy trap, dump commands, postmortem threads, "test your restores", data-loss stories (ours and the industry's) | Gets followers *results* → loyalty; horror stories travel farthest, and everyone has one to reply with |
| **P2 — Product proof** | 25% | Restore-drill reports, detection screenshots, feature clips ≤60s, honest competitor comparisons | We sell proof, so we show proof. Screenshots of a thing working beat any adjective |
| **P3 — Build in public** | 20% | Shipping Dockstash: adapters, bugs, design decisions, real metrics, launch retros | The founder-brand engine; indie/dev X's native genre |
| **P4 — Community & curation** | 15% | Amplify self-host projects, restic tips, answer quote-tweets, respectful takes on others' postmortems | Buys the reciprocity that the boost network (`03` §5) runs on |

Two modes cut across the pillars — neither is its own pillar:

- **Reactive.** When a provider incident, a public data-loss postmortem, or a vendor
  shutdown hits the timeline, post live. It's a P1 or P4 post with the news as its
  hook. Free trend traffic; we are literally the "did that restore?" niche. Never dunk
  on the people it happened to.
- **Promo.** Releases, pricing, direct CTAs. Capped at roughly **1 post in 20**, and it
  lives inside P2. If the last 10 posts contain more than one promo, stop promoting.

Rules of thumb:
- Personality is seasoning on every pillar, not its own pillar — quirks and humor are
  the retention differentiator.
- Every post targets ONE pillar and ONE reader. "For everyone" posts are for no one.
- Every fear post owes the reader a fix. We trade in a real fear (silent backup
  failure); leaving them scared and empty-handed is what a bad ad does.
- Disclose that you built it. Every P2 post, every comparison, every time.

## 2. Formats (what a post physically is)

1. **Single tweet (the workhorse).** One idea, fits in one tweet length, no "show
   more" cutoff. Most of the daily volume.
2. **Screenshot post.** Drill reports, detected-project views, dump commands, terminal
   output, Reddit gold. Screenshot readability rule: test on **light background** —
   most of our audience uses dark mode, so a light image pops in their feed (test both).
   Real product only.
3. **Thread (1–2/week).** Tutorial, story, or breakdown. Each tweet in the thread ≤
   one tweet length — never make readers tap "show more" mid-thread. Tweet 1 is pure
   hook + promise; final tweet is summary + soft CTA ("follow for more of this").
4. **Poll.** Cheap engagement + market research ("Have you ever actually test-restored
   your backups?"). 1/week max.
5. **Quote-post.** Add insight on top of niche news or a target account's post.
6. **Lead-magnet post.** See §4 — its own machinery.
7. **Video/screen recording.** Long-form screen-capture demos are currently
   overperforming (per source playbook); a 2-min "compose file → detected plan → first
   backup → drill passes" recording is high-bookmark material, and it's the single
   asset that proves the product in one take.

## 3. Hooks — the first line is 80% of the post

The first line decides scroll-past vs read. Bank of formulas (Dockstash-flavored
examples in `swipe-file/hooks.md`):

- **Curiosity:** "Your backup job said SUCCESS. The snapshot inside it is corrupt.
  Here's why."
- **Story:** "At 2:47am a client's database came back empty. The backups had been
  'working' for 14 months."
- **Value:** "The three commands that decide whether your Docker backup restores:"
- **Contrarian:** "Unpopular opinion: an untested backup and no backup are the same
  product with different feelings attached."
- **Social proof:** "`<N>` restore drills ran this month. `<N>` failed. That's the
  feature."
- **Confession:** "I copied a live Postgres data directory for years and called it a
  backup."

Workflow rule (from `07`): always generate **10 hooks first**, pick the winner, *then*
write the body. Never write body-first. Then run the swap test
(`swipe-file/writing-principles.md` §6).

## 4. Lead-magnet posts (the growth spikes)

A lead-magnet post offers a free resource in exchange for a comment (+ follow), and an
auto-DM delivers it. They routinely out-reach everything else (source benchmark: a
first-ever lead-magnet post hitting 2.4M views) because every comment is an algorithm
signal and every follow requirement compounds.

### Mechanics (Typefully auto-DM)
1. Write the post. **You must state in the post that they'll receive a DM** (platform
   rule enforced by Typefully).
2. Configure auto-DM: *follow required: yes* → *reply to the first tweet* → set the
   **keyword** they must comment → write the DM that delivers the link/file.
3. Know the limits: Typefully's auto-DM runs for **3 days** only. Posts mostly die by
   day 2 anyway, but check for stragglers on day 4+ and DM them manually.
4. The resource must be genuinely good — it's the first "result" a new follower gets
   from you (retention lever). Every one below must work for someone who never becomes
   a customer; that's the point.
5. UTM the link inside the DM (doc 11).

### Dockstash lead-magnet inventory (build once, reuse)
| Magnet | Format | Keyword |
|---|---|---|
| Restore-drill checklist — how to test a restore by hand, what "passed" actually means | PDF / gist | `DRILL` |
| Backup audit script — reads your `docker-compose.yml` and tells you which services are being *copied* instead of *dumped* | Gist | `AUDIT` |
| Correct dump commands cheat sheet — Postgres, MySQL/MariaDB, Mongo, Redis, and the flags people miss | Image + gist | `DUMP` |
| Data-loss postmortem template (the one we use) | Markdown | `POSTMORTEM` |
| restic + docker-compose starter — a working repo, encryption, retention, off-site in ~10 minutes | Gist / docs page | `RESTIC` |

The `AUDIT` script is the strongest of the five: it hands the reader their own bad news
in ten seconds, sourced from their own compose file. Build that one first.

Cadence: 1 lead-magnet post every 2–3 weeks. More and they lose their spike effect.

### Example skeleton

> Your `docker-compose.yml` already tells you whether your backups will restore.
>
> Any service whose data directory you're copying — `postgres`, `mysql`, `mongo` —
> is a service you're backing up wrong. Live files, mid-write, unrecoverable.
>
> I wrote a script that reads your compose file and flags every one of them.
>
> Comment "AUDIT" and I'll DM it to you (must be following so the DM goes through).

## 5. What "performing well" means (outlier detection)

You'll know an outlier when you see one — it's relative to *your* current baseline
(at 500 followers, 3 comments is a win; at 3,000, ~10 comments / 1,000+ impressions).
Priority order of signals:

1. **Comments** — the strongest public signal, and what cold visitors judge you by.
2. **Bookmarks** — the sleeper metric; heavy bookmarks = genuinely useful = algorithm
   fuel (a 100k-view post with 600 bookmarks is a format to repeat).
3. **Follows attributed** to the post.
4. Likes/RTs — fine, weakest signal.

Two uses for an outlier:
- **Repeat the format.** Outlier = the audience voted. Reverse-engineer why (hook?
  topic? screenshot? format?) and make 3 more like it. (E.g., if a "Reddit screenshot
  + commentary" post pops, mine r/selfhosted for more of exactly that.)
- **Promote it.** Wait ~24h after posting (never run a post as an ad immediately — it
  kills its organic reach), then feed it to the ads machine (`06-x-ads-playbook.md`).

## 6. Cadence

- **Minimum:** 1 post/day, every day. Consistency beats volume.
- **Growth mode (recommended, phases 1–2):** 2–4 posts/day — early accounts need
  volume to find what resonates.
- 1–2 threads/week. 1 poll/week max. Lead magnet every 2–3 weeks.
- Schedule the evergreen queue weekly; post reactive stuff live.
- Doc 07's 3–4 posts/week is the *cross-platform* number — the same best ideas,
  re-adapted for Mastodon and LinkedIn. It is not a ceiling on X.
