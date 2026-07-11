# X-01 — The Architecture Thread (flagship)

**Pillar:** P1 · **Format:** 13-tweet thread · **CTA:** free tier + DRILL lead magnet
**Prereq:** the DRILL checklist exists and is sendable as a DM attachment/link.
This is the direct adaptation of the viral "RPM breakdown" anatomy — hook, contrast,
reframe, ladder, named proof, system, lead magnet. Every claim below is true and
public; nothing needs a placeholder.

---

**1/**
Most Docker servers with "daily backups" would not survive an actual restore.

Same cron job. Same green checkmark every night. One server comes back in 20 minutes. The other is gone for good.

The difference isn't diligence. It's architecture. 🧵

**2/**
The failure nobody sees coming:

Your script copies /var/lib/postgresql/data while Postgres is writing to it.

The job exits 0. The tarball exists. The log says success.

Inside the tarball: a database with torn pages that will never start.

**3/**
You'd think this is rare. It's the default failure mode of production.

GitLab, 2017: five backup/replication mechanisms deployed. The night they needed one, none worked as expected. Six hours of production data gone — recovery live-streamed to the world.

**4/**
Code Spaces, 2014: an attacker got into their AWS console. The backups were reachable from that same console, so he deleted those too.

The company announced its own shutdown within days.

A backup your compromised host can delete is a copy, not a backup.

**5/**
OVH, 2021: a datacenter burned in Strasbourg. Some customers had backups — stored in the same building.

"Off-site" means a different blast radius, not a different directory.

Ask what single event takes out both copies. If you can name one, you have one copy.

**6/**
The backup maturity ladder:

L0 — nothing
L1 — provider snapshots
L2 — file copies of volumes
L3 — correct database dumps
L4 — restore-tested

Most "backed up" Docker servers sit at L2. L2 fails exactly when you need it. Each level 👇

**7/**
L1 — provider snapshots: whole-disk, same provider, same account, and never database-consistent — Postgres mid-write is Postgres mid-write.

Keep them. They're a seatbelt, not a plan.

**8/**
L2 — file copies: tar the volume, rsync it somewhere.

Fine for static files. For databases it's a lie with a timestamp — the files are mid-write and the copy is torn.

The log will say success every single night until restore day.

**9/**
L3 — correct dumps. Ask the database; don't rob it:

Postgres → pg_dumpall
MySQL/MariaDB → mysqldump --single-transaction
MongoDB → mongodump --oplog

Run inside the running container. The DB hands you a consistent view instead of the filesystem handing you a lie.

**10/**
L4 — verified: on a schedule, restore the latest snapshot into a throwaway container, check it, destroy it.

That's a restore drill.

An untested backup is a hypothesis. A passed drill is a fact. This level is the whole difference between "I think" and "I know."

**11/**
The full system, whatever tools you pick:

1. Dump databases correctly (L3)
2. restic — encrypt, dedup, incremental
3. Ship it off-provider over SSH
4. Schedule restore drills (L4)
5. Alert on silence, not just errors — a dead-man's switch

That's the whole architecture.

**12/**
I built Dockstash because I wanted this to be one click instead of a weekend of scripts.

It reads your compose file, dumps each database the right way, backs up with restic to YOUR storage, and proves restores with scheduled drills.

Free for one project: dockstash.com

**13/**
And the restore-drill checklist I use — what to restore, where, what to assert, and what "passed" actually means — is written up.

Comment "DRILL" and I'll DM it. (Follow first so the DM goes through.)

---

**Ops notes**
- Post tweets 1–11 as pure value; the product appears only in 12–13. If engagement is
  strong, pin the thread for launch week.
- Reply to every reply for 2 hours. People will defend their L2 setups — agree where
  they're right (static files really are fine at L2).
- Mastodon adaptation: drop the 🧵 and the comment-DM mechanic (post the checklist link
  directly), add `#selfhosted #docker`.
- Used on: ____
