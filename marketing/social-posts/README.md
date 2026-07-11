# Social Posts — Ready-to-Ship Bank (one file per post)

Finished, full-length posts for **X** (`x/`) and **LinkedIn** (`linkedin/`), one per
file. These are the *rendered* versions of the skeletons in `../07-social-content.md`
and `../x-growth/05-post-bank.md` — written to post, not to outline. Everything here
inherits the ground rules in `../README.md` (no invented metrics, disclose founder
status, no absolute claims, UTM every link).

## The viral anatomy these posts use

Reverse-engineered from high-performing SaaS promotion posts (the "YouTube automation
RPM" genre and its LinkedIn equivalents). The load-bearing structure, in order:

| Beat | What it does | Dockstash version |
|---|---|---|
| **1. Insider hook** | "Most X will never tell you this" — implies withheld knowledge | "Most Docker servers with 'daily backups' would not survive a restore" |
| **2. Violent contrast** | $1,000 vs $4 RPM — same inputs, 250× outcome | Same cron job, same green checkmark; one server restores, one is gone |
| **3. One-word reframe** | "It's not talent. It's *architecture*." | "It's not diligence. It's architecture." (ours is literally true) |
| **4. The math/ladder** | Tiered breakdown the reader can locate themselves on | The backup maturity ladder L0→L4 |
| **5. Named proof** | Real accounts with numbers | Real public postmortems: GitLab 2017, Code Spaces 2014, OVH fire 2021 |
| **6. The system** | Numbered steps — makes it feel achievable | dump correctly → restic → off-provider → drill → dead-man's switch |
| **7. Urgency** | "18 months until the window closes" | **Dropped** — fake urgency violates brand. Replaced with real stakes: you find out on restore day |
| **8. Lead-magnet CTA** | "Like and I'll DM the ebook" | "Comment DRILL/AUDIT and I'll DM it" — magnet is a real script/checklist |

What we deliberately **do not** copy from the genre: invented earnings, unverifiable
"friend of mine" stories, manufactured scarcity, engagement-bait with no payload. The
self-host crowd detects all four and remembers. Our substitute for hype is *specificity*
(exact flags, real postmortems, failure counts).

## Index

### X (`x/`)

| File | Pillar | Format |
|---|---|---|
| `x-01-architecture-thread.md` | P1 | 13-tweet flagship thread (the direct viral-anatomy adaptation) |
| `x-02-diy-math.md` | P1/P2 | Single long post — the honest cost of the "free" DIY stack |
| `x-03-lead-magnet-audit.md` | P1 | Comment-"AUDIT" lead magnet |
| `x-04-poll-then-payoff.md` | P1 | Poll + 48h payoff post |
| `x-05-failed-drill-screenshot.md` | P2 | Image post — the failed drill as proof |
| `x-06-honest-comparison-thread.md` | P2/P4 | 7-tweet concede-first tool comparison |
| `x-07-launch-day-thread.md` | P3 | Launch thread (has `<placeholders>` — fill with real story) |
| `x-08-pinned-profile-post.md` | P2 | The pinned post every profile visitor sees |

### LinkedIn (`linkedin/`)

| File | Angle | Format |
|---|---|---|
| `li-01-gitlab-lesson.md` | DevOps/lesson | ~200-word post, flagship |
| `li-02-agency-liability.md` | Agency | ~200-word post, Business-tier funnel |
| `li-03-failed-drill-founder.md` | Build-in-public | ~180-word post |
| `li-04-five-layers.md` | Educational | List post, carousel-ready |
| `li-article-01-why-backups-dont-restore.md` | Education | Full LinkedIn article (~900 words) |
| `li-article-02-backups-as-deliverable.md` | Agency | Full LinkedIn article (~700 words) |

## Posting rules (delta on top of `../07-social-content.md`)

- **X:** no hashtags, links inline. Long posts (x-02, x-08) need X Premium; otherwise
  split at the marked break. Threads: one idea per tweet, ≤280 chars each.
- **LinkedIn:** post from the founder profile, link in **first comment**, no
  hashtag soup (≤3, at the end, if any). Articles publish under LinkedIn Articles
  and get a companion short post pointing at them.
- **Lead magnets (x-03, x-01 final tweet):** the AUDIT script and DRILL checklist
  must exist before posting. Reply-and-DM by hand at current scale; every DM includes
  the promised artifact with zero extra pitch.
- **Placeholders:** anything in `<angle brackets>` is a fact you must replace with a
  real one. A post with an unfilled placeholder never ships.
- Mark each file with the date used at the bottom when you post it. Evergreen posts
  can rerun after ~2–3 months, rephrased.
