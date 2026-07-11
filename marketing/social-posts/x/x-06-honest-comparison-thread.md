# X-06 — The Honest Comparison Thread

**Pillar:** P2/P4 · **Format:** 7-tweet thread · **CTA:** free tier, with a built-in
"you may not need me" exit. Concede-first is the hook — devs share posts that tell
people *not* to buy.

---

**1/**
Which Docker backup tool should you actually use?

Honest answers from someone with a horse in the race (I built one of these) 👇

**2/**
Backrest — if you back up plain files and want free + self-hosted, use Backrest. It's a good restic UI with a solid scheduler.

Its gap: it backs up *paths*. It doesn't know your postgres container needs a pg_dumpall, not a file copy.

**3/**
Duplicati — free, huge backend list, mature UI.

Also path-based, so same live-DB-file problem. And its database-corruption reputation isn't bad luck — it's structural. I'd trust it with documents, not with a production stack.

**4/**
DIY restic + cron — free, and you control every line. Genuinely valid.

The catch: the script is also the product. Dump correctness, alerting on silence, and test restores are the parts people skip — and they're skipped in exactly that order.

**5/**
SimpleBackups / SnapShooter-class SaaS — polished, broader integrations than I have, real support.

They price per server and per database. If you run ten client stacks, do that arithmetic before you do mine.

**6/**
Provider snapshots — keep them. They're free-ish and they've saved people.

But: whole-disk, same provider, same account, never database-consistent. A seatbelt, not a plan.

**7/**
Dockstash (mine) — reads your compose file, dumps each DB correctly from the running container, restic to YOUR storage, scheduled restore drills prove it restores. Free for one project.

If you don't run databases in containers → tweet 2, use Backrest. Everyone else: dockstash.com

---

**Ops notes**
- Every concession must stay factually current — recheck Backrest/Duplicati feature
  sets quarterly before rerunning.
- This is the post most likely to be screenshot-quoted. It must survive hostile
  fact-checking.
- Pairs with the site's competitor pages; link one in a reply, not the thread.
- Used on: ____
