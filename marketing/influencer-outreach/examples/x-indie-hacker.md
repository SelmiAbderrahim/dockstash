# Case: X Build-in-Public Indie Hacker

**Who:** indie hacker shipping in public, running production on a VPS (Hetzner/DO),
Docker Compose visible in their posts. They talk about MRR and uptime; they rarely
talk about backups — until one scares them.
**Channel:** X DM (see `../x-dm.md` for the closed-DM variant).
**Label:** `x-<handle>`.

## Example prospect (invented — replace everything)

@ninaships, ~8k followers, building a scheduling SaaS solo. Last week tweeted a
screenshot of her Hetzner box: "one €9 VPS serving 400 paying users, docker compose,
no k8s, fight me." Older tweet in her feed: "note to self: set up proper postgres
backups before this gets embarrassing."

## The DM

> Hey Nina — "one €9 VPS serving 400 paying users, no k8s, fight me" is the correct
> architecture and I will not be fighting you. But I did scroll back and find the
> "set up proper postgres backups before this gets embarrassing" tweet.
>
> I build Dockstash: it reads your compose file, dumps Postgres correctly from the
> running container (pg_dumpall, not a live file copy), backs up with restic to your
> own storage box, then runs scheduled restore drills that prove the snapshot
> restores. Backup-succeeded is a lie; restore-succeeded isn't.
>
> Free year of Business, yours, no card: {invite_link}
> Single-use link, expires in 30 days, the year starts when you activate.
>
> No post required. If you do mention it, say you got the year free. If it's bad,
> tell me that instead — you build in public, so you know honest feedback is the
> actual currency.
>
> — Selmi

## Follow-ups

Standard `../x-dm.md` cadence: day 3, day 8, stop.

## Why this shape

- Two references, both hers, three weeks apart — proves a human read the feed, not
  a scraper. The second reference *is* the pain; no need to manufacture one.
- Build-in-public people convert into the loudest advocates because sharing tools is
  already their content format. That's why this segment is worth the scroll time.
- "Your own storage box" matters to this persona (they're cost- and lock-in-averse).

## Do not

- Quote-tweet her VPS post to start the relationship — that's a broadcast, not a DM.
- Pitch during her launch week; wait. Attention is the scarce thing you'd be taking.
- Mention her MRR numbers back at her. Reading is fine; itemizing is creepy.
