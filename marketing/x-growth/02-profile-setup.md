# 02 — Profile Setup: Bio, Banner, Link, and the Pinned Tweet

The profile has one job: **confirm the visitor's expectation.** Someone sees a post or
comment, forms an idea of you ("this person thinks about whether Docker backups
actually restore"), clicks through — and the profile must validate that idea within
two seconds, or they bounce without following.

## 1. The five elements

### Name field
`Selmi — building Dockstash` or `Selmi | dockstash.com`
The name field is searchable and shows in every reply. Attach the product to the face.

### Bio (the magnet)
Formula: **what I do + who it's for + proof/personality.** X caps the bio at 160
characters. One good pattern (159 chars — count before you paste):

> Building dockstash.com — Docker backups that prove they restore. Databases dumped
> from the running container, not copied. Restic, self-hosting, restore drills.

Rules:
- Lead with the problem/person, not job titles.
- Include the words **docker**, **backup**, **restore**, and **restic** — these are
  the keywords our people scan for, and keyword-targeted ads match on bio text, so we
  want to *be* findable the same way we target others (`06-x-ads-playbook.md` §2.9).
- "Prove they restore" is a claim about the product's behaviour, not an absolute
  promise about outcomes. Never write "never lose data again" here or anywhere.
- No hashtag soup, no 🚀🚀🚀, no "DMs open for collabs."

### Banner
A single dark screenshot of a **real restore-drill report** — one drill passed, one
drill failed with a legible reason (honesty sells, and a failing drill is the product
working). One short line of text: **"Docker backups that prove they restore."** — the
Product Hunt tagline from doc 01, 39 characters, readable on a phone. The banner is a
billboard, not a mural: one message.

Never mock this up. Every screenshot comes from the real product (doc 07 rule).

### Link
`https://dockstash.com`, UTM-tagged per doc 11 (`utm_source=x&utm_medium=social`).
Non-negotiable: the destination must stay consistent with ad destinations (X penalizes
mismatch). If we later want email capture, make it a page *on* dockstash.com, not a
linktree.

### Location / etc.
Optional. If used, keep it real. No "🌍 The Internet."

## 2. The pinned tweet — your authority in one post

The pin is the first ad you will ever run (see `06-x-ads-playbook.md`). A new visitor
who sees 50 followers but a pin with hundreds of likes and comments reads you as an
authority anyway — the pin's social proof substitutes for follower count.

Structure (all four beats, in order): **Hook → Story → Education → Engagement question.**
The closing question must be one people *enjoy* answering about themselves — people
love talking about themselves; give them a prompt, not a statement.

Both drafts exceed one tweet length. Post as a Premium long post, or split into a
4-tweet thread (hook / story / education / question) if you aren't verified yet.

**Every `<placeholder>` below is a real fact you must supply. The incident has to have
happened. Do not ship a story you invented — that is the one unrecoverable mistake.**

### Draft A — the founder story pin

> I copied a running Postgres data directory for `<N>` years and called it a backup.
>
> It restored exactly once. `<Real incident: what broke, when you found out, what it
> cost, what you changed.>`
>
> So I built Dockstash. It reads your docker-compose.yml, dumps every database from
> the running container — `pg_dump`, `mysqldump --single-transaction`,
> `mongodump --oplog` — backs the whole project up with restic, and then restores the
> snapshot into a throwaway container on a schedule to prove it worked.
>
> 5 things building it taught me:
> 1. "Backup succeeded" is a log line, not a fact.
> 2. A copied live database directory looks fine right up until it doesn't.
> 3. Almost nobody test-restores. Almost everybody assumes.
> 4. The volumes are the easy part — it's the `.env` and the proxy config you forget.
> 5. A backup you hold the keys to is the only one you actually have.
>
> When did you last restore one of your backups on purpose? 👇

### Draft B — the trust-reversal pin (closer to the source template)

> I've been running other people's servers for `<N>` years. You'd think I'd trust my
> own backups.
>
> I don't. That's why I built a tool that tests them.
>
> Dockstash reads your docker-compose.yml, dumps Postgres/MySQL/Mongo from the running
> container instead of copying live files, backs up your volumes, `.env` and proxy
> config with restic — then restores that snapshot into a throwaway container on a
> schedule and tells you whether it actually worked.
>
> Backup-succeeded is a lie. Restore-succeeded isn't.
>
> One project free. Your storage, your keys, plain restic repos — `restic restore`
> works even if I disappear.
>
> How do you know your backups restore — a drill, or faith? Drop your setup below,
> I read all of them.

Pick one, post it organically, let it collect engagement for a few days, pin it, and
later run it as the first Top-of-Funnel ad. Refresh the pin every ~2–3 months or when a
newer post clearly outperforms it.

Note that Draft B ends on a soft product line with no link. That's deliberate: pins may
name the product, TOF ads may not carry links (`06` §0).

## 3. Highlights & recent-content hygiene

The visitor also skims your last ~10 posts. Before any ad push, make sure the recent
timeline is on-niche (see the pillar mix in `04-content-playbook.md`). Delete nothing;
just make sure the last two weeks tell the same story the bio tells. If you have
genuine social proof — a drill report that caught a real failure, a Free-tier user's
unprompted thank-you, a good Reddit comment — quote-post it so it lives on the
timeline. Social proof pushes fence-sitters over.

## 4. Setup checklist

- [ ] X Premium (verification) active
- [ ] Name field carries "Dockstash"
- [ ] Bio ≤160 chars: problem + person + docker/backup/restore/restic keywords
- [ ] Banner: one real drill-report screenshot + one line
- [ ] Link: `https://dockstash.com` with UTM (and only that)
- [ ] `@dockstash` handle claimed, even if dormant
- [ ] Pin tweet posted organically → pinned after it has some engagement
- [ ] Every `<placeholder>` in the pin replaced with something true
- [ ] Last 2 weeks of posts are on-niche
