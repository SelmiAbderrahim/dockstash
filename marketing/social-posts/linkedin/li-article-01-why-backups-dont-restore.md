# LI-Article-01 — Your Docker Backups Probably Won't Restore

**Format:** LinkedIn Article (long-form), ~900 words. Publish under the founder
profile, then post a ~100-word companion post linking to it (link in first comment).
Also reusable as a dockstash.com blog post — publish on the site first, article
second, for SEO canonical ordering.

---

## Your Docker Backups Probably Won't Restore — the Five Silent Failure Modes

Every backup failure story has the same shape. Nothing was visibly broken. The job ran every night. The log said success. Then one day a disk died, or a migration went wrong, or someone deleted the wrong directory — and the backups that had been "succeeding" for months turned out to be unrestorable.

In 2017 this happened to GitLab in public: five backup and replication mechanisms deployed, and on the night that mattered, not one worked the way anyone expected. If it can happen to a company full of infrastructure engineers, it can happen to your VPS.

After building a backup tool for Docker projects (disclosure: I'm the founder of Dockstash), these are the five failure modes I see most — every one of them silent until restore day.

### 1. You're copying live database files

The most common one, and the worst. A script tars the Postgres volume, or rsyncs /var/lib/mysql, while the database is writing to it. The copy contains torn pages — the heap and the WAL disagree about reality. The job exits 0. The tarball exists. The database inside it will never start.

The fix is old and boring: ask the database for a consistent view instead of robbing the filesystem. `pg_dumpall` for Postgres, `mysqldump --single-transaction` for MySQL and MariaDB, `mongodump --oplog` for MongoDB — executed inside the running container. A dump restores. A live-file copy is a lie with a timestamp.

### 2. The flags are subtly wrong

Even teams that dump correctly get bitten by flags. `pg_dump` gives you one database — but not roles, tablespaces, or grants; restore it into a fresh cluster and every permission your app depends on is gone (`pg_dumpall` includes them). `mysqldump --single-transaction` is consistent for InnoDB — but if one MyISAM table snuck into the schema, it's dumped outside the transaction, torn. `mongodump` without `--oplog` gives you "roughly the state around when it ran," which on a live collection is not a restore point at all.

None of these errors produce a warning. All of them produce a backup that fails differently than you expect, later than you'd like.

### 3. You backed up the data and lost the project

A Docker project is more than its volumes. The `.env` file holds which database, which secrets, which ports. The compose file holds the topology. The reverse-proxy config — Traefik labels, nginx confs, certificate paths — holds the routing. Restore the volume without them and you own a well-preserved brick, plus a weekend of remembering how it was all wired.

Bind mounts deserve a special mention: they get skipped constantly, because they look like part of the host rather than part of the project. Read your compose file and find the one you forgot. There's always one.

### 4. "Off-site" isn't

In 2021 a datacenter fire in Strasbourg destroyed servers — and, for some customers, the backups stored in the same building. In 2014, Code Spaces lost its business in days when an attacker who compromised their console deleted the backups reachable from that same console.

"Off-site" means a different blast radius, not a different directory. The test is one question: what single event takes out both copies? A fire, a billing dispute, a compromised host with write access to its own backup repo, one cloud account. If you can name one, you have one copy.

### 5. Nothing tells you when it stops

The quietest failure mode: the backup simply stops running. A version bump breaks the script, a cron daemon dies, an SSH key expires — and nothing errors, because nothing runs. Every monitoring setup that alerts on failure misses the case where there's no run to fail.

The fix is a dead-man's switch: alert on *silence*. If a backup hasn't completed in N hours, that's the alert — no error required. GitLab's postmortem is again instructive: several of their mechanisms hadn't been working for some time. Nobody knew, because nothing complained.

### What "verified" actually means

Every failure mode above shares one property: it's invisible until you attempt a restore. Which points at the only real countermeasure — attempt restores, on a schedule, before you need them.

A restore drill is exactly that: restore the latest snapshot into a throwaway environment, verify the data is present and the database starts, then tear it down. Nothing about the live system is touched. Run it weekly and the failure modes above stop being time bombs; they become tickets.

An untested backup is a hypothesis. A passed drill is a fact.

### The honest tooling paragraph

You can build all of this yourself with restic, cron, and discipline — plenty of people do, and if you enjoy maintaining it, it's a fine choice. Backrest is a good self-hosted restic UI if your data is plain files. If your containers run databases, path-based tools inherit failure mode #1 — that gap is why I built Dockstash: it reads your compose file, dumps each database correctly from the running container, backs up with restic to your own storage, and runs the restore drills for you. The free tier covers one project, no card.

But tool choice is secondary. Whatever you run tonight, ask it the five questions above. The answers are cheaper now than on restore day.

---

**Companion post (publish same day, link to article in first comment):**

> Five ways Docker backups fail silently — and every one of them says "success" in
> the log until restore day.
>
> I wrote up the full breakdown: live-file copies, wrong dump flags, missing .env,
> fake off-site, and the backup that quietly stops running. Plus what "verified"
> actually has to mean.
>
> Article in the comments. Which of the five have you been bitten by?

**Ops notes**
- All incidents cited are public (GitLab 2017, OVH 2021, Code Spaces 2014); keep
  descriptions factual, no dunking.
- Used on: ____
