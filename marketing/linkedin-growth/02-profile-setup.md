# 02 — Profile Setup: The Profile Is the Landing Page

On LinkedIn the profile matters *more* than on X: every DM, invite, and comment
triggers a profile visit before anyone replies, and the platform gives you far more
surface to use — headline, About, Featured, Experience. The job is the same as
`../x-growth/02-profile-setup.md`: **confirm the visitor's expectation in two
seconds.** A prospect who got our DM should land here and think "ah — the
Docker-backup-restore-proof person," see evidence, and go back and reply.

The source playbook is blunt about this: outbound fails on unpresentable profiles
before the script is ever read. **You must exist on the internet** — when they look
you up, they must find something.

## 1. The elements, top to bottom

### Photo + banner
Real face photo, decent light, no logo-as-avatar (people connect with people).
Banner: same asset as the X banner — one dark screenshot of a **real restore-drill
report** (one pass, one legible failure) + one line: **"Docker backups that prove
they restore."** Real product only, always.

### Headline (the 220-char magnet)
Shows next to your name in every DM, comment, and invite — it does more work than
the About section. Formula: **what I do + who it's for + the proof mechanic.** Not a
job title.

> Building dockstash.com — Docker backups that prove they restore. Scheduled restore
> drills for agencies & teams running client sites on their own servers. Databases
> dumped from the running container, not copied.

Rules: contains **Docker**, **backup**, **restore**, **agencies** (LinkedIn search
and Sales Navigator match on headline keywords — be findable the way we find
others). Discloses founder status by construction. No "Helping X 10x their Y 🚀".

### About (first 3 lines decide everything)
Only ~3 lines show before "…see more". Open with the problem, not the biography:

> Most Docker "backups" copy live database files. They restore exactly never — and
> the cron job says "success" the whole time.
>
> I built Dockstash after learning that the hard way: it reads your
> docker-compose.yml, dumps every database from the running container (pg_dump,
> mysqldump --single-transaction, mongodump --oplog), backs the whole project up
> with restic — then restores the snapshot into a throwaway container on a schedule
> and tells you whether it actually worked.
>
> For agencies: every client server in one dashboard, restore proof you can put in
> a monthly client report, $29/mo flat — not per-site. One project is free forever,
> no card.
>
> Repos are plain restic, encrypted with your keys, on your storage. restic restore
> works even if Dockstash disappears. That's on purpose.

### Featured section (the proof shelf)
This is LinkedIn's gift — pinned, visual, above the fold. Curate 3–4 items:
1. A restore-drill report screenshot (the product working).
2. The best-performing doc-07 LinkedIn post (social proof rides along).
3. Link to `dockstash.com` — UTM-tagged `utm_source=linkedin&utm_medium=social`
   (doc 11).
4. Later: a case study / testimonial / G2 badge when a real one exists. **Never
   before one exists.**

### Experience
One entry that matters: Founder, Dockstash — two lines, same message as About.
Link it to the company page (`01` §3) so the logo resolves. Keep past roles; they
are credibility, especially anything ops/hosting-adjacent.

### URL & contact
Claim the clean vanity URL (`linkedin.com/in/<name>`). Website field:
`https://dockstash.com` with UTM.

## 2. Keyword hygiene

Sales Navigator and LinkedIn search index headline, About, and Experience. We want
inbound findability for: `docker backup`, `restore`, `restic`, `agency`,
`client sites`, `disaster recovery`. Weave them naturally into the sections above —
never as a keyword block. (The source playbook leans on HubSpot's LinkedIn profile
guide for this; the summary above is the part that matters for us.)

## 3. Recent-content hygiene

Prospects skim the activity tab. Before the first outreach wave (`03`), the last two
weeks must show doc-07 LinkedIn posts on-niche — the agency fleet-view post and the
drill-report post (doc 07 calendar #14 and #2) are exactly what a checking prospect
should find. If a real user ever posts unprompted praise, reshare it to the
timeline; social proof pushes fence-sitters.

## 4. Setup checklist

- [ ] Face photo + drill-report banner (real product, one line of text)
- [ ] Headline: problem + person + docker/backup/restore/agency keywords, founder
      status visible
- [ ] About: problem-first open, agency paragraph, plain-restic trust line
- [ ] Featured: drill screenshot, best post, UTM-tagged site link
- [ ] Experience entry linked to a filled-in company page
- [ ] Vanity URL claimed; website field UTM-tagged
- [ ] Last 2 weeks of activity are on-niche doc-07 posts
