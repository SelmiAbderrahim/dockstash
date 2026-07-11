# Swipe File — Hook Bank (Dockstash-flavored)

The first line decides everything. Workflow rule: generate/pick **10 hooks before
writing any body** (`../07-ai-writing-system.md` §3). Formulas below with
Dockstash-ready examples — mix, mutate, never reuse verbatim twice in a month.

Every example must survive the swap test (`writing-principles.md` §6): if it still
works with a generic SaaS name in place of ours, it isn't a Dockstash hook.

Feed and refresh this file from real winners in `high-performing-tweets.md`.

## Curiosity
- "The real reason [outcome] happens isn't what you think."
  → *The real reason your restore failed isn't the backup. It's the copy.*
- "Nobody talks about [insider knowledge]."
  → *Nobody talks about what a `postgres` data directory looks like when you tar it mid-write.*
- "[Impressive result] — and it took [surprisingly little]."
  → *Every database in that compose file, dumped correctly — one config, ten minutes.*

## Story
- "At [specific time], [unexpected thing] happened."
  → *At 2:47am a client's database came back empty. The backups had been "working" for 14 months.*
- "[Time period] ago, [past state]. Today, [current state]."
  → *A year ago Dockstash was a bash script that tarred a volume. Today: `<real milestone>`.*
- "I almost [big mistake]."
  → *I almost shipped a backup tool that never tested its own restores.*

## Value
- "How to [outcome] (without [pain]):"
  → *How to find out your backups are broken today, instead of on the day you need them:*
- "Stop [common mistake]. Do this instead:"
  → *Stop copying `/var/lib/postgresql/data`. Dump it from the running container instead.*
- "[N] [things] that [outcome]:"
  → *3 commands that decide whether your Docker backup restores: `pg_dump`, `mysqldump --single-transaction`, `mongodump --oplog`.*

## Contrarian
- "Unpopular opinion: [bold statement]"
  → *Unpopular opinion: an untested backup and no backup are the same product with different feelings attached.*
- "Everyone says [X]. The truth is [Y]."
  → *Everyone says VPS snapshots are a backup. The truth is they're whole-disk, same-provider, and nobody has ever restored one on purpose.*
- "I stopped [common practice] and [positive result]."
  → *I stopped trusting "backup succeeded" and started restoring on a schedule. The first drill failed.*

## Social proof / milestone
- "We [result] in [timeframe]. Here's the story:"
  → *`<N>` restore drills ran this month. `<N>` of them failed. That's the feature, not the bug:*
- "[N] people asked me about [topic]. Here's the answer:"
  → *A dozen people asked why dumping beats copying. One post, everything:*

## Confession / vulnerability
- "I was wrong about [belief]."
  → *I was wrong about volume snapshots. They're consistent for the filesystem and useless for the database.*
- "The dumbest data loss I ever caused:"
  → *(then the real story — vulnerability posts get the best replies. It has to be true.)*

## Question (engagement-first posts)
- Direct prompt people enjoy answering about themselves:
  → *When did you last restore a backup on purpose? Not "have a backup" — restore one.*
  → *Finish the sentence: "We found out the backups were broken when ___."*
  → *What's in your compose file that you'd cry about losing? Be specific.*

## Concede-then-compare (our own formula — honesty is the hook)
- "[Competitor] is genuinely good at [X]. It doesn't do [Y]."
  → *Backrest is a genuinely good restic UI. It also happily copies your live Postgres files, because it backs up paths, not Docker projects.*
- Never open with the gap. Open with the concession — it buys the right to name the gap,
  and one-sided comparisons get discounted by humans and AI answer engines alike
  (`../01-foundations.md`, doc 01's competitor rule).

## First-line hygiene
- Keep the first line SHORT — long first lines truncate in feed and kill the hook.
- No links in the first line (or, for TOF content, anywhere).
- Numbers beat adjectives: "14 months of broken backups" > "broken for a long time".
- Specificity beats cleverness: "2:47am" > "late at night".
- No absolutes. "Proves it restores" is a claim about the drill; "never lose data" is
  a lie and an auto-reject.
