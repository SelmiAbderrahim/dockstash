# 01 — Foundations: Who, Why, and the Rules of the Game

Read this once, before anything else. Everything downstream (profile, DMs, ads)
inherits from the decisions on this page.

This folder is the LinkedIn-specific deep dive. It **inherits** its pillar mix,
cadence, UTM discipline, and disclosure rules from `../07-social-content.md`. Nothing
here may contradict it. Product facts trace to `../01-positioning-and-icp.md` and
`server/src/modules/billing/plans.ts`.

## 1. Is our customer even on LinkedIn? (Two of them, very much.)

LinkedIn is not "corporate social media for job hunting" — it is where hundreds of
thousands of business owners and team leads spend work hours, and for B2B it is the
one platform where you can filter the entire member database down to your exact buyer
and message them directly. The four personas from doc 01, and where LinkedIn reaches
them:

- **Marco — agency / freelancer (PRIMARY).** Doc 01 lists LinkedIn as one of his
  watering holes explicitly. Runs 10–50 client sites across VPSes; backups are an SLA
  line-item and a liability. He is on LinkedIn for business development — which means
  he *answers DMs there*, unlike email he filters. The Business tier ($29/mo flat,
  unlimited projects, fleet dashboard) is built for him. **The outbound motion (`03`)
  is aimed at Marco.**
- **Dana — small DevOps team (PRIMARY for ads, secondary for DMs).** Also on LinkedIn
  per doc 01. Needs backup *evidence* for compliance and audits. Longer cycle; a DM
  won't close her, but the drill-report content and (later) remarketing keeps us in
  view until the audit that makes her move.
- **Ines — indie dev / solo founder.** On LinkedIn but lives on X. Reach her via
  `../x-growth/`; don't spend LinkedIn effort here.
- **Sam — self-hoster.** Not reachable here in buying mode. Reddit/Mastodon own him.

Corollary: **LinkedIn is the Business-tier channel.** Posts, DMs, and ads here sell
"prove every client backup restores, one dashboard, flat price" — not the hobbyist
angle.

## 2. The niche: one person, one problem, one message

The source playbook's strongest claim, and it matches our experience elsewhere:
**who you target matters more than what you say.** A perfect script sent to the wrong
ICP converts at zero. Before any outreach:

- **Person:** agency owner / technical founder of a 2–20 person web shop that hosts
  client sites on its own VPSes (WordPress maintenance providers, dev agencies with
  "care plans", freelance sysadmins with a client roster).
- **Problem:** they are contractually responsible for client data, their backups are
  a cron job someone wrote in 2021, and none of it has ever been restore-tested.
  If a client's server dies, they find out live, in front of the client.
- **Message:** you can hand a client *proof* their backup restores — monthly,
  automatically — and it costs $29/mo flat, not per-site.

Get this narrow and the DM script almost doesn't matter; get it wrong and no script
saves it. The list-building recipe is in `03` §2.

## 3. Founder profile vs company page

**Lead with the founder profile.** Doc 07 already rules this: personal profile, not
company page — roughly 10× the organic reach, and connection requests only exist
between people. People buy from people; the product inherits the trust.

- **Personal profile (primary):** all content, all outreach, all replies. Signs
  everything "— Selmi".
- **Dockstash company page (secondary):** claim it, fill in the basics (logo, one-line
  description, link) so the employer field on the personal profile resolves to
  something real — prospects *will* click it. Post release notes occasionally. Ads
  (`05`) technically run from the company page account; that is the only job it must
  do well. Don't split content energy into it.

## 4. Core principles (internalize these — they veto tactics)

1. **Don't be the van.** The source playbook's image: walking up to a stranger and
   shouting "get in the van" — no hello, no context. That is what pitch-first DMs and
   sign-up-now ads are. Every first touch offers value and asks for nothing.
2. **Targeting beats copy.** Hours spent narrowing the Sales Navigator search pay
   more than hours polishing the script. Selling cold-email software to B2C founders
   fails on targeting, not phrasing — same for selling restore drills to people with
   no clients.
3. **The profile is the landing page.** Every DM and comment triggers a profile
   visit before a reply. If the profile doesn't confirm "this person is the
   Docker-backup-proof person" in two seconds, the DM was wasted (`02`).
4. **Lead with a resource, sell inside it.** The DM gives away a genuinely good free
   asset (audit script, drill checklist). The asset teaches the method; Dockstash
   appears inside it as the way to automate the method. The DM itself never pitches.
5. **Outcome, not features.** Frame everything as *"we help {agencies hosting client
   sites} {hand clients proof their backups restore} without {babysitting backup
   scripts or paying per-site}"*. Nobody on LinkedIn wants a feature tour.
6. **Sound like a person.** Corporate-speak ("synergizing scalable solutions") is
   invisible on LinkedIn precisely because everyone posts it. Plain sentences a
   human would say out loud win DMs, posts, and ads alike.
7. **Multiple touches, multiple scripts.** Most buyers need several exposures
   (doc 07 + the x-growth 24-touch rule apply here too). Always run 2 script
   variants and let reply-rate pick the winner; never conclude from one send.
8. **Volume is capped — respect it.** LinkedIn throttles invites (~100–200/week;
   ~15–20/day is the safe zone) and bans automation it detects (`03` §6). The
   founder account also runs doc 07's content and the influencer program — it is
   not expendable. Slow and alive beats fast and restricted.
9. **It's a long game.** The agency owner who books a call in month 4 saw a post in
   month 1, got a DM in month 2, and hit the audit script in month 3. Consistency
   compounds invisibly, same as on X.

## 5. What we're selling (so DMs and posts stay honest)

Limits below are from `server/src/modules/billing/plans.ts` — the source of truth.
Never round them up.

| | Free | Pro — $9/mo | Business — $29/mo |
|---|---|---|---|
| Projects | 1 | 10 | Unlimited |
| Backup frequency | Daily | Continuous (5-min floor) | Any cron (1-min floor) |
| Retention | 7 days | 30 days | 90 days |
| Schedules · email alerts · restore drills · PITR | — | ✓ | ✓ |
| Connected fleet agents | 1 | **5** | Unlimited |
| Fleet dashboard · mirror | — | — | ✓ |

Yearly = 10× monthly ("2 months free").

- **Business ($29/mo)** is the LinkedIn product. The two sentences that close
  agencies: *"flat, not per-site"* and *"a monthly 'your backup was restore-tested
  on {date}' line in your client reports"* (the deliverable angle from doc 09 E2).
- **Free** is the risk-free trial in every DM and ad: one project, no card. "Trial
  it on an internal project first" removes the last objection.
- **The trust base:** repos are plain restic, encrypted with the user's key, on the
  user's own storage; `restic restore` works even if Dockstash disappears. Dana's
  security review needs this sentence early.

Precision note: Pro allows **5 connected agents**, not zero. Say "unlimited agents,
the fleet dashboard, and mirroring are Business" — never "fleet is Business-only."

## 6. Prerequisites checklist (before the first invite goes out)

- [ ] Profile rebuilt per `02-profile-setup.md` (photo, banner, headline, About,
      Featured).
- [ ] Company page exists and looks alive (logo, description, link).
- [ ] ≥2 weeks of doc-07 LinkedIn posts on the profile — outreach to a dead profile
      burns the list.
- [ ] ICP written down in one sentence (who + problem + message, §2).
- [ ] The free resource actually built and genuinely good (`03` §3) — this program
      does not start until the asset exists.
- [ ] Prospect sheet shared with doc 09 (one CRM, two channels).
