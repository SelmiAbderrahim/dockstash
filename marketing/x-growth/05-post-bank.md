# 05 — Post Bank: Ready & Near-Ready Dockstash Posts

50 posts, grouped by the four pillars from `04-content-playbook.md` (which are doc 07's
pillars). Copy, adapt, schedule. Rules before using any of these:

- **These extend `../07-social-content.md`'s 16-post calendar — they do not repeat it.**
  Read that doc's Weeks 1–4 before scheduling, so you don't ship the same idea twice
  under two different hooks.
- Replace every `<placeholder>` with a **real, current** number/fact. Never post an
  invented metric or a story that didn't happen (hard rule, `README.md`).
- Disclose that you built Dockstash on any post that reads like a pitch. Every time.
- Personalize the voice — these are skeletons; add your phrasing, your screenshots.
  Every screenshot comes from the real product.
- Run the swap test (`swipe-file/writing-principles.md` §6) before scheduling. If the
  post works with a generic SaaS name in it, rewrite it around a dump, a drill, or a
  restore.
- One post/day minimum; don't fire the whole bank in a week. Mark used posts with a
  date so you know what's been burned (evergreen ones can rerun after ~2–3 months,
  rephrased).
- Posts marked **[thread]** need expansion; each thread tweet stays under one tweet
  length. **[img]** wants a screenshot. **[clip]** wants ≤60s of screen capture.
- After something here outperforms, feed it to `06-x-ads-playbook.md` (24h later) and
  make more like it via `07-ai-writing-system.md`.

Pillar shares: P1 40% · P2 25% · P3 20% · P4 15%. The reactive, lead-magnet, and
engagement sections at the bottom are *modes*, not pillars — each one lands in whatever
pillar its topic belongs to.

---

## P1 — Backup education & horror stories (40%)

1. **[thread]** What actually happens when you `tar` a running Postgres data directory:
   1/ the heap files are mid-write 2/ the WAL and the heap disagree 3/ you get a tarball
   with a torn page in it 4/ Postgres refuses to start, or worse, starts 5/ you find out
   ~11 months later. `pg_dump` asks the database for a consistent view. Copying asks the
   filesystem for a lie. 🧵 expand each.

2. `pg_dump` gives you one database. `pg_dumpall` gives you roles, tablespaces, and
   grants too. Restore the first into a fresh cluster and every permission your app
   depends on is gone. Ask me how I know.

3. `mysqldump --single-transaction` is consistent — for InnoDB. If one MyISAM table
   snuck into that schema, it's dumped outside the transaction and it's torn. Check
   your engines before you trust your flags.

4. `mongodump` without `--oplog` gives you "roughly the state around when it ran."
   With `--oplog` you get a consistent point. On a live collection that difference is
   the whole restore.

5. Redis: copying `dump.rdb` while Redis is writing it gives you half a snapshot.
   `BGSAVE`, wait for it to finish, *then* copy. Or accept that your cache is
   disposable and don't back it up at all — that's a valid answer.

6. Everyone backs up the volume. Almost nobody backs up the `.env`.
   Restore the data, lose the file that tells the container which database, which
   secret, which port — and you have a very well-preserved brick.

7. Your reverse-proxy config lives in the compose project, not the volume. Traefik
   labels, nginx confs, cert paths. Restore the app, lose the routing, spend a Saturday
   remembering how it was wired.

8. Encryption at rest is a checkbox. Key management is the actual product.
   Where is your restic repo password right now? If the answer is "in the backup
   script, on the box I'm backing up," you have encrypted your data against yourself.

9. Retention math nobody does: 7 daily + 4 weekly + 6 monthly = 17 snapshots.
   With restic's dedup, snapshot 17 costs you the *changes*, not another full copy.
   People under-retain because they're pricing full copies that don't exist.

10. "Off-site" means a different blast radius, not a different directory.
    Same provider, same account, same billing dispute = same outage. Ask what single
    event takes out both copies. If you can name one, it's one copy.

