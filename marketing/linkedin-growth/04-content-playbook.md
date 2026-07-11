# 04 — Content Playbook: Doc 07's Pillars, LinkedIn's Format

Content on LinkedIn has one strategic job in this program: **make the outbound land.**
Every prospect who gets an invite checks the profile and the last few posts (`02` §3);
the posts are what turn "who is this?" into "oh, the restore-proof person." Reach and
followers are welcome side effects, not the goal — that's what X is for.

## 1. Pillars and cadence (inherited, not redefined)

**These are doc 07's pillars and doc 07's cadence.** LinkedIn gets **1–2 posts/week**,
adapted from the same weekly batch that feeds X and Mastodon
(`../x-growth/03-daily-routine.md` §3). Do not draft a separate LinkedIn calendar.

The mix skews harder toward the business-buyer pillars here:

| Pillar | X share | LinkedIn skew | Why |
|---|---|---|---|
| P1 Education / horror stories | 40% | 40% — agency/liability angle | Client-data loss stories are LinkedIn-native |
| P2 Product proof | 25% | **35%** — drill reports, fleet view | Marco and Dana buy proof |
| P3 Build in public | 20% | 15% — milestones only | Indie-dev genre lands weaker here |
| P4 Community | 15% | 10% — thoughtful comments count | Comments on prospects' posts are P4 here |

## 2. The LinkedIn format (from doc 07, expanded)

- **150–250 words**, hook line first, **no hashtag soup**, end with a question.
- **Link in the first comment**, never the body (algorithm penalizes outbound links
  in-post). UTM per doc 11.
- One idea per post. Line breaks for scanability, but not one-sentence-per-line
  broetry — that reads as engagement farming to a technical buyer.
- **Document posts (PDF carousels) are the platform's high performer** for checklists
  and step-by-steps — the restore-drill checklist and the dump-commands cheat sheet
  (`03` §1) each convert to a 6–8 slide carousel almost verbatim. One per month, max.
- Screenshots: real product only, blur client data (doc 07 rule).
- Comment on target-account and prospect posts a few times/week — same "engage like
  a normal person" rules as `../x-growth/03-daily-routine.md` §2B. On LinkedIn this
  doubles as outreach warm-up: a prospect who's seen your comment accepts the invite.

## 3. Hooks — LinkedIn flavor

Same hook-first discipline as x-growth (10 hooks, pick one, then write). The
LinkedIn-native angles:

- **Liability:** "An agency lost 14 client sites because one backup script never
  dumped the database. The cron job said 'success' for 14 months." (doc 07's own
  example — it stays the benchmark.)
- **Deliverable:** "Your clients pay for backups. Can you show them a restore that
  worked, dated this month? That line item is worth more than the backup."
- **Audit/compliance (Dana):** "Auditor asks: 'show me your last successful
  restore.' What do you show them — a log line that says exit 0?"
- **Confession:** works here too, suit-adjusted: "I ran client servers for years
  with backups I'd never once restore-tested."

## 4. The writing system (shared with X — do not build a second one)

Use the same Claude project from `../x-growth/07-ai-writing-system.md`. Add one
instruction to its custom instructions instead of duplicating anything:

> **LinkedIn variant rule:** when asked for a LinkedIn adaptation, produce 150–250
> words, hook line first, professional-but-human tone (no broetry, no hashtag soup,
> no emojis-as-bullets), agency/compliance angle where natural, end with a question,
> and put any link on a separate final line marked "→ first comment".

Workflow: weekly batch writes for X first → pick the 1–2 keepers with a business
angle → ask for the LinkedIn variant → schedule. Same swap test, same honesty rules.

## 5. Post bank — 10 adapted starters

Skeletons; replace every `<placeholder>` with something true, disclose founder
status where it reads as a pitch, links in first comment.

1. **(P1)** The doc-07 agency horror hook, expanded to 200 words: script "worked"
   nightly, database copied live, restore day arrives, 14 client sites gone. Close:
   "When did your stack last prove a restore? Not run a backup — prove a restore."
2. **(P2, image)** Drill-report screenshot: "This is what 'backups work' should look
   like: restored to a throwaway container, verified, timestamped, per client. Not a
   cron log. (I built this — happy to answer how the drill works.)"
3. **(P2, image)** Fleet view (doc 07 #14): "Every client server's backups, one
   dashboard, restore-tested. $29/mo flat — not per-site. Built this because
   per-site backup pricing eats agency margin." 
4. **(P1)** The deliverable post: turn restore drills into a monthly client-report
   line. "Backup goes from invisible cost to visible value you're already charging
   for." (doc 09 E2, as content.)
5. **(P1, carousel)** The restore-drill checklist as a 7-slide document post.
   Final slide: the free script, link in first comment.
6. **(P1)** Dump-commands post, agency-framed: "Your WP stack's `mysqldump` needs
   `--single-transaction` — and one MyISAM table quietly breaks even that. Three
   commands that decide whether a client restore works: …"
7. **(P2)** The trust post: "What if Dockstash dies? Your repos are plain restic,
   your keys, your storage. `restic restore` works without us. That's on purpose —
   and it's the first question every DevOps lead asks." (Dana bait.)
8. **(P1)** VPS-snapshots-aren't-backups (doc 07 #13), reframed for client SLAs:
   same provider + whole-disk + never tested = not a backup you can put in a
   contract.
9. **(P3)** Real milestone: "<N> restore drills ran across Dockstash projects last
   month. <N> failed — and every failure was caught on a schedule, not on restore
   day. That's the product working." Real numbers only.
10. **(P4)** Respectful take on a public data-loss postmortem: lesson only, no
    dunking, one practical takeaway an agency can apply this week.

## 6. What NOT to do here

- No lead-magnet comment-bait mechanics ("comment DRILL and I'll DM you") — that's
  an X format; on LinkedIn it reads as engagement farming to exactly the buyer we
  want. The resource travels via outbound DMs (`03`) and first-comment links.
- No posting frequency race. 1–2 good posts/week beats daily filler; the audience
  here checks *quality of the last three posts*, not volume.
- No company-page posting spree (`01` §3). Founder profile carries the program.
