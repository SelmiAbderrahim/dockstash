# X-02 — The DIY Math

**Pillar:** P1/P2 · **Format:** single long post (X Premium) or split at the marked break
**CTA:** free tier. The "math beat" from the viral anatomy, applied honestly: instead of
invented RPM numbers, the real cost of the thing everyone already believes is free.

---

The "free" DIY Docker backup stack, priced honestly:

- restic + cron wrapper: 4–6 hrs to write
- correct dump flags for each database: 2 hrs in the docs (pg_dumpall vs pg_dump matters; so does --single-transaction; so does --oplog)
- retention + prune policy: 1 hr
- alerting when it *silently* stops: rarely ever built
- scheduled test restores: almost never built

At freelance rates that's a $500+ build — with the two parts that actually save you missing.

Because the script was never the product. The parts everyone skips are the product:
knowing it still runs, and knowing it restores.

—— [split here if threading] ——

To be fair to DIY: if you enjoy maintaining yours, keep it. You control every line, and that's worth something real.

If you'd rather not: I built Dockstash to be that script, hardened and verified — it reads your compose file, dumps each DB correctly, backs up with restic to your own storage, and runs scheduled restore drills that prove snapshots restore.

Free for one project, no card: dockstash.com

---

**Ops notes**
- The bullet math invites "6 hours? took me 2" replies — that's engagement, agree
  cheerfully and ask if they alert on silence. The point lands either way.
- Used on: ____