11. `<Real incident — yours or a public postmortem, with dates.>`
    The backups had been "succeeding" the entire time. That's the part that should
    scare you: nothing was broken. Nothing alerted. The job exited 0 every night.

12. Your backup repo is mounted read-write on the host you're backing up.
    So is everything ransomware touches. A copy your compromised host can delete is a
    copy, not a backup. Append-only, or a second destination it can't reach.

13. `restic check` verifies the repository structure. `restic check --read-data`
    verifies the data is actually there and actually decrypts. One takes seconds. One
    takes hours. Only one of them tells you the truth. Run it monthly, on a schedule,
    or you're checking the index of a book with no pages.

14. Do you know your restore *time*? Not whether it works — how long. A 40GB Postgres
    from a cold off-site repo is a coffee, a meeting, and a difficult conversation.
    Measure it once, write it down, tell whoever will ask.

15. The thing that backs up your stack needs backing up too. Its config, its schedules,
    its keys. A backup orchestrator that can't restore itself is a single point of
    failure wearing a helmet.

16. Docker volumes get backed up. Bind mounts get missed, because they look like part
    of the host, not part of the project. Read your compose file and find the one you
    forgot. There's always one.

17. **[img]** A `docker-compose.yml` on the left, its real backup plan on the right:
    which services are dumped (and with which command), which volumes are copied, which
    files come along. Everything you don't list here is data you've decided to lose.

---

## P2 — Product proof (25%) — promo capped at ~1 post in 20

18. **[img]** A restore-drill report where the drill **failed**, with the real reason
    legible. This is a good day. The alternative was finding out in eleven months.
    (I build Dockstash — this is its drill output.)

19. **[img]** Detection screenshot: point it at a compose project, it classifies each
    service — Postgres → `pg_dump`, Mongo → `mongodump --oplog`, this volume → copy,
    this `.env` → include. No YAML written by hand. Disclosure: my product.

20. **[clip]** 60 seconds: a snapshot restored into a throwaway container, schema
    checked, container destroyed. That's the drill. Nothing about the live system is
    touched. This is what "proven restorable" has to mean or it means nothing.

21. **[img]** Point-in-time restore: pick 14:03, three minutes before the migration
    that ate the table. Screenshot of the timeline. PITR is on Pro ($9/mo) — the
    feature exists because a bad `DELETE` is more common than a dead disk.

22. Two storage destinations, one schedule, no second cron. Mirroring is a Business
    feature and it exists for one reason: the second copy should not be reachable from
    whatever kills the first.

23. Fleet agents: 1 on Free, 5 on Pro, unlimited on Business. The agent is a pull-based
    daemon — it asks the server for work; the server never reaches into your host.

24. Adapters are the whole trick. Postgres, MySQL/MariaDB, Mongo, Redis, ClickHouse,
    Elasticsearch — each one knows the correct way to be dumped from a *running*
    container. Adding one is ~a day. Getting the flags right is the day.

25. **Concede first:** Duplicati is free, has a huge backend list, and a mature UI.
    It also backs up paths, which means it copies your live database files like
    everything else that isn't Docker-aware. Its database-corruption reputation isn't
    unfair — it's structural. That gap is why I built mine.

26. **Concede first:** a cron + restic script is free and you control every line.
    The script is also the product. Dump correctness, retention, encryption, alerting
    when it fails, and a scheduled restore that proves any of it — those are the parts
    people skip, and they're skipped in that order.

27. **Concede first:** SimpleBackups is a polished SaaS with broader integrations than
    I have. It also prices per server and per database. If you run ten client stacks,
    do that arithmetic before you do mine ($29/mo flat, unlimited projects).

28. **[promo — ~1 in 20]** One Docker project, backed up daily, 7-day retention, your
    storage, your keys, no card. That's the free tier and it stays free. The paid tiers
    exist for the second project, not the first.

---

## P3 — Build in public (20%)

29. Real numbers from `<month>`: `<N>` signups, `<N>` projects protected, `<N>` restore
    drills run, `<N>` of them **failed**. The failure count is the one I'd want to see
    if I were you.

