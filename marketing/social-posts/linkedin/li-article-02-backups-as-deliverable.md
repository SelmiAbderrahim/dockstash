# LI-Article-02 — Turn Client Backups From a Cost Into a Deliverable

**Format:** LinkedIn Article (long-form), ~700 words, agency audience. Feeds the
Business-tier funnel (docs 09 + linkedin-growth/03). Publish on dockstash.com blog
first, article second.

---

## Turn Client Backups From a Cost Into a Deliverable

Every agency care plan says "daily backups included." Almost none of them can answer two questions about those backups:

1. Is the database dumped correctly — or is a script copying live database files that won't restore?
2. Has anyone ever actually restored one?

If you host client sites, this is the quiet liability on your books. Not because you're careless — because you're running 30 client stacks on tooling and habits designed for one, and backup verification is the task that never makes it off anyone's list.

Here's the reframe this article exists for: **a restore test isn't an internal chore. It's a deliverable your clients will value — and you're already charging for it.**

### The line item

A scheduled restore drill — restore the latest snapshot into a throwaway environment, verify it, tear it down — produces something no ordinary backup job produces: a timestamped, client-legible fact.

> ✅ Backup restore-tested: March 4, 2026 — passed.

Put that line in the monthly report you already send. That's the entire play.

What it changes:

- **Backup becomes visible.** Clients never see backups until the day they need one. A monthly "restore-tested" line is the first time most clients learn their maintenance fee buys something verifiable.
- **"How do you know?" has an answer.** The first time a client — or their lawyer, or their insurer — asks how you know the backups work, you have a timestamp instead of a pause.
- **It justifies the care plan at renewal.** A year of "restore-tested, passed" lines is a retention artifact. It's proof of diligence competitors offering "daily backups included" can't match.

### The uncomfortable math

Two numbers worth writing down.

**Restore time.** Not whether a client site comes back — how long. A 40GB database from a cold off-site repo is a coffee, a meeting, and a difficult conversation. Measure it once per client class, write it into the care plan as an honest RTO, and you've turned an unknown into a term of service.

**Tooling cost per client.** Per-site backup pricing punishes exactly the shop the tooling is best for. Ten client stacks at per-server SaaS pricing is a real monthly line; at 40 stacks it's a budget item. Whatever tool you pick, price it at your fleet size, not your pilot size.

### How to actually run this

Tool-agnostic version:

1. **Inventory per client:** volumes, databases (and engines), .env/compose files, proxy config. If the database is backed up as files rather than dumps (`pg_dumpall`, `mysqldump --single-transaction`, `mongodump --oplog`), fix that first — nothing downstream matters until the dump is restorable.
2. **Ship off your infrastructure:** a storage box that a compromised client host can't write to, in a different blast radius.
3. **Schedule drills, not just backups:** weekly restore-to-scratch per client, automated, with the result logged.
4. **Alert on silence:** a dead-man's switch that fires when a backup *doesn't run*, not just when one errors.
5. **Surface it:** the report line, per client, per month.

Disclosure, and the shorter version: I built Dockstash to make this the default instead of a project. It scans each client's compose project, dumps databases correctly from the running containers, backs up with restic to your own storage, runs the restore drills on a schedule, and shows the whole fleet — every client server — on one dashboard. It's $29/month flat for unlimited projects, deliberately not per-site, because per-site pricing punishes agencies. There's a free tier to trial on one internal project first, no card.

But the reframe stands whatever you run: stop treating backup verification as overhead you hope never to think about. It's the cheapest deliverable you're not shipping.

---

**Companion post (same day, article link in first comment):**

> Agencies: you're already doing the work. You're just not putting it in the report.
>
> "Backup restore-tested on March 4 — passed" is one line in a monthly client report.
> It turns backup from an invisible cost into a deliverable clients renew for.
>
> Full playbook in the article (comments) — including the two numbers worth writing
> down: your real restore time, and your real per-client tooling cost.

**Ops notes**
- Anyone engaging with this who matches the agency ICP → linkedin-growth/03 DM sheet.
- Used on: ____
