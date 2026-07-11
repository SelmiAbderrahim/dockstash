# X-07 — Launch Day Thread

**Pillar:** P3 · **Format:** 7-tweet thread, posted launch morning (align with doc 02)
**CTA:** free tier + the Show HN / PH link in a reply.
Placeholders are mandatory fills — the founder story in tweet 2 must be true.

---

**1/**
Today I'm launching Dockstash → dockstash.com

The short version: it backs up your whole Docker project in one click — and then *proves* the backup restores.

Why I built it 🧵

**2/**
`<Your real story. The moment you stopped trusting your own backups — the silent
pg_dump failure, the restore you never tested, the near-miss. Dates and specifics.
This tweet decides whether the thread works. Do not fabricate; do not generalize.>`

**3/**
The core problem: most Docker "backups" copy live database files. Postgres mid-write, torn pages, exits 0, log says success.

You find out on restore day. That failure mode is the entire reason this product exists.

**4/**
What Dockstash does instead:

→ scans your compose project, proposes the whole plan
→ dumps each DB the correct way (pg_dumpall / mysqldump --single-transaction / mongodump --oplog) from the running container
→ restic: encrypted, deduped, incremental, to YOUR storage over SSH

**5/**
And the part I care about most: scheduled restore drills.

It restores your latest snapshot into a throwaway container, verifies it, destroys it. On a schedule. You get proof, not a green checkmark.

Plus loud failure: email alerts + a dead-man's switch for silent stalls.

**6/**
Pricing, honestly:

Free — 1 project, daily backups, 7-day retention, fully self-hostable, no card
Pro $9/mo — 10 projects, hourly, 30-day, PITR, restore drills, alerts
Business $29/mo — unlimited projects, any cron, multi-VPS fleet, 90-day

The free tier stays free.

**7/**
What it is NOT: a cloud that holds your data. Backups are plain restic repos on your own storage VPS, encrypted with your keys. If Dockstash disappears tomorrow, `restic restore` works without us. That's on purpose.

If you run Docker in prod — try it, and tell me where it's wrong.

---

**Ops notes**
- Reply #1 (yours, immediately): the Show HN / Product Hunt link + "upvotes welcome,
  bug reports welcomer."
- Live all day: reply to everything, retro thread with real numbers 48h later
  (see post bank #29).
- Used on: ____