30. Design decision I'll defend: the fleet agent **pulls**. It asks my server for work.
    My server holds no credentials to your host and can't open a connection to it. A
    push architecture would have shipped two months earlier and I'd have spent those
    two months worrying.

31. Dockstash never mounts `/var/run/docker.sock`. It talks to a least-privilege socket
    proxy with a verb allowlist. A backup tool with the Docker socket is a backup tool
    with root on your host. That tradeoff isn't mine to make on your behalf.

32. **[img]** Shipped `<adapter>` this week. One screenshot, zero fluff. The hard part
    was never the code — it was `<real decision>`. Building a Docker backup tool in
    public; follow along.

33. Asked "would I pay for this?" about every feature. Killed `<N>` this month that
    failed the test. Subtraction shipped faster than addition did.

34. The unglamorous week of a devtools founder: `<boring real thing — RTL layout, email
    deliverability, SPF records>`. Nobody signs up for a backup tool because of its
    DMARC config. They churn without it.

35. Pricing decision: $29/mo flat, not per site. An agency with 40 client stacks pays
    the same as one with 4. Per-site pricing punishes exactly the customer the product
    is best for, and I'd rather have the customer.

36. **[poll]** Genuinely torn, building in public: which adapter next? —
    ClickHouse / Elasticsearch / InfluxDB / "you're missing an obvious one, reply"

---

## P4 — Community & curation (15%)

37. Boost a self-hosted project you actually run: what it is, one specific thing it does
    well, one thing you learned setting it up. No ask. This is rent for living here.

38. A restic tip with nothing to do with my product: run `restic forget --dry-run`
    before you ever run `restic forget`. The retention flags compose in ways that will
    surprise you exactly once.

39. Quote-post a good backup thread and add the one thing it's missing. Credit the
    author in the first line. If your addition is "and my product does this," don't
    post it.

40. Answer, publicly, the question you've now been asked three times in DMs. Credit the
    person who asked. Recurring questions are free content and the asker becomes an
    advocate.

---

## Reactive templates (P1/P4 mode — post live when the news breaks)

41. **When a public data-loss postmortem lands:** quote it, extract the one
    transferable lesson, and say nothing about your product. Never dunk. Everyone
    reading it is imagining it happening to them — that's the post, and it does not
    need a CTA. `<link + one lesson>`

42. **When a provider has a major incident:** the reminder isn't "buy a backup tool."
    It's: ask what single event takes out both of your copies. If you can name one,
    you have one copy. (Then stop typing.)

43. **When a vendor shuts down or gets acquired:** "someone else's computer" is a real
    place with real failure modes. Whatever you're running, know how you'd get your
    data out on a Tuesday with no warning. Mine are plain restic repos on the user's
    own storage, specifically so that Tuesday is boring.

---

## Lead-magnet posts (full mechanics in `04` §4 — one every 2–3 weeks)

44. **[lead magnet — `AUDIT`]** Your `docker-compose.yml` already tells you whether
    your backups will restore. Every service whose data directory you're copying —
    `postgres`, `mysql`, `mongo` — is a service you're backing up wrong. I wrote a
    script that reads your compose file and flags each one. Comment "AUDIT" and I'll DM
    it (follow so the DM goes through).

45. **[lead magnet — `DRILL`]** "Test your restores" is useless advice without a
    definition of *passed*. I wrote the checklist I use: what to restore, where to
    restore it, what to assert, and what to do when it fails at 2am instead of never.
    Comment "DRILL" and I'll DM it (follow required for the DM to send).

---

## Engagement-question posts (any pillar, cheap replies)

46. When did you last restore a backup on purpose? Not "have one" — restore one.
    I'll go first: `<honest answer, including the last time it failed>`.

47. Finish the sentence: "We found out the backups were broken when ___."

48. What's in your compose file that you'd actually cry about losing? Be specific —
    "the database" is not an answer, "four years of family photos in Nextcloud" is.

49. What's the worst data loss you've ever caused? I'll go first: `<real story>`.
    (No judgment in this thread. Everyone here has one.)

50. You get one storage backend for the rest of your career. Which, and why?
