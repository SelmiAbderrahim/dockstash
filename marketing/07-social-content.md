# Social Content

Platforms: **X/Twitter** (indie dev + build-in-public), **Mastodon/fediverse** (self-host crowd overindexes here — do not skip), **LinkedIn** (agency/DevOps personas, doc 09 warm-up). Cadence: 3–4 posts/week cross-adapted, ~2 hrs/week. Same post can go to X + Mastodon (adjust tone: Mastodon hates growth-hack formatting, hashtags matter there: `#selfhosted #docker`).

## Content pillars

| Pillar | Share | What it looks like |
|---|---|---|
| P1 Backup education / horror stories | 40% | The live-DB-copy trap, postmortem threads, "test your restores" |
| P2 Product proof | 25% | Restore-drill reports, detection screenshots, feature clips ≤60s |
| P3 Build-in-public | 20% | Numbers, lessons, launch retro, stack decisions |
| P4 Community/curation | 15% | Amplify self-host projects, restic tips, answer QTs |

## 30-day drafted calendar (repeatable skeleton — refresh specifics each cycle)

**Week 1**
1. (P1, thread) `Your Docker backup probably won't restore. A thread on the 5 silent failure modes: 1/ copying live database files…` — full thread from doc-03 week-1 post; end: "I built Dockstash around fixing these — free for one project."
2. (P2, image) Screenshot of a restore-drill report: `This is what "your backup works" should look like: restored to scratch, verified, timestamped. Not a cron log that says 'success'.`
3. (P3) `Building a backup SaaS means your marketing is fear and your product is proof. Interesting tension: I can't say "never lose data" — I can only show restore drills passing.`
4. (P4) Boost/QT a restic release or self-host project: genuine one-line praise + one tip.

**Week 2**
5. (P1, code) The correct dump commands as an image/snippet: `pg_dumpall vs copying /var/lib/postgresql/data — one restores, one doesn't. (mysqldump --single-transaction / mongodump --oplog for the others.)`
6. (P2, clip) 45s screen capture: compose project detected → backup plan proposed. `Dockstash reads your docker-compose.yml and proposes the whole plan: DB dumps, volumes, .env, proxy config.`
7. (P1, poll) `Have you ever actually test-restored your backups? A) yes, recently B) yes, once, years ago C) no D) what backups` — engagement bait with a purpose; reply to every vote-comment.
8. (P3) One real metric: signups, drills run, projects protected — whatever is true and non-embarrassing.

**Week 3 (launch week if aligned — see doc 02)**
9. (P3) Launch announcement + link to Show HN/PH.
10. (P2) `The question everyone asks: "what if Dockstash dies?" Answer: your repos are plain restic, encrypted with your keys, on your storage. restic restore works without us. That's on purpose.`
11. (P1) Quote-post a public data-loss story (respectfully, no dunking): lesson only.
12. (P3) Launch retro numbers thread.

**Week 4**
13. (P1) `VPS snapshots ≠ backups: same provider, whole-disk, never tested. Keep them — but add per-project, off-provider, restore-tested backups for anything you can't lose.`
14. (P2) Fleet view screenshot for agencies: `Every client server's backups, one dashboard, restore-tested. $29/mo flat, not per-site.` (LinkedIn priority for this one.)
15. (P4) `Honest take: if you back up plain files and want free + self-hosted, use Backrest — it's good. If your containers run databases, path-based tools copy live DB files. That's the gap Dockstash exists for.` — the honesty *is* the hook.
16. (P3) Lesson-learned post from the week's support/feedback.

## LinkedIn adaptation (1–2/wk, not 4)

Longer form, agency/compliance angle: turn #2, #14, and the week-12 data post into 150–250 word posts. Hook line first ("An agency lost 14 client sites because one backup script never dumped the database…"), no hashtags-soup, end with a question. Founder personal profile, not company page (10× reach).

## Rules

- Every screenshot from the real product; blur real user data.
- Disclose founder status in bio + when replying to backup threads.
- Never post absolute claims ("never lose data") — the brand is *proof*, not promises.
- Reply to every reply for the first 2 hours after posting.
- UTM every link (doc 11); links in first comment on LinkedIn (algorithm), inline elsewhere.
- Track weekly: follows, link clicks, signups per platform. Kill LinkedIn after 8 weeks if zero pipeline; X/Mastodon stay regardless (they feed community + AI presence).
